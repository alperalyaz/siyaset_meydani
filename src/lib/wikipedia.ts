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

// Wikidata'da adı arar ve adaylar arasından KİŞİ görünen ilkini seçer.
// Eski Türkçe/alternatif adları da yakalar: "Eflatun" araması renk maddesini
// değil, takma adı Eflatun olan Platon'u (Yunan filozofu) döndürür.
async function fetchWikidataDescription(
  title: string,
): Promise<{ description: string; label: string } | null> {
  const cacheKey = `wd:desc:${title}`;
  const cached = getCached<{ description: string; label: string }>(cacheKey);
  if (cached !== null) return cached;
  if (getCached<boolean>(`${cacheKey}:neg`) === true) return null;

  interface WDSearchItem {
    id: string;
    label?: string;
    description?: string;
  }

  try {
    for (const lang of ["tr", "en"] as const) {
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
        title,
      )}&language=${lang}&uselang=tr&limit=5&format=json&origin=*`;
      const res = await fetch(searchUrl);
      if (!res.ok) continue;
      const data = (await res.json()) as { search?: WDSearchItem[] };
      const person = (data.search ?? []).find(
        (c) => c.description && descLooksLikePerson(c.description),
      );
      if (person) {
        const result = {
          description: person.description ?? "",
          label: person.label || title,
        };
        setCache(cacheKey, result, 10 * 60_000);
        return result;
      }
    }
    setCache(`${cacheKey}:neg`, true, 60_000);
    return null;
  } catch {
    setCache(`${cacheKey}:neg`, true, 30_000);
    return null;
  }
}

// LLM'den gelen adı Vikipedi'nin sevdiği biçime getirir:
// "Soyad, Ad" → "Ad Soyad"; alt çizgi ve fazla boşluk temizliği.
function normalizeName(raw: string): string {
  let n = raw.replace(/_/g, " ").trim();
  const m = n.match(/^([^,]+),\s*(.+)$/);
  if (m) n = `${m[2].trim()} ${m[1].trim()}`;
  return n.replace(/\s+/g, " ");
}

// Arama sonucu gerçekten aranan kişi mi? Alakasız ilk sonucu (ör. "Sesil B.
// DeMille" araması "Richard Dix" döndürebilir) elemek için sorgu ile başlık en
// az bir anlamlı (4+ harf) kelimeyi paylaşmalı. Aksan/farklı harfler eşitlenir.
function titleMatchesQuery(title: string, query: string): boolean {
  const norm = (s: string) =>
    s
      .toLocaleLowerCase("tr")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  const tokens = new Set(
    norm(title)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4),
  );
  return norm(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
    .some((w) => tokens.has(w));
}

// Tam metin arama (CirrusSearch) — yazım hatasına/ters sıraya toleranslı.
// Sonuç yoksa API'nin "bunu mu demek istediniz" önerisiyle bir kez daha dener.
async function searchWikiTitle(lang: "tr" | "en", query: string): Promise<string | null> {
  const cacheKey = `wp:${lang}:search:${query}`;
  const cached = getCached<string>(cacheKey);
  if (cached !== null) return cached;
  if (getCached<boolean>(`${cacheKey}:neg`) === true) return null;

  const searchOnce = async (q: string): Promise<{ title: string | null; suggestion?: string }> => {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        q,
      )}&srlimit=1&srnamespace=0&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return { title: null };
      const data = (await res.json()) as {
        query?: { search?: { title: string }[]; searchinfo?: { suggestion?: string } };
      };
      return {
        title: data.query?.search?.[0]?.title ?? null,
        suggestion: data.query?.searchinfo?.suggestion,
      };
    } catch {
      return { title: null };
    }
  };

  let { title, suggestion } = await searchOnce(query);
  // İlk sonuç alakasızsa (isim örtüşmesi yok) güvenme; öneriyle tekrar dene.
  if (title && !titleMatchesQuery(title, query)) title = null;
  if (!title && suggestion && suggestion !== query) {
    ({ title } = await searchOnce(suggestion));
    if (title && !titleMatchesQuery(title, suggestion)) title = null;
  }
  if (title) {
    setCache(cacheKey, title, 10 * 60_000);
    return title;
  }
  setCache(`${cacheKey}:neg`, true, 60_000);
  return null;
}

// Konuk bilgisi çekmek için birleşik fallback zinciri.
// TR → EN → TR arama → EN arama → Wikidata → minimal
interface EnrichedInfo {
  name: string;
  era: string;
  blurb: string;
  thumbnail: string | undefined;
  summaryStatus: Guest["summaryStatus"];
}

function summaryToInfo(s: Summary, fallbackName: string, status: Guest["summaryStatus"]): EnrichedInfo {
  const title = (s.title ?? fallbackName).replace(/_/g, " ");
  return {
    name: title,
    era: s.description ?? "",
    blurb: s.extract && s.extract.length > 40 ? s.extract : title,
    thumbnail: s.thumbnail?.source,
    summaryStatus: status,
  };
}

// Standart ve KİŞİ görünen sayfa mı? ("Eflatun" gibi eş-adlı renk/kavram
// maddeleri kabul edilmez — zincir bir sonraki adıma düşer.)
function acceptablePersonPage(s: Summary | null): s is Summary {
  return !!s && (!s.type || s.type === "standard") && looksLikePerson(s);
}

async function resolveGuestInfo(rawName: string): Promise<EnrichedInfo> {
  const name = normalizeName(rawName);

  // 1) TR Vikipedi — doğrudan başlık
  const tr = await fetchTrSummary(name);
  if (acceptablePersonPage(tr)) return summaryToInfo(tr, name, "ok");

  // 2) EN Vikipedi — doğrudan başlık
  const en = await fetchEnSummary(name);
  if (acceptablePersonPage(en)) return summaryToInfo(en, name, "en_wiki");

  // 3) Wikidata — kişi tercihli arama. Metin aramasından ÖNCE: eski/alternatif
  //    adı gerçek kişiye çevirir (Eflatun → Platon), metin araması ise aynı
  //    kelimeli alakasız sayfalara ("Eflatun Pınar" anıtı) kayabilir. Bulunan
  //    etiketle Vikipedi bir kez daha denenir ki foto/özet de gelsin.
  const wd = await fetchWikidataDescription(name);
  if (wd) {
    const label = wd.label.replace(/_/g, " ").trim() || name;
    if (label.toLocaleLowerCase("tr") !== name.toLocaleLowerCase("tr")) {
      const s2 = await fetchTrSummary(label);
      if (acceptablePersonPage(s2)) return summaryToInfo(s2, label, "ok");
      const s3 = await fetchEnSummary(label);
      if (acceptablePersonPage(s3)) return summaryToInfo(s3, label, "en_wiki");
    }
    return {
      name: label,
      era: wd.description || "",
      blurb: wd.description || label,
      thumbnail: undefined,
      summaryStatus: "en_wiki",
    };
  }

  // 4) TR tam metin arama — LLM'in bozuk yazımını ("Soyad, Ad", ufak typo)
  //    gerçek maddeye eşler.
  const trHit = await searchWikiTitle("tr", name);
  if (trHit) {
    const s = await fetchTrSummary(trHit);
    if (acceptablePersonPage(s)) return summaryToInfo(s, trHit, "ok");
  }

  // 5) EN tam metin arama
  const enHit = await searchWikiTitle("en", name);
  if (enHit) {
    const s = await fetchEnSummary(enHit);
    if (acceptablePersonPage(s)) return summaryToInfo(s, enHit, "en_wiki");
  }

  // 6) Hiçbir kaynakta yok
  return { name, era: "", blurb: name, thumbnail: undefined, summaryStatus: "minimal" };
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

// Özet/açıklamadan "bu bir insan mı" sezgisi (TR + EN meslek/rol sözcükleri).
// Eş-adlılık tuzağına karşı ("Eflatun" TR'de RENK maddesi!) çözümleme
// zinciri yalnızca bu sezgiden geçen sayfaları kabul eder.
const OCCUPATION =
  /(oyuncu|şarkıcı|futbolcu|sporcu|siyaset|yazar|şair|padişah|sultan|hükümdar|bilim|matematik|müzisyen|yönetmen|sanatçı|sanatkâr|komutan|imparator|kağan|filozof|hekim|ressam|besteci|kraliç|kral|prens|başbakan|cumhurbaşkan|sunucu|komedyen|gazeteci|tarihçi|mimar|iktisat|ekonomist|aktör|aktris|model|dansçı|rapçi|fenomen|iş insanı|işadamı|medya|hoca|âlim|alim|bilge|general|mareşal|amiral|denizci|kâşif|kaşif|mucit|mühendis|doktor|psikolog|sosyolog|antropolog|aktivist|devrimci|lider|teknik direktör|antrenör|pilot|astronot|avukat|hukukçu|diplomat|stratejist|teolog|keşiş|derviş|mutasavvıf|philosopher|singer|actor|actress|writer|author|politician|statesman|footballer|athlete|player|scientist|physicist|chemist|biologist|mathematician|painter|artist|composer|musician|emperor|king|queen|poet|director|filmmaker|comedian|presenter|host|businessman|entrepreneur|rapper|dancer|explorer|inventor|engineer|physician|monarch|ruler|warrior|hunter|journalist|historian|architect|economist|activist|revolutionary|leader|general|admiral|pilot|astronaut|lawyer|diplomat|strategist|theologian|monk|scholar)/i;
const BIRTH = /\bd\.?\s?\d{3,4}\b|doğ(du|umlu)|\bborn\b|\b\d{3,4}\s?[-–]\s?\d{3,4}\b|\bMÖ\b|\bBCE?\b/i;

function looksLikePerson(s: Summary): boolean {
  const hay = `${s.description ?? ""} ${s.extract ?? ""}`;
  return OCCUPATION.test(hay) || BIRTH.test(hay);
}

// Yalnızca kısa açıklama metniyle (Wikidata) kişi sezgisi.
function descLooksLikePerson(desc: string): boolean {
  return OCCUPATION.test(desc) || BIRTH.test(desc);
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

export async function buildGuestsFromNames(
  names: string[],
  count = 3,
  opts: { preserveOrder?: boolean } = {},
): Promise<Guest[]> {
  const guests: Guest[] = [];
  const used = new Set<string>();
  const add = (g: Guest) => {
    const k = g.name.toLowerCase();
    if (used.has(k)) return;
    used.add(k);
    guests.push(g);
  };

  // preserveOrder: liste kasıtlı bir karışım sırası taşıyor (2 pop : 1 klasik);
  // karıştırmak oranı bozar. Normal modda çeşitlilik için karıştırılır.
  for (const name of opts.preserveOrder ? names : shuffle(names)) {
    if (guests.length >= count) break;
    if (isBlockedName(name)) continue;
    const info = await resolveGuestInfo(name);
    if (isBlockedName(info.name)) continue; // arama engelli kişiye çözülmüş olabilir
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
