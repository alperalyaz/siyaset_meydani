// Yayın galerisi istemci katmanı: oturumu rızayla HERKESE AÇIK yayınlama,
// galeri listesi ve tekil oturum çekme. Kaldırma hakkı için yayın anahtarı
// (owner token) bu tarayıcıda saklanır.
import type { Guest, Utterance } from "../types";
import { API_BASE } from "./deepseek";

const TOKENS_KEY = "siyaset_meydani_gallery_tokens_v1";

export interface GalleryItem {
  slug: string;
  lang: string;
  topic: string;
  rating: number;
  created_at: string;
  guestNames: string[];
}

export interface GallerySession {
  slug: string;
  lang: string;
  topic: string;
  guests: { name: string; era?: string; color?: string }[];
  utterances: { speaker: number | "moderator"; text: string; mode?: string }[];
  rating: number;
}

function loadTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function saveToken(slug: string, token: string): void {
  try {
    const all = loadTokens();
    all[slug] = token;
    localStorage.setItem(TOKENS_KEY, JSON.stringify(all));
  } catch {
    /* yoksay */
  }
}
export function ownToken(slug: string): string | null {
  return loadTokens()[slug] ?? null;
}

export async function publishToGallery(
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  rating: number,
  lang: "tr" | "en",
): Promise<{ slug: string; url: string }> {
  const res = await fetch(`${API_BASE}/api/gallery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      lang,
      rating,
      guests: guests.map((g) => ({ name: g.name, era: g.era, color: g.color })),
      utterances: utterances.map((u) => ({ speaker: u.speaker, text: u.text, mode: u.mode })),
    }),
  });
  const data = (await res.json()) as { slug?: string; url?: string; token?: string; error?: string };
  if (!res.ok || !data.slug) throw new Error(data.error || "publish failed");
  if (data.token) saveToken(data.slug, data.token);
  return { slug: data.slug, url: data.url ?? `https://debate.be/s/${data.slug}` };
}

export async function fetchGalleryList(limit = 8): Promise<GalleryItem[]> {
  const res = await fetch(`${API_BASE}/api/gallery?list=${limit}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: GalleryItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchGallerySession(slug: string): Promise<GallerySession | null> {
  const res = await fetch(`${API_BASE}/api/gallery?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return (await res.json()) as GallerySession;
}

export async function removeFromGallery(slug: string): Promise<boolean> {
  const token = ownToken(slug);
  if (!token) return false;
  const res = await fetch(
    `${API_BASE}/api/gallery?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
    { method: "DELETE" },
  );
  return res.ok;
}
