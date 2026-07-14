import type { ChatMessage, ProviderKind } from "./store";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

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
  provider?: ProviderKind,
): Promise<ChatResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userApiKey && userApiKey.trim()) {
    headers["x-user-api-key"] = userApiKey.trim();
  }

  const body: Record<string, unknown> = {
    messages,
    json: opts.json ?? false,
    temperature: opts.temperature,
    max_tokens: opts.max_tokens,
  };
  if (provider) body.provider = provider;

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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

  // Sağlayıcı 200 dönüp içerik BOŞ bırakabiliyor (model/kota/parametre
  // sorunu). Bunu sessizce yutmak "hiçbir şey olmuyor" hissi yaratır;
  // hata olarak fırlat ki arayüz kullanıcıya söyleyebilsin.
  if (!(data.content ?? "").trim()) {
    throw new ApiError(
      "Sağlayıcı boş yanıt döndürdü. Model/kota sorunu olabilir — tekrar deneyin; sürerse farklı bir API anahtarı girin.",
      502,
      "EMPTY_CONTENT",
    );
  }

  return {
    content: data.content ?? "",
    remaining: data.remaining ?? null,
    byok: data.byok ?? false,
  };
}

export function parseJsonLoose<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = text.slice(start, end + 1);
      try {
        return JSON.parse(slice) as T;
      } catch {
        // En sık hata: model bir string DEĞERİNİN içine gerçek satır başı /
        // sekme (kaçışsız kontrol karakteri) koyuyor; JSON.parse bunu reddeder.
        // String içindeyken kontrol karakterlerini kaçışlayıp yeniden dene.
        try {
          return JSON.parse(escapeControlCharsInStrings(slice)) as T;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

// JSON metninde YALNIZCA string değerlerin içindeki kaçışsız kontrol
// karakterlerini (satır başı, sekme, CR) geçerli kaçış dizilerine çevirir.
// String dışındaki boşluklara dokunmaz (aralarındaki newline JSON'da geçerli).
function escapeControlCharsInStrings(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      out += c;
      esc = false;
      continue;
    }
    if (c === "\\") {
      out += c;
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      out += c;
      continue;
    }
    if (inStr) {
      if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else out += c;
    } else {
      out += c;
    }
  }
  return out;
}

// Token bazında yayın (streaming). OpenAI uyumlu SSE akışını okur,
// her token için onToken callback'ini çağırır.
export async function chatStream(
  messages: ChatMessage[],
  userApiKey: string | null,
  onToken: (token: string) => void,
  opts: ChatOptions = {},
  provider?: ProviderKind,
): Promise<{ remaining: number | null; byok: boolean }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userApiKey && userApiKey.trim()) {
    headers["x-user-api-key"] = userApiKey.trim();
  }

  const body: Record<string, unknown> = {
    messages,
    stream: true,
    temperature: opts.temperature,
    max_tokens: opts.max_tokens,
  };
  if (provider) body.provider = provider;

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error || "Bilinmeyen hata.", res.status, data.code);
  }

  if (!res.body) {
    throw new ApiError("Akış desteklenmiyor.", 0);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr) as {
            choices?: { delta?: { content?: string } }[];
          };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch {
          /* bozuk SSE satırını yoksay */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  lastMeta = { remaining: null, byok: !!userApiKey };
  return { remaining: null, byok: !!userApiKey };
}
