// Güncel bağlam uç noktası: Google Trends TR gündemi + Ekşi başlık entry'leri.
import { handleContext } from "./_lib/context.js";

interface Req {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
}
interface Res {
  status: (c: number) => Res;
  json: (d: unknown) => void;
  setHeader: (n: string, v: string) => void;
}

function param(req: Req, key: string): string | undefined {
  const q = req.query?.[key];
  if (typeof q === "string") return q;
  if (Array.isArray(q)) return q[0];
  // Vercel bazen query vermez; URL'den ayıkla.
  if (req.url) {
    try {
      const u = new URL(req.url, "http://x");
      return u.searchParams.get(key) ?? undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const result = await handleContext(param(req, "action"), param(req, "url"));
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(result.status).json(result.body);
}
