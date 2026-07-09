// Tarayıcı seslendirmesi (Web Speech API). Ücretsiz, anahtarsız; kalite
// işletim sistemi/tarayıcı seslerine bağlıdır. Her konuğa farklı ton verir.

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Türkçe sesler; YEREL sesler (pitch/rate'i onurlandırır) öne alınır. Yoksa hepsi.
function turkishVoices(): SpeechSynthesisVoice[] {
  const tr = cachedVoices.filter(
    (v) => /^tr(-|_|$)/i.test(v.lang) || /turkish|türk/i.test(v.name),
  );
  const pool = tr.length ? tr : cachedVoices;
  // Yerel (localService) sesler pitch/rate ayarını uygular; uzak (Google) sesler yok sayar.
  return [...pool].sort((a, b) => Number(b.localService) - Number(a.localService));
}

const FEMALE_HINT =
  /female|kad[ıi]n|woman|\b(yelda|filiz|aylin|zeynep|emel|seda|elif|defne|nilüfer|google türkçe)\b/i;
const MALE_HINT = /\b(erkek|man|tolga|cem|volkan|burak|onur|ahmet|mehmet|kaan)\b/i;

// Spiker (moderator) için sabit index — kendine ait belirgin ses profili.
export const MODERATOR_VOICE_INDEX = 9;

// Konuk cinsiyetine ve index'ine göre ses seçimi. Öncelik sırası:
//   1) Cinsiyete uygun İSİMLİ ses (birden çoksa index'e göre dağıt — farklı
//      konuklar farklı ses alsın).
//   2) Yoksa karşı cinsiyet İSİMLİ OLMAYAN bir ses + güçlü perde ayrımı.
//   3) Hiç Türkçe ses yoksa mevcut seslerden index'e göre.
// Perde (pitch) cinsiyeti pekiştirir: kadın tiz, erkek pes. Aynı cinsiyette
// bile index'e göre perde/hız kayar ki sesler ayrışsın.
// (Not: cihazda tek UZAK ses varsa tarayıcı perdeyi yok sayabilir; o zaman
// fark duyulmaz — bu bir platform sınırıdır, kod değil.)
export function voiceForGuest(
  i: number,
  gender?: "male" | "female",
): { voice?: SpeechSynthesisVoice; pitch: number; rate: number } {
  const voices = turkishVoices();
  const fem = voices.filter((v) => FEMALE_HINT.test(v.name));
  const mal = voices.filter((v) => MALE_HINT.test(v.name));
  const isMod = i === MODERATOR_VOICE_INDEX;

  let voice: SpeechSynthesisVoice | undefined;
  if (gender === "female") {
    voice =
      (fem.length && fem[i % fem.length]) ||
      voices.find((v) => !MALE_HINT.test(v.name)) ||
      voices[i % (voices.length || 1)];
  } else if (gender === "male") {
    voice =
      (mal.length && mal[i % mal.length]) ||
      voices.find((v) => !FEMALE_HINT.test(v.name)) ||
      voices[i % (voices.length || 1)];
  } else {
    // Nötr/spiker: mümkünse kimsenin kullanmadığı bir sesi seçmeye çalış.
    voice = voices.length ? voices[i % voices.length] : undefined;
  }

  // Perde: cinsiyet baz + index kayması (çeşitlilik). Spiker nötr-otoriter.
  const base = gender === "female" ? 1.45 : gender === "male" ? 0.62 : isMod ? 1.0 : 0.95;
  const jitter = isMod ? 0 : (((i * 7) % 5) - 2) * 0.09; // -0.18..+0.18, index'e özgü
  const pitch = Math.max(0.3, Math.min(2, base + jitter));
  // Hız: spiker biraz daha ölçülü; konuklar index'e göre hafif değişir.
  const rate = isMod ? 0.98 : 0.9 + ((i * 3) % 4) * 0.06;
  return { voice, pitch, rate };
}

// Emoji ve süsleri temizle (TTS emoji adlarını sesli okumasın).
function cleanForSpeech(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}☀-➿️]/gu, "")
    .replace(/[*_]/g, "") // markdown işaretleri sesli okunmasın
    .replace(/\s+/g, " ")
    .trim();
}

// Cümle SONU olmayan ama nokta içeren kalıplar: sıra sayısı ("19.", "1."),
// tek harf/baş harf ("M.", roman "II."), yaygın kısaltmalar ("vb.", "Dr.").
// Bu kalıplarla biten parça, sonraki parçayla birleştirilir ki TTS orada
// yanlış yere duraklamasın ("19. yüzyıl" tek nefeste okunsun).
const NOT_SENTENCE_END =
  /(?:\d{1,4}|\b[a-zçğıöşü]|\b[IVX]{1,4}|\b(?:vb|Dr|Prof|Doç|bkz|yy|No|Nr|MÖ|MS|St|Sn|vs))\.$/i;

// Metni cümlelere böl (nokta, ünlem, soru işareti, noktalı virgül) ama
// sıra sayısı / kısaltma noktalarında bölme.
function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev && NOT_SENTENCE_END.test(prev)) {
      out[out.length - 1] = `${prev} ${part}`;
    } else {
      out.push(part);
    }
  }
  return out;
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// Canlı hız çarpanı (kullanıcı slider'ı). speak() HER cümlede bu güncel
// değeri okur; böylece slider değişince bir sonraki cümle yeni hızda okunur.
// (Çalan cümlenin ortasında hız değişmez — tarayıcı buna izin vermez — ama
// cümleler kısa olduğu için değişim birkaç saniyede duyulur. Eski pause/
// resume hilesi rakam/kelime atlatıyordu; kaldırıldı.)
let rateMultiplier = 1;

export function setSpeechRate(mult: number): void {
  rateMultiplier = mult > 0 ? mult : 1;
}

// Metni seslendirir; bitince (ya da iptalde) çözülür. Sinyal iptal ederse durur.
// Cümle cümle seslendirir — iptal anında yarım kalmaz, hemen susar.
// Rate/pitch: voice atamasından ÖNCE ayarlanır (bazı tarayıcılarda voice ataması
// rate'i sıfırlayabildiği için), sonra onstart'ta tekrar ayarlanır (fallback).
// Ses HER ZAMAN atanır (yerel/uzak fark etmez): kimliği (kadın/erkek sesi)
// belirleyen asıl şey VOICE SEÇİMİ, pitch sadece ek ayrım. Uzak sesler pitch'i
// yok sayabilir ama voice ataması çalışır — atamayı yerelle sınırlamak,
// tarayıcının rastgele/sabit varsayılan sesi (çoğu zaman hep aynı, erkek gibi
// duyulan) kullanmasına yol açıp cinsiyeti tamamen yanlış gösteriyordu.
export function speak(
  text: string,
  opts: { voice?: SpeechSynthesisVoice; pitch?: number; rate?: number; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise((resolve) => {
    const clean = cleanForSpeech(text);
    if (!ttsSupported() || !clean) {
      resolve();
      return;
    }

    const sentences = splitSentences(clean);
    if (sentences.length === 0) { resolve(); return; }

    let cancelled = false;
    const onAbort = () => {
      cancelled = true;
      window.speechSynthesis.cancel();
    };
    if (opts.signal) {
      if (opts.signal.aborted) { resolve(); return; }
      opts.signal.addEventListener("abort", onAbort);
    }

    let idx = 0;
    const speakNext = () => {
      if (cancelled || idx >= sentences.length) {
        opts.signal?.removeEventListener("abort", onAbort);
        resolve();
        return;
      }
      // Efektif hız = konuğun temel hızı × canlı çarpan (her cümlede güncel).
      const effRate = Math.max(0.1, Math.min(10, (opts.rate ?? 1) * rateMultiplier));
      const u = new SpeechSynthesisUtterance(sentences[idx]);
      u.lang = opts.voice?.lang || "tr-TR";
      // Rate/pitch voice'tan ÖNCE ayarla — voice ataması asenkron sıfırlamasın
      u.pitch = opts.pitch ?? 1;
      u.rate = effRate;
      if (opts.voice) {
        u.voice = opts.voice;
      }
      // onstart fallback: voice yüklendikten sonra bir kez daha ayarla
      u.onstart = () => {
        u.pitch = opts.pitch ?? 1;
        u.rate = effRate;
      };
      u.onend = () => { idx++; speakNext(); };
      u.onerror = () => { idx++; speakNext(); };
      window.speechSynthesis.speak(u);
    };
    speakNext();
  });
}
