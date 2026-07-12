// Vercel serverless — yayınlanan oturum galerisi API'si.
//   POST   /api/gallery                 → oturumu yayınla {slug, token, url}
//   GET    /api/gallery?slug=xxx        → tek oturum (JSON)
//   GET    /api/gallery?list=12         → son yayınlar listesi
//   DELETE /api/gallery?slug=&token=    → kendi yayınını kaldır
import { publishSession, getSession, listSessions, deleteSession, type PublishBody } from "./_lib/gallery.js";

interface Req {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

function q(req: Req, key: string): string {
  const v = req.query?.[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  // query parse edilmemişse URL'den çöz
  try {
    const u = new URL(req.url ?? "", "http://x");
    return u.searchParams.get(key) ?? "";
  } catch {
    return "";
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "POST") {
    let body: PublishBody;
    try {
      body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as PublishBody;
    } catch {
      res.status(400).json({ error: "Geçersiz JSON." });
      return;
    }
    const out = await publishSession(body);
    res.status(out.status).json(out.body);
    return;
  }

  if (req.method === "GET") {
    const slug = q(req, "slug");
    if (slug) {
      const s = await getSession(slug);
      if (!s) {
        res.status(404).json({ error: "Oturum bulunamadı.", code: "NOT_FOUND" });
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
      res.status(200).json(s);
      return;
    }
    const limit = Number(q(req, "list") || "12");
    const items = await listSessions(Number.isFinite(limit) ? limit : 12);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
    res.status(200).json({ items });
    return;
  }

  if (req.method === "DELETE") {
    const ok = await deleteSession(q(req, "slug"), q(req, "token"));
    res.status(ok ? 200 : 403).json({ ok });
    return;
  }

  res.status(405).json({ error: "Desteklenmeyen metod." });
}
