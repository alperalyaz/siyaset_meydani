// Vercel serverless giriş noktası — ElevenLabs TTS proxy'si.
// Yerel geliştirmede aynı mantık vite.config.ts dev middleware üzerinden çalışır.
import { handleTts, type TtsRequestBody } from "./_lib/tts.js";

interface VercelLikeRequest {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (data: unknown) => void;
  send: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

function clientIp(req: VercelLikeRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0]!.split(",")[0]!.trim();
  return req.socket?.remoteAddress || "unknown";
}

function cors(res: VercelLikeResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-eleven-key, x-gemini-key");
  res.setHeader("Access-Control-Expose-Headers", "x-tts-remaining, x-tts-byok");
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

  const ek = req.headers["x-eleven-key"];
  const gk = req.headers["x-gemini-key"];
  const elevenKey = Array.isArray(ek) ? ek[0] : ek;
  const geminiKey = Array.isArray(gk) ? gk[0] : gk;

  let body: TtsRequestBody;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as TtsRequestBody;
  } catch {
    res.status(400).json({ error: "Geçersiz JSON." });
    return;
  }

  const result = await handleTts(body, { eleven: elevenKey, gemini: geminiKey }, clientIp(req));
  if (result.headers) {
    Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  }
  if (result.audio) {
    res.setHeader("Content-Type", result.contentType || "audio/mpeg");
    res.status(result.status);
    // Vercel Node.js: Buffer gönder.
    (res as unknown as { send: (b: unknown) => void }).send(Buffer.from(result.audio));
    return;
  }
  res.status(result.status).json(result.body);
}
