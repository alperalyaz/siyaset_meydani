import type { Guest } from "../types";
import { PERSON_POOL, seedToGuest, colorForIndex, type Seed } from "./pool";

const TR_SUMMARY = (title: string) =>
  `https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

interface Summary {
  extract?: string;
  description?: string;
  thumbnail?: { source?: string };
  title?: string;
}

// Bir Vikipedi başlığının canlı özetini çeker (persona'yı gerçek maddeyle besler).
async function fetchSummary(title: string): Promise<Summary | null> {
  try {
    const res = await fetch(TR_SUMMARY(title), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as Summary;
  } catch {
    return null;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function enrich(seed: Seed, colorIndex: number): Promise<Guest> {
  const base = seedToGuest(seed, colorIndex);
  const s = await fetchSummary(seed.title);
  if (s?.extract && s.extract.length > 40) {
    base.blurb = s.extract;
  }
  if (s?.thumbnail?.source) {
    base.thumbnail = s.thumbnail.source;
  }
  return base;
}

// Küratörlü havuzdan rastgele 3 kişi seçip her birini Vikipedi özetiyle zenginleştirir.
export async function pickCuratedGuests(count = 3): Promise<Guest[]> {
  const chosen = shuffle(PERSON_POOL).slice(0, count);
  return Promise.all(chosen.map((seed, i) => enrich(seed, i)));
}

// ---- Canlı "Vikipedi'de popüler" modu ----

const PAGEVIEWS_TOP = (y: string, m: string, d: string) =>
  `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/tr.wikipedia/all-access/${y}/${m}/${d}`;

// Kişi olmayan tipik başlıkları eler.
const JUNK = /[:_]|Vikipedi|Anasayfa|Özel|Kategori|Liste|listesi|\bTürkiye\b|filmi|dizisi/i;

// Özet/açıklamadan "bu bir insan mı" sezgisi.
const OCCUPATION =
  /(oyuncu|şarkıcı|futbolcu|siyaset|yazar|şair|padişah|sultan|hükümdar|bilim|matematik|müzisyen|yönetmen|sanatçı|komutan|imparator|kağan|filozof|hekim|ressam|besteci|kraliç|kral|prens|sultanı|başbakan|cumhurbaşkan)/i;
const BIRTH = /\bd\.?\s?\d{3,4}\b|doğ(du|umlu)/i;

function looksLikePerson(s: Summary): boolean {
  const hay = `${s.description ?? ""} ${s.extract ?? ""}`;
  return OCCUPATION.test(hay) || BIRTH.test(hay);
}

function recentDateParts(daysAgo: number): [string, string, string] {
  const dt = new Date(Date.now() - daysAgo * 86400000);
  const y = String(dt.getUTCFullYear());
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return [y, m, d];
}

// Vikipedi'nin son günlerdeki en çok görüntülenen maddelerinden kişi olanları çeker.
// Başarısız olursa küratörlü havuza düşer.
export async function pickLivePopularGuests(count = 3): Promise<Guest[]> {
  for (let back = 2; back <= 4; back++) {
    const [y, m, d] = recentDateParts(back);
    let items: { article: string }[] = [];
    try {
      const res = await fetch(PAGEVIEWS_TOP(y, m, d));
      if (!res.ok) continue;
      const data = (await res.json()) as {
        items?: { articles?: { article: string }[] }[];
      };
      items = data.items?.[0]?.articles ?? [];
    } catch {
      continue;
    }

    const candidates = shuffle(
      items.map((a) => a.article).filter((t) => t && !JUNK.test(t)),
    ).slice(0, 60);

    const guests: Guest[] = [];
    for (const title of candidates) {
      if (guests.length >= count) break;
      const s = await fetchSummary(title);
      if (!s || !looksLikePerson(s)) continue;
      const name = (s.title ?? title).replace(/_/g, " ");
      guests.push({
        name,
        title: name,
        era: s.description ?? "Vikipedi'de popüler",
        blurb: s.extract ?? name,
        thumbnail: s.thumbnail?.source,
        color: colorForIndex(guests.length),
      });
    }
    if (guests.length >= count) return guests;
  }
  // Canlı mod yeterli kişi bulamadı: küratörlü havuza düş.
  return pickCuratedGuests(count);
}
