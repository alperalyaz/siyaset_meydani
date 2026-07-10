// ElevenLabs metin-ses (TTS) proxy'si. Sunucudaki ELEVENLABS_API_KEY ile çalışır
// (demo). Kötüye kullanımı önlemek için IP başına GÜNLÜK KARAKTER limiti uygulanır
// (kalıcı olması için Supabase RPC; yoksa bellek-içi yedek). Kullanıcı kendi
// ElevenLabs anahtarını "x-eleven-key" başlığıyla gönderirse limit uygulanmaz.
//
// Yanıt: başarılıysa audio/mpeg (mp3) baytları + "x-tts-remaining" başlığı.
// Hata/kota durumunda JSON gövde ({error, code}) döner ki istemci tarayıcı
// sesine düşebilsin.

// Türkçe kalitesi için en iyi model: eleven_multilingual_v2 (flash ucuz ama
// "dandik" duyuluyordu). Env ile değiştirilebilir (ucuz istenirse flash_v2_5).
const MODEL_ID = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const DEMO_CHAR_LIMIT = Number(process.env.TTS_DEMO_CHAR_LIMIT ?? "6000"); // IP/gün
const MAX_TEXT = 600; // tek istekte azami karakter (kötüye kullanım/uzun metin freni)

export interface TtsRequestBody {
  text?: string;
  voiceId?: string;
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

export async function handleTts(
  body: TtsRequestBody,
  userElevenKey: string | undefined,
  ip: string,
): Promise<TtsResult> {
  const text = (body?.text ?? "").toString().trim().slice(0, MAX_TEXT);
  const voiceId = (body?.voiceId ?? "").toString().trim();
  if (!text || !voiceId) {
    return { status: 400, body: { error: "text ve voiceId gerekli.", code: "BAD_REQUEST" } };
  }

  const byok = Boolean(userElevenKey && userElevenKey.trim());
  const apiKey = byok ? userElevenKey!.trim() : process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return {
      status: 503,
      body: { error: "HD sesler şu an kapalı (anahtar yok).", code: "NO_KEY" },
    };
  }

  // Demo modunda karakter limiti.
  let remaining: number | null = null;
  if (!byok) {
    const used = await consumeChars(ip, text.length);
    remaining = Math.max(0, DEMO_CHAR_LIMIT - used);
    if (used > DEMO_CHAR_LIMIT) {
      return {
        status: 429,
        body: {
          error: "Günlük HD ses hakkınız doldu; normal seslere geçildi.",
          code: "QUOTA",
          remaining: 0,
        },
      };
    }
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const payload = {
    text,
    model_id: MODEL_ID,
    // Canlı yayın tadında: orta stabilite (monoton değil), yüksek benzerlik
    // (net ses kimliği), bir tık stil (ifade). multilingual_v2 bunları onurlandırır.
    voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true },
  };

  let upstream: Response | undefined;
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return { status: 502, body: { error: "ElevenLabs'a ulaşılamadı.", code: "UPSTREAM", detail: String(err) } };
    }
    if (upstream.ok) break;
    if (upstream.status === 429 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 800));
      continue;
    }
    const detail = await upstream.text().catch(() => "");
    // 401/402/429 → istemci tarayıcı sesine düşsün.
    const code = upstream.status === 401 ? "NO_KEY" : upstream.status === 402 ? "QUOTA" : upstream.status === 429 ? "QUOTA" : "UPSTREAM";
    return { status: upstream.status, body: { error: "HD ses üretilemedi.", code, detail: detail.slice(0, 300) } };
  }
  if (!upstream) return { status: 502, body: { error: "Beklenmeyen hata.", code: "UPSTREAM" } };

  const buf = new Uint8Array(await upstream.arrayBuffer());
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (remaining !== null) headers["x-tts-remaining"] = String(remaining);
  headers["x-tts-byok"] = byok ? "1" : "0";
  return { status: 200, audio: buf, contentType: "audio/mpeg", headers };
}
