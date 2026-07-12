// Vercel serverless — dinamik sitemap: ana sayfa + yayınlanan tüm oturumlar.
// vercel.json rewrite: /sitemap.xml → /api/sitemap
import { listSessions, esc } from "./_lib/gallery.js";

interface Req {
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  send: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

export default async function handler(_req: Req, res: Res): Promise<void> {
  const items = await listSessions(1000);
  const urls = [
    `  <url><loc>https://debate.be/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...items.map(
      (s) =>
        `  <url><loc>https://debate.be/s/${esc(s.slug)}</loc><lastmod>${esc((s.created_at ?? "").slice(0, 10))}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
    ),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=1800");
  res.status(200).send(xml);
}
