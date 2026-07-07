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

// Türkçe sesleri önceliklendir; yoksa eldeki tüm sesler.
function turkishVoices(): SpeechSynthesisVoice[] {
  const tr = cachedVoices.filter((v) => /tr(-|_|$)/i.test(v.lang));
  return tr.length ? tr : cachedVoices;
}

const FEMALE_HINT = /female|kadın|woman|\b(yelda|filiz|aylin|zeynep|emel|seda|google türkçe)\b/i;
const MALE_HINT = /\bmale\b|erkek|\bman\b|\b(tolga|cem|volkan|burak|onur|mehmet)\b/i;

// Konuk cinsiyetine ve index'ine göre ses seçimi.
// Türkçe sesler kısıtlı olduğundan cinsiyet asıl PERDE (pitch) ile ayrılır:
// kadın tiz, erkek pes. Platformda cinsiyetli ses varsa o da seçilir.
export function voiceForGuest(
  i: number,
  gender?: "male" | "female",
): { voice?: SpeechSynthesisVoice; pitch: number; rate: number } {
  const voices = turkishVoices();
  let voice: SpeechSynthesisVoice | undefined;
  if (gender === "female") voice = voices.find((v) => FEMALE_HINT.test(v.name));
  if (gender === "male") voice = voices.find((v) => MALE_HINT.test(v.name));
  if (!voice && voices.length) voice = voices[i % voices.length];

  // Aynı cinsiyetten konuklar da hafifçe farklılaşsın diye index'e göre küçük kayma.
  const jitter = ((i % 3) - 1) * 0.06;
  const pitch =
    gender === "female" ? 1.35 + jitter : gender === "male" ? 0.75 + jitter : 1.0 + jitter;
  const rate = 0.98 + ((i % 2) - 0.5) * 0.06;
  return { voice, pitch: Math.max(0.5, Math.min(2, pitch)), rate };
}

// Emoji ve süsleri temizle (TTS emoji adlarını sesli okumasın).
function cleanForSpeech(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}☀-➿️]/gu, "")
    .replace(/[*_]/g, "") // markdown işaretleri sesli okunmasın
    .replace(/\s+/g, " ")
    .trim();
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// Metni seslendirir; bitince (ya da iptalde) çözülür. Sinyal iptal ederse durur.
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
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = opts.voice?.lang || "tr-TR";
    if (opts.voice) u.voice = opts.voice;
    u.pitch = opts.pitch ?? 1;
    u.rate = opts.rate ?? 1;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      opts.signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = () => {
      window.speechSynthesis.cancel();
      finish();
    };

    u.onend = finish;
    u.onerror = finish;
    if (opts.signal) {
      if (opts.signal.aborted) {
        resolve();
        return;
      }
      opts.signal.addEventListener("abort", onAbort);
    }
    window.speechSynthesis.speak(u);
  });
}
