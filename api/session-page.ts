// Vercel serverless — /s/:slug için SUNUCUDAN üretilen HTML transkript sayfası.
// Amaç: yayınlanan oturumların Google tarafından İNDEKSLENEBİLİR olması
// (SPA'nın aksine içerik doğrudan HTML'de). vercel.json rewrite:
//   /s/:slug → /api/session-page?slug=:slug
import { getSession, esc } from "./_lib/gallery.js";

interface Req {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  send: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  let slug = "";
  const v = req.query?.slug;
  if (typeof v === "string") slug = v;
  else if (Array.isArray(v)) slug = v[0] ?? "";
  if (!slug) {
    try {
      slug = new URL(req.url ?? "", "http://x").searchParams.get("slug") ?? "";
    } catch {
      /* yoksay */
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const s = slug ? await getSession(slug) : null;
  if (!s) {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(404).send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Oturum bulunamadı · debate.be</title><meta name="robots" content="noindex"></head><body style="font-family:system-ui;background:#0b0e1a;color:#e8ecf8;display:grid;place-items:center;min-height:100vh"><div style="text-align:center"><h1>Oturum bulunamadı</h1><p>Bu yayın kaldırılmış ya da hiç var olmamış olabilir.</p><p><a style="color:#f2b134" href="/">debate.be ana sayfa →</a></p></div></body></html>`);
    return;
  }

  const en = s.lang === "en";
  const title = `${s.topic} · debate.be`;
  const guestNames = s.guests.map((g) => g.name).join(", ");
  const desc = en
    ? `AI panel debate: ${guestNames} discuss "${s.topic}". Read the full transcript on debate.be.`
    : `Yapay zekâ açık oturumu: ${guestNames} "${s.topic}" konusunu tartışıyor. Tam transkript debate.be'de.`;
  const disclaimer = en
    ? "This transcript is a FICTIONAL, AI-generated portrayal published with the host's consent. It does not reflect the real views of the people named."
    : "Bu transkript, spikerin (kullanıcının) rızasıyla yayınlanmış KURGUSAL bir yapay zekâ canlandırmasıdır. Adı geçen kişilerin gerçek görüşlerini yansıtmaz.";
  const watch = en ? "▶ Watch / host your own debate" : "▶ İzle / kendi oturumunu aç";
  const guestsLabel = en ? "At the table" : "Masadakiler";
  const host = en ? "HOST" : "SPİKER";

  const turns = s.utterances
    .map((u) => {
      const name = u.speaker === "moderator" ? host : esc(s.guests[Number(u.speaker)]?.name ?? "?");
      const color = u.speaker === "moderator" ? "#f2b134" : esc(s.guests[Number(u.speaker)]?.color ?? "#7ea0ff");
      const sys = u.mode === "system";
      return `<article class="turn${sys ? " sys" : ""}"><h3 style="color:${color}">${name}</h3><p>${esc(u.text)}</p></article>`;
    })
    .join("\n");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: s.topic.slice(0, 110),
    about: s.topic,
    inLanguage: s.lang,
    datePublished: s.created_at,
    author: { "@type": "Organization", name: "debate.be" },
    publisher: { "@type": "Organization", name: "debate.be", url: "https://debate.be" },
  });

  const html = `<!doctype html>
<html lang="${esc(s.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="https://debate.be/s/${esc(s.slug)}">
<meta property="og:site_name" content="debate.be">
<meta property="og:title" content="${esc(s.topic)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="https://debate.be/s/${esc(s.slug)}">
<meta property="og:type" content="article">
<meta property="og:image" content="https://debate.be/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd}</script>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0b0e1a; color:#e8ecf8; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; line-height:1.6; }
  .wrap { max-width:760px; margin:0 auto; padding:2rem 1.2rem 4rem; }
  .brand { color:#f2b134; font-weight:800; text-decoration:none; font-size:1.1rem; }
  h1 { font-size:1.7rem; line-height:1.3; margin:.8rem 0 .4rem; }
  .meta { color:#9aa6c8; font-size:.9rem; margin-bottom:1.6rem; }
  .turn { background:#141a30; border:1px solid #232c4d; border-radius:14px; padding: .9rem 1.1rem; margin: .8rem 0; }
  .turn h3 { margin:0 0 .35rem; font-size:1rem; }
  .turn p { margin:0; white-space:pre-wrap; }
  .turn.sys { background:transparent; border-style:dashed; color:#9aa6c8; }
  .cta { display:inline-block; margin:1.4rem 0; background:linear-gradient(135deg,#f2b134,#e08c2b); color:#1a1405; font-weight:800; padding:.75rem 1.3rem; border-radius:12px; text-decoration:none; }
  .disc { color:#8a94b5; font-size:.78rem; border-top:1px solid #232c4d; padding-top:1rem; margin-top:2rem; }
</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="/">debate.be</a>
  <h1>${esc(s.topic)}</h1>
  <div class="meta">${esc(guestsLabel)}: ${esc(guestNames)}</div>
  ${turns}
  <a class="cta" href="/?s=${esc(s.slug)}">${esc(watch)}</a>
  <p class="disc">${esc(disclaimer)}</p>
</div>
</body>
</html>`;

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  res.status(200).send(html);
}
