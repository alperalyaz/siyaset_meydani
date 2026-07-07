// Vercel serverless giriş noktası. Yerel geliştirmede aynı mantık
// vite.config.ts içindeki dev middleware üzerinden çalışır.
import { handleChat, type ChatRequestBody } from "./_lib/handler.js";

interface VercelLikeRequest {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

function clientIp(req: VercelLikeRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0]!.split(",")[0]!.trim();
  return req.socket?.remoteAddress || "unknown";
}

// Mobil (Capacitor) uygulama farklı origin'den (localhost) çağırır -> CORS gerekir.
function cors(res: VercelLikeResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-api-key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Yalnızca POST." });
    return;
  }

  const userKey = req.headers["x-user-api-key"];
  const key = Array.isArray(userKey) ? userKey[0] : userKey;

  let body: ChatRequestBody;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as ChatRequestBody;
  } catch {
    res.status(400).json({ error: "Geçersiz JSON." });
    return;
  }

  const result = await handleChat(body, key, clientIp(req));
  res.status(result.status).json(result.body);
}
