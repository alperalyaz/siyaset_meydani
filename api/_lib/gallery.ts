// Yayınlanan oturum galerisi — Supabase RPC köprüsü + doğrulama.
// Tüm erişim SECURITY DEFINER RPC'ler üzerinden (tablo RLS ile kilitli).

export interface GalleryGuest {
  name: string;
  era?: string;
  color?: string;
}
export interface GalleryUtterance {
  speaker: number | "moderator";
  text: string;
  mode?: string;
}
export interface GalleryPayload {
  slug: string;
  lang: string;
  topic: string;
  guests: GalleryGuest[];
  utterances: GalleryUtterance[];
  rating: number;
  created_at?: string;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text().catch(() => "")}`);
  return (await res.json()) as T;
}

function slugGen(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 9; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export interface PublishBody {
  topic?: string;
  lang?: string;
  guests?: GalleryGuest[];
  utterances?: GalleryUtterance[];
  rating?: number;
}

export async function publishSession(body: PublishBody): Promise<{ status: number; body: unknown }> {
  const topic = (body?.topic ?? "").toString().trim().slice(0, 300);
  const lang = body?.lang === "en" ? "en" : "tr";
  const guests = Array.isArray(body?.guests) ? body.guests.slice(0, 12) : [];
  const utterances = Array.isArray(body?.utterances) ? body.utterances.slice(0, 600) : [];
  const rating = Number.isFinite(body?.rating) ? Math.max(0, Math.min(100, Number(body!.rating))) : 0;

  if (!topic || guests.length < 2 || utterances.length < 3) {
    return { status: 400, body: { error: "Eksik/geçersiz oturum verisi.", code: "BAD_REQUEST" } };
  }
  // Boyut freni: uçuk büyüklükte gövdeler yayınlanamaz.
  const size = JSON.stringify(utterances).length + JSON.stringify(guests).length;
  if (size > 400_000) {
    return { status: 413, body: { error: "Oturum galeri için fazla büyük.", code: "TOO_LARGE" } };
  }

  const cleanGuests: GalleryGuest[] = guests
    .filter((g) => g && typeof g.name === "string" && g.name.trim())
    .map((g) => ({
      name: g.name.toString().slice(0, 120),
      era: g.era ? g.era.toString().slice(0, 160) : undefined,
      color: g.color ? g.color.toString().slice(0, 24) : undefined,
    }));
  const cleanUtts: GalleryUtterance[] = utterances
    .filter((u) => u && typeof u.text === "string" && u.text.trim())
    .map((u) => ({
      speaker: u.speaker === "moderator" ? ("moderator" as const) : Number(u.speaker),
      text: u.text.toString().slice(0, 4000),
      mode: typeof u.mode === "string" ? u.mode.slice(0, 16) : undefined,
    }));

  const slug = slugGen();
  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
  try {
    const out = await rpc<string>("siyaset_gallery_publish", {
      p_slug: slug,
      p_lang: lang,
      p_topic: topic,
      p_guests: cleanGuests,
      p_utterances: cleanUtts,
      p_rating: rating,
      p_token: token,
    });
    if (!out) return { status: 503, body: { error: "Galeri deposu yapılandırılmamış.", code: "NO_STORE" } };
    return { status: 200, body: { slug, token, url: `https://debate.be/s/${slug}` } };
  } catch (e) {
    return { status: 502, body: { error: "Galeriye yayınlanamadı.", code: "UPSTREAM", detail: String(e).slice(0, 200) } };
  }
}

export async function getSession(slug: string): Promise<GalleryPayload | null> {
  if (!/^[a-z0-9]{6,24}$/.test(slug)) return null;
  try {
    return await rpc<GalleryPayload | null>("siyaset_gallery_get", { p_slug: slug });
  } catch {
    return null;
  }
}

export interface GalleryListItem {
  slug: string;
  lang: string;
  topic: string;
  rating: number;
  created_at: string;
  guestNames: string[];
}

export async function listSessions(limit: number): Promise<GalleryListItem[]> {
  try {
    const out = await rpc<GalleryListItem[] | null>("siyaset_gallery_list", {
      p_limit: Math.max(1, Math.min(1000, limit || 12)),
    });
    return Array.isArray(out) ? out : [];
  } catch {
    return [];
  }
}

export async function deleteSession(slug: string, token: string): Promise<boolean> {
  if (!/^[a-z0-9]{6,24}$/.test(slug) || !token) return false;
  try {
    return (await rpc<boolean>("siyaset_gallery_delete", { p_slug: slug, p_token: token })) === true;
  } catch {
    return false;
  }
}

// HTML kaçışı — SSR transkript sayfası için (XSS'e karşı zorunlu).
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
