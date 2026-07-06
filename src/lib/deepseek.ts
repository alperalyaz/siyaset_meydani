import type { ChatMessage } from "./store";

export interface ChatOptions {
  json?: boolean;
  temperature?: number;
  max_tokens?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  remaining: number | null;
  byok: boolean;
}

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Son başarılı isteğin meta bilgisi (demo hakkı / BYOK durumu).
// App bu değeri her çağrıdan sonra okuyup arayüze yansıtır.
export interface Meta {
  remaining: number | null;
  byok: boolean;
}
let lastMeta: Meta = { remaining: null, byok: false };
export function getLastMeta(): Meta {
  return lastMeta;
}

// Tarayıcıdan /api/chat proxy'sine gider. BYOK anahtarı varsa header'da taşınır
// (yalnızca istekte kullanılır, hiçbir yerde saklanmaz).
export async function chat(
  messages: ChatMessage[],
  userApiKey: string | null,
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userApiKey && userApiKey.trim()) {
    headers["x-user-api-key"] = userApiKey.trim();
  }

  const res = await fetch("/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages,
      json: opts.json ?? false,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
    }),
    signal: opts.signal,
  });

  const data = (await res.json().catch(() => ({}))) as {
    content?: string;
    remaining?: number | null;
    byok?: boolean;
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new ApiError(data.error || "Bilinmeyen hata.", res.status, data.code);
  }

  lastMeta = { remaining: data.remaining ?? null, byok: data.byok ?? false };
  return {
    content: data.content ?? "",
    remaining: data.remaining ?? null,
    byok: data.byok ?? false,
  };
}

// JSON modunda güvenli ayrıştırma (model bazen fazladan metin ekleyebilir).
export function parseJsonLoose<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
