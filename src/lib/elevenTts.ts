// ElevenLabs "HD Sesler" katmanı. Metni /api/tts proxy'sinden (sunucu anahtarı
// + sıkı demo limiti) ses olarak alır ve HTMLAudioElement ile çalar. Kota biter
// ya da herhangi bir hata olursa çağıran taraf tarayıcı TTS'ine (tts.ts) düşer.
//
// - Konuk cinsiyetine göre farklı ElevenLabs sesi; spikerin kendine ait sesi.
// - Canlı hız: audio.playbackRate (slider setSpeechRate → onSpeechRate ile canlı).
// - Basit önbellek: aynı (ses+metin) tekrar sentezlenmez (kota ve hız için).

import type { Guest } from "../types";
import { API_BASE } from "./deepseek";
import { onSpeechRate, getSpeechRate, voiceForGuest, MODERATOR_VOICE_INDEX } from "./tts";

const HD_KEY = "siyaset_meydani_hd_tts_v1";

// Kullanıcının kendi ElevenLabs anahtarı (BYOK) — varsa isteklerde header'a
// eklenir ve sunucu demo karakter limitini UYGULAMAZ (sınırsız HD).
let userElevenKey: string | null = null;
export function setElevenKey(key: string | null): void {
  userElevenKey = key && key.trim() ? key.trim() : null;
}
export function hasElevenKey(): boolean {
  return !!userElevenKey;
}

export function loadHdEnabled(): boolean {
  try {
    const v = localStorage.getItem(HD_KEY);
    return v === null ? true : v === "1"; // ilk açılışta HD (ElevenLabs) VARSAYILAN AÇIK
  } catch {
    return true;
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

// ElevenLabs hazır (premade) sesleri — TON'a göre gruplu (multilingual_v2
// hepsini Türkçe okur). Amaç: her konuğa AYRI ve KİŞİLİĞİNE UYGUN ses.
// olgun = derin/otoriter/yaşlı; dengeli = orta; genç = enerjik/parlak.
type Tone = "mature" | "mid" | "young";
const VOICES: Record<"male" | "female", Record<Tone, string[]>> = {
  male: {
    mature: [
      "VR6AewLTigWG4xSOukaG", // Arnold — güçlü, kararlı
      "onwK4e9ZLuTAKqWW03F9", // Daniel — otoriter, sunucu/haber
      "JBFqnCBsd6RMkjVDRZzb", // George — sıcak, olgun
      "2EiwWnXFnvU5JabPnv8n", // Clyde — sert, yaşlı
    ],
    mid: [
      "pNInz6obpgDQGcFmaJgB", // Adam — dengeli, anlatıcı
      "ErXwobaYiN019PkySvjV", // Antoni — yumuşak, orta yaş
      "IKne3meq5aSn9XLyUdCD", // Charlie — rahat
      "bVMeCyTHy58xNoL34h3p", // Jeremy — hevesli
    ],
    young: [
      "TxGEqnHWrfWFTfGW9XjX", // Josh — genç, derin
      "yoZ06aMxZJJ28mfd3POQ", // Sam — genç, hafif çatallı
      "TX3LPaxmHKxFdv7VOQHJ", // Liam — genç, net
      "N2lVS1w4EtoT3dr4eOWO", // Callum — karakterli
    ],
  },
  female: {
    mature: [
      "XB0fDUnXU5powFXDhCwa", // Charlotte — olgun, kendinden emin
      "ThT5KcBeYPX3keUQqHPh", // Dorothy — sakin, olgun
      "21m00Tcm4TlvDq8ikWAM", // Rachel — dingin, otoriter
    ],
    mid: [
      "EXAVITQu4vr4xnSDxMaL", // Sarah — sıcak, dengeli
      "XrExE9yKIg1WjnnlVkGX", // Matilda — samimi
      "oWAxZDx7w5VEj9dCyTzz", // Grace — nazik
    ],
    young: [
      "MF3mGyEYCl7XYWbV9V6O", // Elli — genç, duygusal
      "AZnzlk1XvdvUeBnXmlld", // Domi — genç, güçlü
      "jsCqWAovK2LkecY7zXl4", // Freya — enerjik
    ],
  },
};
// Spiker: konuklardan ayrışan kendine has, sıcak sunucu sesi (havuzlarda yok).
const MODERATOR_VOICE = "pFZP5JQG7iQjIQuC4Bku"; // Lily

// Konuğun dönemi + tartışma üslubundan ses TONU çıkar (kişiye uygun eşleştirme).
function toneForGuest(g: Guest): Tone {
  const era = (g.era || "").toLocaleLowerCase("tr");
  const style = g.debateStyle || "";
  const old = /antik|m[öo]\b|milattan|orta ?çağ|osmanl|selçuk|rönesans|klasik|1[3-8]\d\d|padişah|sultan|kağan|imparator|hükümdar|çar/.test(era);
  const modern = /modern|günümüz|çağdaş|20\.|21\.|19[5-9]\d|20\d\d/.test(era);
  const authoritative = /otoriter|bilgiç|soğukkanlı/.test(style);
  const youthful = /nükteli|alaycı|provokatör|duygusal/.test(style);
  if (authoritative || old) return "mature";
  if (youthful || modern) return "young";
  return "mid";
}

// Üsluba göre ElevenLabs voice_settings — ifade/dinamizm kişiye göre değişsin.
function settingsForGuest(g: Guest): { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean } {
  const style = g.debateStyle || "";
  if (/agresif|provokat[öo]r|otoriter/.test(style))
    return { stability: 0.3, similarity_boost: 0.85, style: 0.55, use_speaker_boost: true }; // dinamik, sert
  if (/soğukkanlı|bilgiç|arabulucu/.test(style))
    return { stability: 0.6, similarity_boost: 0.9, style: 0.12, use_speaker_boost: true }; // ölçülü, dingin
  if (/duygusal|nükteli|alaycı/.test(style))
    return { stability: 0.35, similarity_boost: 0.85, style: 0.45, use_speaker_boost: true }; // renkli
  return { stability: 0.42, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true };
}

type VoiceSettings = ReturnType<typeof settingsForGuest>;

// Panel için ses ATAMASI: her konuğa (index'ine) AYRI ve kişiliğine uygun ses.
// Aynı panelde iki konuk aynı sesi almaz (havuz yetmezse en yakın tondan devam).
// App, konukların cinsiyeti belli olduktan sonra çağırır.
let assignedVoices: (string | undefined)[] = [];
let assignedSettings: (VoiceSettings | undefined)[] = [];

export function assignVoicesForPanel(guests: Guest[]): void {
  assignedVoices = [];
  assignedSettings = [];
  const used = new Set<string>();
  guests.forEach((g, i) => {
    const gender: "male" | "female" = g.gender === "female" ? "female" : "male";
    const tone = toneForGuest(g);
    assignedVoices[i] = pickVoice(gender, tone, used);
    assignedSettings[i] = settingsForGuest(g);
  });
}

// İstenen tondan başlayıp, kullanılmamış ilk sesi seç; o ton biterse komşu
// tonlara geç; hepsi kullanıldıysa istenen tonun ilk sesine dön (deterministik).
function pickVoice(gender: "male" | "female", tone: Tone, used: Set<string>): string {
  const groups = VOICES[gender];
  const order: Tone[] =
    tone === "mature" ? ["mature", "mid", "young"] : tone === "young" ? ["young", "mid", "mature"] : ["mid", "mature", "young"];
  for (const t of order) {
    for (const v of groups[t]) {
      if (!used.has(v)) {
        used.add(v);
        return v;
      }
    }
  }
  return groups[order[0]][0];
}

function voiceIdFor(i: number, gender?: "male" | "female"): string {
  if (i === MODERATOR_VOICE_INDEX) return MODERATOR_VOICE;
  if (assignedVoices[i]) return assignedVoices[i]!;
  // Atama yoksa (emniyet): tona bakmadan cinsiyet havuzunu düzleştirip index'e göre.
  const gp = VOICES[gender === "female" ? "female" : "male"];
  const flat = [...gp.mature, ...gp.mid, ...gp.young];
  return flat[i % flat.length];
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

async function synthesize(
  text: string,
  voiceId: string,
  signal?: AbortSignal,
  settings?: VoiceSettings,
): Promise<string> {
  const key = `${voiceId}|${text}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userElevenKey) headers["x-eleven-key"] = userElevenKey;
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers,
    body: JSON.stringify(settings ? { text, voiceId, settings } : { text, voiceId }),
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
  const settings = opts.voiceIdx === MODERATOR_VOICE_INDEX ? undefined : assignedSettings[opts.voiceIdx];
  const url = await synthesize(t, voiceId, opts.signal, settings); // hata → yukarı fırlar

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
