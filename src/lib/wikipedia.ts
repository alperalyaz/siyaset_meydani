import type { Guest } from "../types";
import { PERSON_POOL, seedToGuest, colorForIndex, type Seed } from "./pool";
import { getCached, setCache } from "./cache";

const TR_SUMMARY = (title: string) =>
  `https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

const EN_SUMMARY = (title: string) =>
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

interface Summary {
  extract?: string;
  description?: string;
  thumbnail?: { source?: string };
  title?: string;
  wikibase_item?: string; // Wikidata Q-id
  type?: string;
}

// Bir Vikipedi başlığının canlı özetini belirtilen dilde çeker.
async function fetchSummaryFromWiki(
  wikiUrl: (title: string) => string,
  cachePrefix: string,
  title: string,
  retry = true,
): Promise<Summary | null> {
  const cacheKey = `${cachePrefix}:${title}`;
  const cached = getCached<Summary>(cacheKey);
  if (cached !== null) return cached;
  if (getCached<boolean>(`${cacheKey}:neg`) === true) return null;

  try {
    const res = await fetch(wikiUrl(title), {
      headers: { Accept: "application/json", "Api-User-Agent": "SiyasetMeydani/1.0" },
    });
    if (!res.ok) {
      if (retry && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 900));
        return fetchSummaryFromWiki(wikiUrl, cachePrefix, title, false);
      }
      setCache(`${cacheKey}:neg`, true, 30_000);
      return null;
    }
    const result = (await res.json()) as Summary;
    setCache(cacheKey, result, 5 * 60_000);
    return result;
  } catch {
    if (retry) {
      await new Promise((r) => setTimeout(r, 900));
      return fetchSummaryFromWiki(wikiUrl, cachePrefix, title, false);
    }
    setCache(`${cacheKey}:neg`, true, 30_000);
    return null;
  }
}

// TR Vikipedi özeti (mevcut davranış).
async function fetchTrSummary(title: string, retry = true): Promise<Summary | null> {
  return fetchSummaryFromWiki(TR_SUMMARY, "wp:summary", title, retry);
}

// EN Vikipedi özeti (fallback).
async function fetchEnSummary(title: string, retry = true): Promise<Summary | null> {
  return fetchSummaryFromWiki(EN_SUMMARY, "wp:en:summary", title, retry);
}

// Wikidata entity araması — açıklama döndürür.
interface WDEntity {
  id: string;
  descriptions?: Record<string, { value: string }>;
  labels?: Record<string, { value: string }>;
}

async function fetchWikidataDescription(
  title: string,
): Promise<{ description: string; label: string } | null> {
  const cacheKey = `wd:desc:${title}`;
  const cached = getCached<{ description: string; label: string } | null>(cacheKey);
  if (cached !== undefined) return cached;
  if (getCached<boolean>(`${cacheKey}:neg`) === true) return null;

  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      title,
    )}&language=en&limit=3&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      setCache(`${cacheKey}:neg`, true, 60_000);
      return null;
    }
    const searchData = (await searchRes.json()) as { search?: WDEntity[] };
    const candidates = searchData.search ?? [];
    if (candidates.length === 0) {
      setCache(`${cacheKey}:neg`, true, 60_000);
      return null;
    }

    const qid = candidates[0].id;
    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(
      qid,
    )}.json`;
    const entityRes = await fetch(entityUrl);
    if (!entityRes.ok) {
      setCache(`${cacheKey}:neg`, true, 60_000);
      return null;
    }
    const entityData = (await entityRes.json()) as {
      entities?: Record<string, WDEntity>;
    };
    const entity = entityData.entities?.[qid];
    if (!entity) {
      setCache(`${cacheKey}:neg`, true, 60_000);
      return null;
    }

    const desc =
      entity.descriptions?.en?.value ||
      entity.descriptions?.tr?.value ||
      Object.values(entity.descriptions ?? {})[0]?.value ||
      "";
    const label =
      entity.labels?.en?.value ||
      entity.labels?.tr?.value ||
      Object.values(entity.labels ?? {})[0]?.value ||
      title;
    const result = { description: desc, label };
    setCache(cacheKey, result, 10 * 60_000);
    return result;
  } catch {
    setCache(`${cacheKey}:neg`, true, 30_000);
    return null;
  }
}

// Konuk bilgisi çekmek için birleşik fallback zinciri.
// TR → EN → Wikidata → minimal
interface EnrichedInfo {
  name: string;
  era: string;
  blurb: string;
  thumbnail: string | undefined;
  summaryStatus: Guest["summaryStatus"];
}

async function resolveGuestInfo(name: string): Promise<EnrichedInfo> {
  // 1) TR Vikipedi
  const tr = await fetchTrSummary(name);
  if (tr && (!tr.type || tr.type === "standard")) {
    const title = (tr.title ?? name).replace(/_/g, " ");
    return {
      name: title,
      era: tr.description ?? "",
      blurb: tr.extract && tr.extract.length > 40 ? tr.extract : title,
      thumbnail: tr.thumbnail?.source,
      summaryStatus: "ok",
    };
  }

  // 2) EN Vikipedi — aynı başlıkla dene
  const en = await fetchEnSummary(name);
  if (en && (!en.type || en.type === "standard")) {
    const title = (en.title ?? name).replace(/_/g, " ");
    return {
      name: title,
      era: en.description ?? "",
      blurb: en.extract && en.extract.length > 40 ? en.extract : title,
      thumbnail: en.thumbnail?.source,
      summaryStatus: "en_wiki",
    };
  }

  // 3) Wikidata
  const wd = await fetchWikidataDescription(name);
  if (wd) {
    const nm = wd.label.replace(/_/g, " ").trim() || name.replace(/_/g, " ").trim();
    return {
      name: nm,
      era: wd.description || "",
      blurb: wd.description || nm,
      thumbnail: undefined,
      summaryStatus: "en_wiki",
    };
  }

  // 4) Hiçbir kaynakta yok
  const nm = name.replace(/_/g, " ").trim();
  return {
    name: nm,
    era: "",
    blurb: nm,
    thumbnail: undefined,
    summaryStatus: "minimal",
  };
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
  const s = await fetchTrSummary(seed.title);
  if (s?.extract && s.extract.length > 40) {
    base.blurb = s.extract;
  }
  if (s?.thumbnail?.source) {
    base.thumbnail = s.thumbnail.source;
  }
  if (s) base.gender = (await classifyPerson(s)).gender;
  base.summaryStatus = s ? "ok" : "minimal";
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
  const cacheKey = `wd:person:${qid}`;
  const cached = getCached<{ isHuman: boolean | null; gender: Gender }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(
      qid,
    )}&property=P31|P21&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) {
      const fallback = { isHuman: null, gender: undefined as Gender };
      setCache(cacheKey, fallback, 60_000);
      return fallback;
    }
    const data = (await res.json()) as {
      claims?: {
        P31?: { mainsnak?: { datavalue?: { value?: { id?: string } } } }[];
        P21?: { mainsnak?: { datavalue?: { value?: { id?: string } } } }[];
      };
    };
    const p31 = data.claims?.P31;
    const isHuman = p31 ? p31.some((c) => c.mainsnak?.datavalue?.value?.id === "Q5") : false;
    const g = data.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id;
    const gender: Gender =
      g === "Q6581097" || g === "Q2449503"
        ? "male"
        : g === "Q6581072" || g === "Q1052281"
          ? "female"
          : undefined;
    const result = { isHuman, gender };
    setCache(cacheKey, result, 30 * 60_000);
    return result;
  } catch {
    const fallback = { isHuman: null, gender: undefined as Gender };
    setCache(cacheKey, fallback, 30_000);
    return fallback;
  }
}

// Tartışma masasına konuk olarak oturtulması saygısızlık olacak, dinlerin
// kutsal saydığı figürler. HARDCODED liste (kelime filtresi değil): yalnızca
// çözümlenen Vikipedi başlığı bu isimlerden biriyle TAM eşleşirse elenir.
const SACRED_TITLES = new Set([
  "muhammed", "muhammad", "muhamed", "hz. muhammed",
  "isa", "îsâ", "isa mesih", "mesih",
  "musa", "mûsâ",
  "ibrahim", "i̇brahim",
  "nuh", "nûh",
  "adem", "âdem",
  "davud", "dâvûd",
  "yûsuf",
  "yakup", "yâkub",
  "ishak", "i̇shak",
  "ismail", "i̇smail", "ismâil",
  "harun", "hârûn",
  "ilyas", "i̇lyas", "elyesa",
  "zekeriya", "zekeriyya",
  "yahya", "yahyâ",
  "eyyub", "eyyûb",
  "idris", "i̇dris",
  "hud", "hûd",
  "lut", "lût",
  "şuayb", "zülkifl", "üzeyir",
  "buda", "buddha", "gautama buda", "siddhartha gautama",
  "krishna", "krişna", "zerdüşt", "zarathustra",
  "allah", "meryem", "aziz meryem",
]);

const BLOCKED_TITLES = new Set([
  "recep tayyip erdoğan",
  "recep tayyip erdogan",
  "mustafa kemal atatürk",
  "mustafa kemal ataturk",
  "atatürk",
  "ataturk",
  "mustafa kemal",
]);

function normTitle(t: string): string {
  return t
    .toLocaleLowerCase("tr")
    .replace(/\s*\(.*?\)\s*$/, "")
    .trim();
}

export function isBlockedGuest(s: Summary): boolean {
  const title = normTitle(s.title ?? "");
  if (BLOCKED_TITLES.has(title)) return true;
  if (SACRED_TITLES.has(title)) return true;
  if (SACRED_TITLES.has(title.replace(/^hz\.?\s+/, ""))) return true;
  return false;
}

async function classifyPerson(s: Summary): Promise<{ isPerson: boolean; gender: Gender }> {
  if (s.wikibase_item) {
    const info = await fetchPersonInfo(s.wikibase_item);
    if (info.isHuman !== null) return { isPerson: info.isHuman, gender: info.gender };
  }
  return { isPerson: looksLikePerson(s), gender: undefined };
}

export function isBlockedName(name: string): boolean {
  const t = normTitle(name);
  if (BLOCKED_TITLES.has(t)) return true;
  const bare = t.replace(/^hz\.?\s+/, "");
  return SACRED_TITLES.has(t) || SACRED_TITLES.has(bare);
}

export async function buildGuestsFromNames(names: string[], count = 3): Promise<Guest[]> {
  const guests: Guest[] = [];
  const used = new Set<string>();
  const add = (g: Guest) => {
    const k = g.name.toLowerCase();
    if (used.has(k)) return;
    used.add(k);
    guests.push(g);
  };

  for (const name of shuffle(names)) {
    if (guests.length >= count) break;
    if (isBlockedName(name)) continue;
    const info = await resolveGuestInfo(name);
    if (info.summaryStatus === "minimal") {
      add({
        name: info.name,
        title: info.name,
        era: "",
        blurb: info.name,
        color: colorForIndex(guests.length),
        summaryStatus: "minimal",
      });
      continue;
    }
    add({
      name: info.name,
      title: info.name,
      era: info.era,
      blurb: info.blurb,
      thumbnail: info.thumbnail,
      color: colorForIndex(guests.length),
      summaryStatus: info.summaryStatus,
    });
  }

  // SON ÇARE: en az 2 konuk yoksa küratörlü havuzdan tamamla (nadir).
  if (guests.length < 2) {
    for (const seed of shuffle(PERSON_POOL)) {
      if (guests.length >= count) break;
      if (used.has(seed.name.toLowerCase())) continue;
      guests.push(await enrich(seed, guests.length));
      used.add(seed.name.toLowerCase());
    }
  }
  return guests.map((g, i) => ({ ...g, color: colorForIndex(i) }));
}

export type ResolveResult =
  | { status: "ok"; guest: Guest }
  | { status: "blocked" }
  | { status: "notfound" };

export async function resolveGuestByName(query: string): Promise<ResolveResult> {
  const q = query.trim();
  if (!q) return { status: "notfound" };

  let candidates: string[] = [];
  const urlMatch = q.match(/wikipedia\.org\/wiki\/([^?#]+)/i);
  if (urlMatch) {
    candidates = [decodeURIComponent(urlMatch[1]).replace(/_/g, " ")];
  } else {
    // TR Vikipedi opensearch
    try {
      const res = await fetch(
        `https://tr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
          q,
        )}&limit=5&namespace=0&format=json&origin=*`,
      );
      if (res.ok) {
        const data = (await res.json()) as [string, string[]];
        if (Array.isArray(data?.[1])) candidates.push(...data[1]);
      }
    } catch {
      /* yoksay */
    }
    // TR'de bulunamadıysa EN opensearch'i de dene
    if (candidates.length === 0) {
      try {
        const enRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
            q,
          )}&limit=5&namespace=0&format=json&origin=*`,
        );
        if (enRes.ok) {
          const enData = (await enRes.json()) as [string, string[]];
          if (Array.isArray(enData?.[1])) candidates.push(...enData[1]);
        }
      } catch {
        /* yoksay */
      }
    }
    if (candidates.length === 0) candidates = [q];
  }

  for (const title of candidates) {
    const info = await resolveGuestInfo(title);
    if (info.summaryStatus === "minimal") continue;
    // Engelli isim kontrolü (orijinal title ile, info.name İngilizce ad olabilir)
    if (isBlockedName(title) || isBlockedName(info.name)) return { status: "blocked" };
    return {
      status: "ok",
      guest: {
        name: info.name,
        title: info.name,
        era: info.era,
        blurb: info.blurb,
        thumbnail: info.thumbnail,
        color: colorForIndex(0),
        summaryStatus: info.summaryStatus,
      },
    };
  }
  return { status: "notfound" };
}

function recentDateParts(daysAgo: number): [string, string, string] {
  const dt = new Date(Date.now() - daysAgo * 86400000);
  const y = String(dt.getUTCFullYear());
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return [y, m, d];
}

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
      const s = await fetchTrSummary(title);
      if (!s || (s.type && s.type !== "standard")) continue;
      if (isBlockedGuest(s)) continue;
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
  return pickCuratedGuests(count);
}

// Eski fetchSummary ihracı — geriye uyumluluk için TR'ye yönlendirir.
export const fetchSummary = fetchTrSummary;
