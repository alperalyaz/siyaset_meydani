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

// Konuk cinsiyetine ve index'ine göre ses seçimi.
// Türkçe sesler kısıtlıysa cinsiyet PERDE (pitch) ile ayrılır: kadın tiz, erkek
// pes. Cinsiyetli/farklı ses varsa o da kullanılır. (Not: tek uzak ses varsa
// tarayıcı perdeyi yok sayabilir; o zaman fark duyulmaz — platform sınırı.)
export function voiceForGuest(
  i: number,
  gender?: "male" | "female",
): { voice?: SpeechSynthesisVoice; pitch: number; rate: number } {
  const voices = turkishVoices();
  const fem = voices.filter((v) => FEMALE_HINT.test(v.name));
  const mal = voices.filter((v) => MALE_HINT.test(v.name));

  let voice: SpeechSynthesisVoice | undefined;
  if (gender === "female") {
    voice = fem.length ? fem[i % fem.length] : voices.find((v) => !MALE_HINT.test(v.name)) ?? voices[i % (voices.length || 1)];
  } else if (gender === "male") {
    voice = mal.length ? mal[i % mal.length] : voices.find((v) => !FEMALE_HINT.test(v.name)) ?? voices[i % (voices.length || 1)];
  } else {
    voice = voices.length ? voices[i % voices.length] : undefined;
  }

  // Güçlü perde ayrımı + aynı cinsiyette bile index'e göre kayma (çeşitlilik).
  const base = gender === "female" ? 1.5 : gender === "male" ? 0.6 : 1.0;
  const jitter = ((i % 3) - 1) * 0.12;
  const pitch = Math.max(0.3, Math.min(2, base + jitter));
  const rate = 0.9 + (i % 3) * 0.07;
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

// Metni cümlelere böl (nokta, ünlem, soru işareti, noktalı virgül).
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
  activeUtterance = null;
}

// Anlık hız değişimi için şu an çalan utterance referansı
let activeUtterance: SpeechSynthesisUtterance | null = null;

export function setActiveRate(rate: number): void {
  if (activeUtterance) {
    activeUtterance.rate = rate;
  }
}

// Metni seslendirir; bitince (ya da iptalde) çözülür. Sinyal iptal ederse durur.
// Cümle cümle seslendirir — iptal anında yarım kalmaz, hemen susar.
// Rate/pitch: voice atamasından ÖNCE ayarlanır (bazı tarayıcılarda voice ataması
// rate'i sıfırlayabildiği için), sonra onstart'ta tekrar ayarlanır (fallback).
// Uzak (remote) sesler pitch/rate uygulamaz, bu yüzden sadece yerel sesler atanır.
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
      const u = new SpeechSynthesisUtterance(sentences[idx]);
      u.lang = opts.voice?.lang || "tr-TR";
      // Rate/pitch voice'tan ÖNCE ayarla — voice ataması asenkron sıfırlamasın
      u.pitch = opts.pitch ?? 1;
      u.rate = opts.rate ?? 1;
      // Yalnızca YEREL ses ata (uzak/Google sesler pitch/rate'i yok sayıp sıfırlar)
      if (opts.voice && opts.voice.localService) {
        u.voice = opts.voice;
      }
      // onstart fallback: voice yüklendikten sonra bir kez daha ayarla
      u.onstart = () => {
        u.pitch = opts.pitch ?? 1;
        u.rate = opts.rate ?? 1;
        activeUtterance = u;
      };
      u.onend = () => { activeUtterance = null; idx++; speakNext(); };
      u.onerror = () => { activeUtterance = null; idx++; speakNext(); };
      window.speechSynthesis.speak(u);
    };
    speakNext();
  });
}
