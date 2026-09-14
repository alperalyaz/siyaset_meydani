// Metin-ses (TTS) proxy'si:
//   • DEMO motoru: Cloud TTS Chirp 3 HD (GOOGLE_TTS_API_KEY). Gemini TTS ile
//     aynı sesler ama üretim ürünü — günlük istek tavanı yok, ayda 1M
//     karakter ücretsiz, sonrası $30/1M.
//   • BYOK: kullanıcı "x-gemini-key" (Gemini TTS) ya da "x-eleven-key"
//     (ElevenLabs) başlığıyla kendi anahtarını verirse tüm oturum onunla.
//     (Gemini motoru yalnızca BYOK için yaşar; demo yedeği kaldırıldı.)
// Demo modunda IP başına GÜNLÜK KARAKTER limiti (Supabase RPC; yoksa bellek).
//
// Yanıt: audio (mp3=ElevenLabs / wav=Gemini) + "x-tts-remaining"; hata/kota
// durumunda JSON gövde ({error, code}) döner ki istemci tarayıcı sesine düşsün.

const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
// Demo: IP başına GÜNLÜK ~15 dakikalık ses (~15.000 karakter konuşma) — bir
// oturumu baştan sona HD sesle bitirmeye yeter (chat limiti ~60 turken ses
// 12.000'de erken bitiyordu; iki limit dengelendi). Chirp 3 HD'de ayda 1M
// karakter ücretsiz olduğu için eş-dost/lansman döneminde cömert; trafik
// büyüyünce TTS_DEMO_CHAR_LIMIT env'i ile kod değişmeden kısılır.
const DEMO_CHAR_LIMIT = Number(process.env.TTS_DEMO_CHAR_LIMIT ?? "15000"); // IP/gün (~15 dk)
// Tek istekte azami karakter. Konuşmalar ton bütünlüğü için TEK istekte
// sentezlenir (bölmek ses değişimi hissi veriyor); 2-4 cümlelik replikler
// rahat sığsın diye sınır geniş — yine de kötüye kullanım freni var.
const MAX_TEXT = 1200;

// Gemini'nin bilinen hazır sesleri (güvenlik için beyaz liste).
const GEMINI_VOICES = new Set([
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
]);

export interface TtsRequestBody {
  text?: string;
  voiceId?: string;
  /** Oturumun dili ("tr" | "en"). İstemci bunu BİLİR (konudan tespit edilir),
   *  bu yüzden metinden tahmine her zaman üstün tutulur. Eski istemciler
   *  göndermez; o zaman guessLocale() devreye girer. */
  lang?: string;
  settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  gemini?: { voice?: string; style?: string };
}

// İstemciden gelen ses ayarlarını güvenli aralığa sıkıştır (kötü değer gelmesin).
function sanitizeSettings(s: TtsRequestBody["settings"]) {
  const clamp = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
  return {
    stability: clamp(s?.stability, 0.4),
    similarity_boost: clamp(s?.similarity_boost, 0.85),
    style: clamp(s?.style, 0.3),
    use_speaker_boost: s?.use_speaker_boost !== false,
  };
}

export interface TtsResult {
  status: number;
  audio?: Uint8Array;
  contentType?: string;
  headers?: Record<string, string>;
  body?: unknown; // hata durumunda JSON
}

// --- Demo karakter sayacı (Supabase RPC, yoksa bellek) ---
type Bucket = { day: string; chars: number };
const buckets = new Map<string, Bucket>();
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function consumeMemory(ip: string, chars: number): number {
  const day = today();
  const b = buckets.get(ip);
  if (!b || b.day !== day) {
    buckets.set(ip, { day, chars });
    return chars;
  }
  b.chars += chars;
  return b.chars;
}
async function consumeChars(ip: string, chars: number): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/siyaset_tts_touch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ p_ip: ip, p_chars: chars }),
      });
      if (res.ok) {
        const data = await res.json();
        const n = typeof data === "number" ? data : Number(data);
        if (Number.isFinite(n)) return n;
      }
    } catch {
      /* Supabase erişilemedi → bellek yedeği */
    }
  }
  return consumeMemory(ip, chars);
}

// Ham PCM'yi (16-bit, mono) tarayıcının çalabileceği WAV'a sarar.
function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const dataLen = pcm.length;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, "RIFF"); v.setUint32(4, 36 + dataLen, true); wr(8, "WAVE");
  wr(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits
  wr(36, "data"); v.setUint32(40, dataLen, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}

// Base64 → Uint8Array (Node ortamı; Buffer mevcut).
function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export async function handleTts(
  body: TtsRequestBody,
  keys: { eleven?: string; gemini?: string },
  ip: string,
): Promise<TtsResult> {
  const text = (body?.text ?? "").toString().trim().slice(0, MAX_TEXT);
  const voiceId = (body?.voiceId ?? "").toString().trim();
  if (!text || !voiceId) {
    return { status: 400, body: { error: "text ve voiceId gerekli.", code: "BAD_REQUEST" } };
  }

  const userGemini = keys.gemini && keys.gemini.trim() ? keys.gemini.trim() : "";
  const userEleven = keys.eleven && keys.eleven.trim() ? keys.eleven.trim() : "";
  // DEMO motoru: yalnızca Cloud TTS Chirp 3 HD (GOOGLE_TTS_API_KEY).
  // Gemini TTS demo yedeği KALDIRILDI — önizleme modelinin 100 istek/gün
  // tavanı bir web demosu için anlamsız. (Kullanıcının KENDİ Gemini
  // anahtarı — BYOK — hâlâ Gemini motorunu kullanır; o kendi kotasıdır.)
  const chirpDemoKey = process.env.GOOGLE_TTS_API_KEY;
  const elevenDemoKey = process.env.ELEVENLABS_API_KEY;

  // Motor + anahtar seçimi. Kullanıcının KENDİ anahtarı varsa (BYOK) demo
  // limiti uygulanmaz ve o kullanılır. Öncelik: kullanıcı Gemini > kullanıcı
  // ElevenLabs > sunucu Chirp3-HD (demo) > sunucu ElevenLabs (demo).
  let engine: "eleven" | "gemini" | "chirp";
  let apiKey: string;
  let byok: boolean;
  if (userGemini) {
    engine = "gemini"; apiKey = userGemini; byok = true;
  } else if (userEleven) {
    engine = "eleven"; apiKey = userEleven; byok = true;
  } else if (chirpDemoKey) {
    engine = "chirp"; apiKey = chirpDemoKey; byok = false;
  } else if (elevenDemoKey) {
    engine = "eleven"; apiKey = elevenDemoKey; byok = false;
  } else {
    return { status: 503, body: { error: "HD sesler şu an kapalı (anahtar yok).", code: "NO_KEY" } };
  }

  // Demo modunda karakter limiti (BYOK sınırsız).
  let remaining: number | null = null;
  if (!byok) {
    const used = await consumeChars(ip, text.length);
    remaining = Math.max(0, DEMO_CHAR_LIMIT - used);
    if (used > DEMO_CHAR_LIMIT) {
      return {
        status: 429,
        body: { error: "Günlük HD ses hakkınız doldu; normal seslere geçildi.", code: "QUOTA", remaining: 0 },
      };
    }
  }

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (remaining !== null) headers["x-tts-remaining"] = String(remaining);
  headers["x-tts-byok"] = byok ? "1" : "0";
  headers["x-tts-engine"] = engine;

  const result =
    engine === "chirp"
      ? await chirpGenerate(text, body.gemini, body.lang, apiKey, headers)
      : engine === "gemini"
        ? await geminiGenerate(text, body.gemini, apiKey, headers)
        : await elevenGenerate(text, voiceId, sanitizeSettings(body?.settings), apiKey, headers);
  // BYOK anahtarı reddedildiyse bunu NO_KEY (sunucuda anahtar yok) ile
  // KARIŞTIRMA: istemci "girdiğin anahtar geçersiz" diyebilsin.
  if (byok && result.status !== 200 && (result.body as { code?: string } | undefined)?.code === "NO_KEY") {
    (result.body as { code: string }).code = "BAD_KEY";
  }
  return result;
}

// --- Yerel (locale) seçimi — yalnızca Chirp içindir. ElevenLabs
// (multilingual) ve Gemini metnin dilini kendileri tespit eder.

// Türkçeye ÖZGÜ harf içermeyen sık Türkçe kelimeler. Türkçe harfli metin
// zaten birinci kuralda yakalanır; bu liste tam da onun kaçırdığı durum
// için: "Sen ne dersin", "Bana bak" gibi kısa, aksansız replikler.
// "her" bilerek YOK — İngilizce "her" ile çakışıyor.
const TR_WORDS = new Set([
  "ve", "bir", "bu", "su", "ben", "sen", "biz", "siz", "onlar", "ama", "ancak",
  "de", "da", "ki", "mi", "ne", "kim", "daha", "sonra", "var", "yok", "evet",
  "tamam", "bana", "sana", "bize", "size", "ona", "onu", "beni", "seni", "bunu",
  "gibi", "kadar", "zaten", "belki", "tabii", "gerek", "olur", "oldu", "dedi",
  "diyor", "bak", "dinle", "anlat", "yani", "hem", "ise", "bile", "sadece",
  "herkes", "kendi", "hep", "peki", "hani", "iste", "yine", "insan", "sey",
  "zaman", "olarak", "yoksa", "aynen", "elbette", "asla", "hemen",
]);

const EN_WORDS = new Set([
  "the", "and", "of", "to", "in", "is", "it", "that", "this", "you", "for",
  "with", "not", "but", "have", "from", "they", "we", "what", "which", "there",
  "their", "would", "could", "should", "about", "been", "were", "are", "was",
  "his", "her", "him", "she", "he", "my", "me", "do", "does", "did", "can",
  "will", "just", "very", "more", "than", "then", "when", "where", "who", "how",
  "all", "any", "some", "only", "also", "because", "while", "your", "our",
  "has", "had", "them", "these", "those", "its", "if", "as", "on", "at", "by",
]);

// İngilizce kelimelerde görülmeyen, aksansız yazılabilen Türkçe ek kalıpları
// ("diyor", "yapacak", "gelmek"). Hiçbiri İngilizce kelime sonu değildir.
const TR_SUFFIX = /\b[a-z]{2,}(?:yor|acak|ecek|mak|mek)\b/;

// Metinden dil tahmini — SADECE istemci lang göndermediğinde kullanılır.
function guessLocale(text: string): "tr-TR" | "en-US" {
  // 1) Türkçeye özgü harf: tek başına kesin sinyal.
  if (/[çğıİöşüÇĞİÖŞÜ]/.test(text)) return "tr-TR";
  const lower = text.toLowerCase();
  // 2) Türkçe ek kalıbı.
  if (TR_SUFFIX.test(lower)) return "tr-TR";
  // 3) Sık kelimeleri say, hangisi öndeyse o.
  let tr = 0;
  let en = 0;
  for (const w of lower.match(/[a-z]+/g) ?? []) {
    if (TR_WORDS.has(w)) tr++;
    else if (EN_WORDS.has(w)) en++;
  }
  if (tr > en) return "tr-TR";
  if (en > tr) return "en-US";
  // 4) Hiç sinyal yok (sayı, tek özel ad, noktalama): eski davranışı koru.
  return "en-US";
}

// Oturum dili varsa o kazanır; yoksa metinden tahmin.
function resolveLocale(text: string, lang?: string): "tr-TR" | "en-US" {
  const l = (lang ?? "").toString().trim().toLowerCase();
  if (l === "tr") return "tr-TR";
  if (l === "en") return "en-US";
  return guessLocale(text);
}

// Cloud Text-to-Speech (Chirp 3 HD). Gemini TTS ile aynı hazır sesler
// (Aoede, Puck, Charon...) — ses adı "{locale}-Chirp3-HD-{Ad}" biçiminde
// yerelle birleştirilir. Yerel, metnin dilinden kabaca tespit edilir
// (Türkçe karakter → tr-TR, değilse en-US). Üslup talimatı desteklenmediği
// için stil ön-eki KULLANILMAZ (sesler zaten karakterli).
async function chirpGenerate(
  text: string,
  gemini: TtsRequestBody["gemini"],
  lang: string | undefined,
  apiKey: string,
  headers: Record<string, string>,
): Promise<TtsResult> {
  const voice = gemini?.voice && GEMINI_VOICES.has(gemini.voice) ? gemini.voice : "Kore";
  const locale = resolveLocale(text, lang);
  headers["x-tts-locale"] = locale;
  const payload = {
    input: { text },
    voice: { languageCode: locale, name: `${locale}-Chirp3-HD-${voice}` },
    audioConfig: { audioEncoding: "MP3" },
  };

  let upstream: Response | undefined;
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      upstream = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, 800)); continue; }
      return { status: 502, body: { error: "Cloud TTS'e ulaşılamadı.", code: "UPSTREAM", detail: String(err) } };
    }
    if (upstream.ok) break;
    if ((upstream.status === 429 || upstream.status === 503) && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 900));
      continue;
    }
    const detail = await upstream.text().catch(() => "");
    const invalidKey = upstream.status === 401 || upstream.status === 403 || /API_KEY_INVALID|API key not valid/i.test(detail);
    const quota = upstream.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail);
    const code = invalidKey ? "NO_KEY" : quota ? "QUOTA" : "UPSTREAM";
    return { status: upstream.status, body: { error: "HD ses üretilemedi.", code, detail: detail.slice(0, 300) } };
  }
  if (!upstream) return { status: 502, body: { error: "Beklenmeyen hata.", code: "UPSTREAM" } };

  const data = (await upstream.json()) as { audioContent?: string };
  if (!data.audioContent) {
    return { status: 502, body: { error: "Cloud TTS ses döndürmedi.", code: "UPSTREAM" } };
  }
  return { status: 200, audio: b64ToBytes(data.audioContent), contentType: "audio/mpeg", headers };
}

async function geminiGenerate(
  text: string,
  gemini: TtsRequestBody["gemini"],
  apiKey: string,
  headers: Record<string, string>,
): Promise<TtsResult> {
  const voice = gemini?.voice && GEMINI_VOICES.has(gemini.voice) ? gemini.voice : "Kore";
  const style = (gemini?.style ?? "").toString().slice(0, 160).replace(/[\n\r]+/g, " ").trim();
  // Üslup, doğal-dil talimatı olarak metnin önüne konur ("... tonuyla oku: <metin>").
  // Metnin dili neyse Gemini o dilde okur; talimat sesli okunmaz.
  const input = style ? `${style}: ${text}` : text;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const payload = {
    contents: [{ parts: [{ text: input }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };

  let upstream: Response | undefined;
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, 800)); continue; }
      return { status: 502, body: { error: "Gemini'ye ulaşılamadı.", code: "UPSTREAM", detail: String(err) } };
    }
    if (upstream.ok) break;
    if ((upstream.status === 429 || upstream.status === 503) && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 900));
      continue;
    }
    const detail = await upstream.text().catch(() => "");
    // Geçersiz/eksik anahtar (400 API_KEY_INVALID / 401 / 403) → NO_KEY;
    // kota (429 / RESOURCE_EXHAUSTED) → QUOTA; diğer → UPSTREAM. Hepsi tarayıcı
    // sesine düşürür ama mesaj doğru olsun.
    const invalidKey = upstream.status === 401 || upstream.status === 403 || /API_KEY_INVALID|API key not valid/i.test(detail);
    const quota = upstream.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail);
    const code = invalidKey ? "NO_KEY" : quota ? "QUOTA" : "UPSTREAM";
    return { status: upstream.status, body: { error: "HD ses üretilemedi.", code, detail: detail.slice(0, 300) } };
  }
  if (!upstream) return { status: 502, body: { error: "Beklenmeyen hata.", code: "UPSTREAM" } };

  const data = (await upstream.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const b64 = part?.inlineData?.data;
  if (!b64) {
    return { status: 502, body: { error: "Gemini ses döndürmedi.", code: "UPSTREAM" } };
  }
  const rate = Number(/rate=(\d+)/.exec(part?.inlineData?.mimeType ?? "")?.[1] ?? "24000") || 24000;
  const wav = pcmToWav(b64ToBytes(b64), rate);
  return { status: 200, audio: wav, contentType: "audio/wav", headers };
}

async function elevenGenerate(
  text: string,
  voiceId: string,
  settings: ReturnType<typeof sanitizeSettings>,
  apiKey: string,
  headers: Record<string, string>,
): Promise<TtsResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const payload = { text, model_id: ELEVEN_MODEL, voice_settings: settings };

  let upstream: Response | undefined;
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg", "xi-api-key": apiKey },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, 800)); continue; }
      return { status: 502, body: { error: "ElevenLabs'a ulaşılamadı.", code: "UPSTREAM", detail: String(err) } };
    }
    if (upstream.ok) break;
    if (upstream.status === 429 && attempt < maxRetries) { await new Promise((r) => setTimeout(r, 800)); continue; }
    const detail = await upstream.text().catch(() => "");
    const code = upstream.status === 401 ? "NO_KEY" : upstream.status === 402 ? "QUOTA" : upstream.status === 429 ? "QUOTA" : "UPSTREAM";
    return { status: upstream.status, body: { error: "HD ses üretilemedi.", code, detail: detail.slice(0, 300) } };
  }
  if (!upstream) return { status: 502, body: { error: "Beklenmeyen hata.", code: "UPSTREAM" } };

  const buf = new Uint8Array(await upstream.arrayBuffer());
  return { status: 200, audio: buf, contentType: "audio/mpeg", headers };
}
