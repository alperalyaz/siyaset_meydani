// ElevenLabs "HD Sesler" katmanı. Metni /api/tts proxy'sinden (sunucu anahtarı
// + sıkı demo limiti) ses olarak alır ve HTMLAudioElement ile çalar. Kota biter
// ya da herhangi bir hata olursa çağıran taraf tarayıcı TTS'ine (tts.ts) düşer.
//
// - Konuk cinsiyetine göre farklı ElevenLabs sesi; spikerin kendine ait sesi.
// - Canlı hız: audio.playbackRate (slider setSpeechRate → onSpeechRate ile canlı).
// - Basit önbellek: aynı (ses+metin) tekrar sentezlenmez (kota ve hız için).

import { API_BASE } from "./deepseek";
import { onSpeechRate, getSpeechRate, voiceForGuest, MODERATOR_VOICE_INDEX } from "./tts";

const HD_KEY = "siyaset_meydani_hd_tts_v1";

export function loadHdEnabled(): boolean {
  try {
    return localStorage.getItem(HD_KEY) === "1";
  } catch {
    return false;
  }
}
export function saveHdEnabled(on: boolean): void {
  try {
    localStorage.setItem(HD_KEY, on ? "1" : "0");
  } catch {
    /* yoksay */
  }
}

// HD ses kalıcı olarak kullanılamıyor mu (kota doldu / anahtar yok)? Bu oturumda
// bir daha denemeyip doğrudan tarayıcı sesine düşmek için işaretlenir.
let hdExhausted = false;
export function isHdExhausted(): boolean {
  return hdExhausted;
}
export function resetHdExhausted(): void {
  hdExhausted = false;
}

// Kalan demo karakter hakkı (sunucudan x-tts-remaining başlığı). null = bilinmiyor.
let remainingChars: number | null = null;
export function getTtsRemaining(): number | null {
  return remainingChars;
}

export class ElevenError extends Error {
  code: string;
  status: number;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ElevenLabs hazır (premade) ses kimlikleri — çok dilli modelde Türkçe okur.
// Kadın ve erkek havuzları; konuk index'ine göre dağıtılır ki sesler ayrışsın.
const FEMALE_VOICES = [
  "EXAVITQu4vr4xnSDxMaL", // Sarah — sıcak
  "XB0fDUnXU5powFXDhCwa", // Charlotte
  "XrExE9yKIg1WjnnlVkGX", // Matilda
  "ThT5KcBeYPX3keUQqHPh", // Dorothy
  "AZnzlk1XvdvUeBnXmlld", // Domi
  "MF3mGyEYCl7XYWbV9V6O", // Elli
];
const MALE_VOICES = [
  "pNInz6obpgDQGcFmaJgB", // Adam
  "ErXwobaYiN019PkySvjV", // Antoni
  "VR6AewLTigWG4xSOukaG", // Arnold
  "TxGEqnHWrfWFTfGW9XjX", // Josh
  "JBFqnCBsd6RMkjVDRZzb", // George
  "onwK4e9ZLuTAKqWW03F9", // Daniel
];
// Spiker: konuklardan ayrışan kendine has bir ses (sıcak kadın sunucu tonu).
const MODERATOR_VOICE = "pFZP5JQG7iQjIQuC4Bku"; // Lily

function voiceIdFor(i: number, gender?: "male" | "female"): string {
  if (i === MODERATOR_VOICE_INDEX) return MODERATOR_VOICE;
  const pool = gender === "male" ? MALE_VOICES : gender === "female" ? FEMALE_VOICES : MALE_VOICES;
  return pool[i % pool.length];
}

// Basit LRU önbellek: (voiceId|text) → blob URL. Kota ve gecikmeyi azaltır.
const cache = new Map<string, string>();
const CACHE_MAX = 48;
function cacheGet(key: string): string | undefined {
  const v = cache.get(key);
  if (v) {
    cache.delete(key);
    cache.set(key, v); // en son kullanılan sona
  }
  return v;
}
function cacheSet(key: string, url: string): void {
  cache.set(key, url);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const u = cache.get(oldest);
    cache.delete(oldest);
    if (u) URL.revokeObjectURL(u);
  }
}

// Emoji/markdown temizliği (tarayıcı TTS ile aynı mantık; HD ses de okumasın).
function clean(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}☀-➿️]/gu, "")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Çalan ses öğesi — canlı hız değişimi için tutulur.
let activeAudio: HTMLAudioElement | null = null;
onSpeechRate((mult) => {
  if (activeAudio) {
    activeAudio.playbackRate = Math.max(0.5, Math.min(4, (activeAudio.dataset.baseRate ? Number(activeAudio.dataset.baseRate) : 1) * mult));
  }
});

async function synthesize(text: string, voiceId: string, signal?: AbortSignal): Promise<string> {
  const key = `${voiceId}|${text}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const res = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId }),
    signal,
  });

  if (!res.ok) {
    let code = "TTS_ERROR";
    let msg = "HD ses üretilemedi.";
    try {
      const d = (await res.json()) as { code?: string; error?: string };
      code = d.code || code;
      msg = d.error || msg;
    } catch {
      /* gövde JSON değil */
    }
    if (res.status === 429) code = "QUOTA";
    if (res.status === 503) code = "NO_KEY";
    throw new ElevenError(msg, res.status, code);
  }

  const rem = res.headers.get("x-tts-remaining");
  if (rem !== null) remainingChars = Number(rem);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  cacheSet(key, url);
  return url;
}

// HD ses ile seslendir. Başarılıysa çözülür; kota/hata olursa ELEVENERROR
// fırlatır ki çağıran tarayıcı sesine düşsün. İptal sinyalinde sessizce durur.
export async function elevenSpeak(
  text: string,
  opts: { voiceIdx: number; gender?: "male" | "female"; signal?: AbortSignal },
): Promise<void> {
  const t = clean(text);
  if (!t) return;
  if (opts.signal?.aborted) return;

  const voiceId = voiceIdFor(opts.voiceIdx, opts.gender);
  const url = await synthesize(t, voiceId, opts.signal); // hata → yukarı fırlar

  if (opts.signal?.aborted) return;

  const baseRate = voiceForGuest(opts.voiceIdx, opts.gender).rate;

  await new Promise<void>((resolve) => {
    const audio = new Audio(url);
    audio.dataset.baseRate = String(baseRate);
    audio.playbackRate = Math.max(0.5, Math.min(4, baseRate * getSpeechRate()));
    activeAudio = audio;

    const done = () => {
      if (activeAudio === audio) activeAudio = null;
      opts.signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = () => {
      audio.pause();
      done();
    };
    opts.signal?.addEventListener("abort", onAbort);
    audio.onended = done;
    audio.onerror = done;
    void audio.play().catch(done); // otomatik oynatma engeli vb. → düş
  });
}

// Bu oturumda HD sesi kalıcı olarak kapat (kota/anahtar sorunu). Çağıran, hata
// tipine bakıp bunu tetikler; sonrasında hep tarayıcı sesi kullanılır.
export function markHdExhausted(): void {
  hdExhausted = true;
}

// HD gerçekten çalışıyor mu? Kısa bir örnek sentezleyip sonucu döndürür (blob
// önbelleğe girer, sonra tekrar kullanılır). Kullanıcı 🎧'i açınca çağrılır ki
// "neden dandik?" belirsizliği kalmasın: anahtar yok / kota dolu / çalışıyor
// açıkça söylenir.
export async function probeEleven(): Promise<{ ok: boolean; code?: string; message?: string }> {
  try {
    await synthesize("Merhaba, hoş geldiniz.", MODERATOR_VOICE);
    return { ok: true };
  } catch (e) {
    if (e instanceof ElevenError) return { ok: false, code: e.code, message: e.message };
    return { ok: false, code: "ERROR", message: String(e) };
  }
}
