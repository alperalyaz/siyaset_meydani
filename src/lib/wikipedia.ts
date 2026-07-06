import type { Guest } from "../types";
import { PERSON_POOL, seedToGuest, colorForIndex, type Seed } from "./pool";

const TR_SUMMARY = (title: string) =>
  `https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

interface Summary {
  extract?: string;
  description?: string;
  thumbnail?: { source?: string };
  title?: string;
  wikibase_item?: string; // Wikidata Q-id
  type?: string;
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
  if (s) base.gender = (await classifyPerson(s)).gender;
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

type Gender = "male" | "female" | undefined;

// Wikidata'dan tek çağrıda hem "insan mı (P31=Q5)" hem "cinsiyet (P21)" bilgisi.
// isHuman null = doğrulanamadı (ağ hatası vb.).
async function fetchPersonInfo(
  qid: string,
): Promise<{ isHuman: boolean | null; gender: Gender }> {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(
      qid,
    )}&property=P31|P21&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return { isHuman: null, gender: undefined };
    const data = (await res.json()) as {
      claims?: {
        P31?: { mainsnak?: { datavalue?: { value?: { id?: string } } } }[];
        P21?: { mainsnak?: { datavalue?: { value?: { id?: string } } } }[];
      };
    };
    const p31 = data.claims?.P31;
    const isHuman = p31 ? p31.some((c) => c.mainsnak?.datavalue?.value?.id === "Q5") : false;
    const g = data.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id;
    // Q6581097 = erkek, Q6581072 = kadın (trans erkek/kadın da erkek/kadın sesine map'lenir)
    const gender: Gender =
      g === "Q6581097" || g === "Q2449503"
        ? "male"
        : g === "Q6581072" || g === "Q1052281"
          ? "female"
          : undefined;
    return { isHuman, gender };
  } catch {
    return { isHuman: null, gender: undefined };
  }
}

// Bir maddenin gerçekten bir KİŞİ olduğunu doğrular + cinsiyetini döndürür.
async function classifyPerson(s: Summary): Promise<{ isPerson: boolean; gender: Gender }> {
  if (s.wikibase_item) {
    const info = await fetchPersonInfo(s.wikibase_item);
    if (info.isHuman !== null) return { isPerson: info.isHuman, gender: info.gender };
  }
  return { isPerson: looksLikePerson(s), gender: undefined };
}

// Bir isim listesinden (LLM önerisi) gerçek kişileri seçip Vikipedi ile zenginleştirir.
// Yeterli kişi bulunamazsa küratörlü havuzdan tamamlar.
export async function buildGuestsFromNames(names: string[], count = 3): Promise<Guest[]> {
  const guests: Guest[] = [];
  const used = new Set<string>();
  // Önerilen isimleri karıştır: hep ilk "bariz" 3'ü değil, sürprizli kombinasyonlar.
  for (const name of shuffle(names)) {
    if (guests.length >= count) break;
    const s = await fetchSummary(name);
    if (!s || (s.type && s.type !== "standard")) continue;
    const cls = await classifyPerson(s);
    if (!cls.isPerson) continue;
    const title = (s.title ?? name).replace(/_/g, " ");
    if (used.has(title.toLowerCase())) continue;
    used.add(title.toLowerCase());
    guests.push({
      name: title,
      title,
      era: s.description ?? "",
      blurb: s.extract && s.extract.length > 40 ? s.extract : `${title} hakkında konuk.`,
      thumbnail: s.thumbnail?.source,
      color: colorForIndex(guests.length),
      gender: cls.gender,
    });
  }
  // Eksik kaldıysa küratörlü havuzdan tamamla.
  for (const seed of shuffle(PERSON_POOL)) {
    if (guests.length >= count) break;
    if (used.has(seed.name.toLowerCase())) continue;
    used.add(seed.name.toLowerCase());
    guests.push(await enrich(seed, guests.length));
  }
  return guests.map((g, i) => ({ ...g, color: colorForIndex(i) }));
}

// Kullanıcının yazdığı ismi (ya da Vikipedi linkini) gerçek bir kişiye çözer.
export async function resolveGuestByName(query: string): Promise<Guest | null> {
  const q = query.trim();
  if (!q) return null;

  let candidates: string[] = [];
  const urlMatch = q.match(/wikipedia\.org\/wiki\/([^?#]+)/i);
  if (urlMatch) {
    candidates = [decodeURIComponent(urlMatch[1]).replace(/_/g, " ")];
  } else {
    try {
      const res = await fetch(
        `https://tr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
          q,
        )}&limit=5&namespace=0&format=json&origin=*`,
      );
      if (res.ok) {
        const data = (await res.json()) as [string, string[]];
        candidates = Array.isArray(data?.[1]) ? data[1] : [];
      }
    } catch {
      /* yoksay */
    }
    if (candidates.length === 0) candidates = [q];
  }

  for (const title of candidates) {
    const s = await fetchSummary(title);
    if (!s || (s.type && s.type !== "standard")) continue;
    const cls = await classifyPerson(s);
    if (!cls.isPerson) continue;
    const name = (s.title ?? title).replace(/_/g, " ");
    return {
      name,
      title: name,
      era: s.description ?? "",
      blurb: s.extract && s.extract.length > 40 ? s.extract : name,
      thumbnail: s.thumbnail?.source,
      color: colorForIndex(0),
      gender: cls.gender,
    };
  }
  return null;
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
      if (!s || (s.type && s.type !== "standard")) continue;
      const cls = await classifyPerson(s);
      if (!cls.isPerson) continue;
      const name = (s.title ?? title).replace(/_/g, " ");
      guests.push({
        name,
        title: name,
        era: s.description ?? "Vikipedi'de popüler",
        blurb: s.extract ?? name,
        thumbnail: s.thumbnail?.source,
        color: colorForIndex(guests.length),
        gender: cls.gender,
      });
    }
    if (guests.length >= count) return guests;
  }
  // Canlı mod yeterli kişi bulamadı: küratörlü havuza düş.
  return pickCuratedGuests(count);
}
