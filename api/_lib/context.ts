// Güncel konu bağlamı sağlayıcı: Google Trends TR gündemi + (istenirse) bir
// Ekşi Sözlük başlığının entry'leri. Karakterleri güncel olaylarda topraklamak
// (grounding) için kullanılır — model bilmese de "ne oldu"yu buradan öğrenir.

export interface TrendItem {
  title: string;
  traffic: string;
  snippets: string[];
}

export interface ContextResult {
  status: number;
  body: unknown;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Google Trends TR günlük gündemini çeker (başlık + trafik + haber snippet'leri).
export async function fetchTrends(): Promise<ContextResult> {
  let xml: string;
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=TR", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/rss+xml, application/xml" },
    });
    if (!res.ok) return { status: 502, body: { error: "Trends alınamadı.", status: res.status } };
    xml = await res.text();
  } catch (e) {
    return { status: 502, body: { error: "Trends'e ulaşılamadı.", detail: String(e) } };
  }

  const items: TrendItem[] = [];
  const blocks = xml.split("<item>").slice(1);
  for (const b of blocks) {
    const titleM = b.match(/<title>(.*?)<\/title>/s);
    if (!titleM) continue;
    const title = decode(titleM[1]);
    if (!title) continue;
    const traffic = decode((b.match(/approx_traffic>(.*?)</s) ?? [, ""])[1]);
    const snippets = [...b.matchAll(/news_item_title>(.*?)<\/ht:news_item_title>/gs)]
      .map((m) => decode(m[1]))
      .filter(Boolean)
      .slice(0, 3);
    items.push({ title, traffic, snippets });
  }

  return { status: 200, body: { trends: items.slice(0, 14) } };
}

// Bir Ekşi Sözlük başlığının entry'lerini çeker (yalnızca eksisozluk.com).
export async function fetchEksiEntries(url: string): Promise<ContextResult> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { status: 400, body: { error: "Geçersiz URL." } };
  }
  if (!/(^|\.)eksisozluk\.com$/.test(u.hostname)) {
    return { status: 400, body: { error: "Yalnızca eksisozluk.com başlıkları." } };
  }

  let hthtml: string;
  try {
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) return { status: 502, body: { error: "Başlık alınamadı.", status: res.status } };
    hthtml = await res.text();
  } catch (e) {
    return { status: 502, body: { error: "Ekşi'ye ulaşılamadı.", detail: String(e) } };
  }

  const titleM = hthtml.match(/<h1[^>]*id="title"[^>]*>.*?<a[^>]*>(.*?)<\/a>/s);
  const title = titleM ? decode(titleM[1]) : u.pathname.replace(/^\//, "").replace(/--\d+$/, "");
  const entries = [...hthtml.matchAll(/<div class="content"[^>]*>(.*?)<\/div>/gs)]
    .map((m) => decode(m[1]))
    .filter((t) => t.length > 15)
    .slice(0, 8);

  if (entries.length === 0) {
    return { status: 404, body: { error: "Entry bulunamadı.", title } };
  }
  return { status: 200, body: { title, entries } };
}

export async function handleContext(
  action: string | undefined,
  url: string | undefined,
): Promise<ContextResult> {
  if (action === "trends") return fetchTrends();
  if (action === "eksi") {
    if (!url) return { status: 400, body: { error: "url gerekli." } };
    return fetchEksiEntries(url);
  }
  return { status: 400, body: { error: "Geçersiz action." } };
}
