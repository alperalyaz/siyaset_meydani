// Vercel serverless — /oturumlar için SUNUCUDAN üretilen oturum dizini.
//
// NEDEN VAR: /s/:slug sayfaları YETİMDİ. Ana sayfanın HTML'i tarayıcıya
// <div id="root"></div> olarak gidiyor; galeri JavaScript ile çiziliyor,
// üstelik arayüz diline göre süzülüp 8 kayıtla sınırlanıyor. Yani Google'ın
// bu sayfalardan haberi olmasının tek yolu sitemap'ti — sitemap ise bir oy
// değil, yalnızca bir ihbardır. Bu sayfa TÜM oturumları tek yerde, gerçek
// <a href> bağlantılarıyla listeler; her transkript sayfası böylece bir iç
// bağlantı kazanır.
//
// vercel.json rewrite: /oturumlar → /api/sessions-page
import { listSessions, esc, type GalleryListItem } from "./_lib/gallery.js";

interface Req {
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  send: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

function tarih(iso: string | undefined, en: boolean): string {
  const t = (iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  const [y, a, g] = t.split("-");
  const ayTR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const ayEN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ay = (en ? ayEN : ayTR)[Number(a) - 1] ?? a;
  return en ? `${g} ${ay} ${y}` : `${Number(g)} ${ay} ${y}`;
}

function kart(s: GalleryListItem): string {
  const en = s.lang === "en";
  const konuklar = (s.guestNames ?? []).slice(0, 4).map(esc).join(" × ");
  return `<li class="row">
  <a class="row__link" href="/s/${esc(s.slug)}">
    <span class="row__topic">${esc(s.topic)}</span>
    <span class="row__meta">${konuklar}${konuklar ? " · " : ""}<span class="row__date">${esc(tarih(s.created_at, en))}</span><span class="row__lang">${en ? "EN" : "TR"}</span></span>
  </a>
</li>`;
}

export default async function handler(_req: Req, res: Res): Promise<void> {
  const items = await listSessions(1000);

  const baslik = "Yayınlanan oturumlar · debate.be";
  const aciklama =
    items.length > 0
      ? `debate.be'de yayınlanan ${items.length} yapay zekâ açık oturumunun tam listesi. Tarihin farklı çağlarından isimler aynı masada tartışıyor — tam transkriptler.`
      : "debate.be'de yayınlanan yapay zekâ açık oturumlarının listesi.";

  const liste = items.length
    ? `<ul class="list">\n${items.map(kart).join("\n")}\n</ul>`
    : `<p class="bos">Henüz yayınlanmış oturum yok. <a href="/">İlk oturumu siz açın →</a></p>`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Yayınlanan oturumlar",
    url: "https://debate.be/oturumlar",
    inLanguage: ["tr", "en"],
    isPartOf: { "@type": "WebSite", name: "debate.be", url: "https://debate.be" },
    hasPart: items.slice(0, 200).map((s) => ({
      "@type": "Article",
      headline: s.topic.slice(0, 110),
      url: `https://debate.be/s/${s.slug}`,
      inLanguage: s.lang,
      datePublished: s.created_at,
    })),
  });

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(baslik)}</title>
<meta name="description" content="${esc(aciklama)}">
<link rel="canonical" href="https://debate.be/oturumlar">
<meta property="og:site_name" content="debate.be">
<meta property="og:title" content="Yayınlanan oturumlar · debate.be">
<meta property="og:description" content="${esc(aciklama)}">
<meta property="og:url" content="https://debate.be/oturumlar">
<meta property="og:type" content="website">
<meta property="og:image" content="https://debate.be/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd}</script>
<script defer src="/_vercel/insights/script.js"></script>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0b0e1a; color:#e8ecf8; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; line-height:1.6; }
  .wrap { max-width:760px; margin:0 auto; padding:2rem 1.2rem 4rem; }
  .brand { color:#f2b134; font-weight:800; text-decoration:none; font-size:1.1rem; }
  h1 { font-size:1.7rem; line-height:1.3; margin:.8rem 0 .4rem; }
  .lead { color:#9aa6c8; margin:0 0 1.8rem; }
  .list { list-style:none; margin:0; padding:0; display:grid; gap:.7rem; }
  .row__link { display:block; background:#141a30; border:1px solid #232c4d; border-radius:14px; padding:.9rem 1.1rem; text-decoration:none; color:inherit; }
  .row__link:hover { border-color:#3a4674; background:#171e38; }
  .row__topic { display:block; font-weight:600; font-size:1.02rem; margin-bottom:.25rem; }
  .row__meta { display:block; color:#9aa6c8; font-size:.85rem; }
  .row__date { margin-left:.4rem; }
  .row__lang { margin-left:.5rem; border:1px solid #2f3a61; border-radius:4px; padding:0 .3rem; font-size:.72rem; }
  .cta { display:inline-block; margin:1.8rem 0 0; background:linear-gradient(135deg,#f2b134,#e08c2b); color:#1a1405; font-weight:800; padding:.75rem 1.3rem; border-radius:12px; text-decoration:none; }
  .bos { color:#9aa6c8; }
  .bos a, .lead a { color:#f2b134; }
</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="/">debate.be</a>
  <h1>Yayınlanan oturumlar</h1>
  <p class="lead">Kullanıcıların yayınlamayı seçtiği açık oturumların tam listesi${items.length ? ` — ${items.length} oturum` : ""}. Her biri baştan sona okunabilir.</p>
  ${liste}
  <a class="cta" href="/">▶ Kendi oturumunu aç</a>
</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=1800");
  res.status(200).send(html);
}
