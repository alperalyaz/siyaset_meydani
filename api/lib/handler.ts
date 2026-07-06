// Sağlayıcıdan bağımsız sohbet proxy'si. Şu an DeepSeek (OpenAI uyumlu) kullanır.
// İki mod:
//   - Demo modu: sunucudaki DEEPSEEK_API_KEY ile, IP başına günlük limitle.
//   - BYOK modu: kullanıcının kendi anahtarıyla, limitsiz.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

// Demo modunda IP başına günlük istek limiti. Ortam değişkeniyle ayarlanabilir.
const DEMO_DAILY_LIMIT = Number(process.env.DEMO_DAILY_LIMIT ?? "40");

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  json?: boolean;
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

// En basit, en dürüst limitleyici: bellek içi sayaç. Serverless soğuk başlangıçta
// sıfırlanır — gerçek üretimde Supabase/KV gibi kalıcı bir depoyla değiştirin.
type Bucket = { day: string; count: number };
const buckets = new Map<string, Bucket>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function rateLimitStatus(ip: string): { allowed: boolean; remaining: number } {
  const day = today();
  const b = buckets.get(ip);
  if (!b || b.day !== day) {
    return { allowed: DEMO_DAILY_LIMIT > 0, remaining: DEMO_DAILY_LIMIT };
  }
  return { allowed: b.count < DEMO_DAILY_LIMIT, remaining: Math.max(0, DEMO_DAILY_LIMIT - b.count) };
}

function consume(ip: string): void {
  const day = today();
  const b = buckets.get(ip);
  if (!b || b.day !== day) {
    buckets.set(ip, { day, count: 1 });
  } else {
    b.count += 1;
  }
}

export async function handleChat(
  body: ChatRequestBody,
  userApiKey: string | undefined,
  ip: string,
): Promise<HandlerResult> {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { status: 400, body: { error: "messages alanı gerekli." } };
  }

  const byok = Boolean(userApiKey && userApiKey.trim());
  const apiKey = byok ? userApiKey!.trim() : process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      status: 503,
      body: {
        error:
          "Demo anahtarı ayarlı değil. Kendi DeepSeek API anahtarınızı girerek devam edebilirsiniz.",
        code: "NO_DEMO_KEY",
      },
    };
  }

  // Demo modunda limit uygula.
  if (!byok) {
    const { allowed, remaining } = rateLimitStatus(ip);
    if (!allowed) {
      return {
        status: 429,
        body: {
          error:
            "Bugünkü ücretsiz deneme hakkınız doldu. Kendi DeepSeek API anahtarınızı girerek sınırsız devam edebilirsiniz.",
          code: "RATE_LIMITED",
          remaining,
        },
      };
    }
    consume(ip);
  }

  const payload: Record<string, unknown> = {
    model: body.model || DEFAULT_MODEL,
    messages: body.messages,
    temperature: body.temperature ?? 0.9,
    max_tokens: body.max_tokens ?? 400,
    stream: false,
  };
  if (body.json) {
    payload.response_format = { type: "json_object" };
  }

  let upstream: Response;
  try {
    upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      status: 502,
      body: { error: "Sağlayıcıya ulaşılamadı.", detail: String(err) },
    };
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return {
      status: upstream.status,
      body: {
        error: "Sağlayıcı hatası.",
        status: upstream.status,
        detail: text.slice(0, 500),
      },
    };
  }

  const data = (await upstream.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";

  const remaining = byok ? null : rateLimitStatus(ip).remaining;

  return {
    status: 200,
    body: { content, remaining, byok },
  };
}
