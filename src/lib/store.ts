import type { Guest, Utterance } from "../types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const KEY = "siyaset_meydani_api_key";
const PROVIDER_KEY = "siyaset_meydani_provider";
const SESSION_KEY = "siyaset_meydani_session";
const META_LIST_KEY = "siyaset_meydani_meta";
const FULL_SESSION_PREFIX = "siyaset_meydani_full_";
const MAX_SESSIONS = 15;

export type ProviderKind = "deepseek" | "openai" | "anthropic" | "groq";

export interface SavedSession {
  guests: Guest[];
  topic: string;
  utterances: Utterance[];
  rating: number;
  savedAt: number;
  ended?: boolean;
}

export interface SessionMeta {
  id: string;
  topic: string;
  guestNames: string[];
  utterancesCount: number;
  rating: number;
  savedAt: number;
  ended?: boolean;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --- API key ---

export function loadApiKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveApiKey(key: string): void {
  try {
    localStorage.setItem(KEY, key.trim());
  } catch {
    /* yoksay */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}

export function loadProvider(): ProviderKind {
  try {
    const raw = localStorage.getItem(PROVIDER_KEY);
    if (raw === "openai" || raw === "anthropic" || raw === "groq") return raw;
    return "deepseek";
  } catch {
    return "deepseek";
  }
}

export function saveProvider(p: ProviderKind): void {
  try {
    localStorage.setItem(PROVIDER_KEY, p);
  } catch {
    /* yoksay */
  }
}

// --- TTS hız tercihi ---

// v2: varsayılan 1.5x'e geçiş. Eski "..._tts_rate" anahtarındaki (çoğu
// test kullanıcısında 1.0 kalmış) değer yok sayılır; herkes bir kez 1.5'e
// döner, sonra kendi seçimi bu yeni anahtarda saklanır.
const TTS_RATE_KEY = "siyaset_meydani_tts_rate_v2";

export function loadTtsRate(): number {
  try {
    const raw = localStorage.getItem(TTS_RATE_KEY);
    if (raw === null) return 1.5;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? Math.max(0.5, Math.min(2.0, v)) : 1.5;
  } catch {
    return 1.0;
  }
}

export function saveTtsRate(rate: number): void {
  try {
    localStorage.setItem(TTS_RATE_KEY, String(rate));
  } catch {
    /* yoksay */
  }
}

// --- Hazır konuk rafı (kullanıcının kişisel hızlı-ekle listesi) ---

export interface QuickGuest {
  name: string;
  thumbnail?: string;
  era?: string;
  resolved?: boolean; // Vikipedi'den zenginleştirme denendi mi (tekrar denemeyi önler)
}

// Her sekmenin (Derin / Gündelik) kendi hazır konuk rafı var.
export type QuickTab = "derin" | "gunluk";
const MAX_QUICK_GUESTS = 10;

// v3/v2: varsayılan raf 8 kişiye indirildi (satıra sığsın, ortalansın).
const QUICK_GUESTS_KEYS: Record<QuickTab, string> = {
  derin: "siyaset_meydani_quick_guests_v3",
  gunluk: "siyaset_meydani_quick_gunluk_v2",
};

// Derin: tartışmaya yatkın fikir insanları/gazeteciler.
// Gündelik: magazin/TV yıldızları (kadın programı havası).
// Kullanıcı istediğini × ile çıkarabilir, kendi ekledikleri eklenir; boş
// liste de saklanır (varsayılanlar geri gelmez).
const DEFAULT_QUICK_GUESTS: Record<QuickTab, QuickGuest[]> = {
  derin: [
    { name: "Sevan Nişanyan" },
    { name: "Celal Şengör" },
    { name: "İlber Ortaylı" },
    { name: "Kadir Mısıroğlu" },
    { name: "Emrah Safa Gürkan" },
    { name: "Murat Bardakçı" },
    { name: "Cüneyt Özdemir" },
    { name: "Fatih Altaylı" },
  ],
  gunluk: [
    { name: "Acun Ilıcalı" },
    { name: "Cem Yılmaz" },
    { name: "Hülya Avşar" },
    { name: "Müge Anlı" },
    { name: "Ebru Gündeş" },
    { name: "Seren Serengil" },
    { name: "Bülent Ersoy" },
    { name: "Gülben Ergen" },
  ],
};

export function loadQuickGuests(tab: QuickTab): QuickGuest[] {
  try {
    const raw = localStorage.getItem(QUICK_GUESTS_KEYS[tab]);
    if (raw === null) return [...DEFAULT_QUICK_GUESTS[tab]];
    const list = JSON.parse(raw) as QuickGuest[];
    return Array.isArray(list)
      ? list.filter((x) => x && typeof x.name === "string").slice(0, MAX_QUICK_GUESTS)
      : [...DEFAULT_QUICK_GUESTS[tab]];
  } catch {
    return [...DEFAULT_QUICK_GUESTS[tab]];
  }
}

export function saveQuickGuests(tab: QuickTab, list: QuickGuest[]): void {
  try {
    localStorage.setItem(QUICK_GUESTS_KEYS[tab], JSON.stringify(list.slice(0, MAX_QUICK_GUESTS)));
  } catch {
    /* yoksay */
  }
}

export { MAX_QUICK_GUESTS };

// --- Eski tekli oturum (geriye uyumlu) ---

export function saveSession(session: SavedSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* yoksay */
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* yoksay */
  }
}

// --- Çoklu oturum ---

export function listSessionMetas(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(META_LIST_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SessionMeta[];
    return list.filter((m) => {
      const full = localStorage.getItem(FULL_SESSION_PREFIX + m.id);
      if (!full) return false;
      try {
        JSON.parse(full);
        return true;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export function saveSessionAndIndex(
  session: SavedSession,
  existingId?: string,
): string {
  try {
    const id = existingId ?? uid();
    const fullSession = { ...session, id };
    localStorage.setItem(
      FULL_SESSION_PREFIX + id,
      JSON.stringify(fullSession),
    );

    const metas = listSessionMetasRaw();
    const idx = metas.findIndex((m) => m.id === id);
    const meta: SessionMeta = {
      id,
      topic: session.topic,
      guestNames: session.guests.map((g) => g.name),
      utterancesCount: session.utterances.length,
      rating: session.rating,
      savedAt: session.savedAt,
      ended: session.ended,
    };

    if (idx >= 0) {
      metas[idx] = meta;
    } else {
      metas.unshift(meta);
    }

    if (metas.length > MAX_SESSIONS) {
      const removed = metas.splice(MAX_SESSIONS);
      for (const r of removed) {
        try {
          localStorage.removeItem(FULL_SESSION_PREFIX + r.id);
        } catch {
          /* yoksay */
        }
      }
    }

    localStorage.setItem(META_LIST_KEY, JSON.stringify(metas));
    return id;
  } catch {
    return "";
  }
}

export function loadSessionById(id: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(FULL_SESSION_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as SavedSession;
  } catch {
    return null;
  }
}

export function deleteSessionById(id: string): void {
  try {
    localStorage.removeItem(FULL_SESSION_PREFIX + id);
    const metas = listSessionMetasRaw().filter((m) => m.id !== id);
    localStorage.setItem(META_LIST_KEY, JSON.stringify(metas));
  } catch {
    /* yoksay */
  }
}

export function deleteAllSessions(): void {
  try {
    const metas = listSessionMetasRaw();
    for (const m of metas) {
      try {
        localStorage.removeItem(FULL_SESSION_PREFIX + m.id);
      } catch {
        /* yoksay */
      }
    }
    localStorage.removeItem(META_LIST_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* yoksay */
  }
}

function listSessionMetasRaw(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(META_LIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionMeta[];
  } catch {
    return [];
  }
}
