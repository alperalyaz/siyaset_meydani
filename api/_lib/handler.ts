// Sağlayıcıdan bağımsız sohbet proxy'si. OpenAI uyumlu iki sağlayıcıyı
// destekler ve anahtarın önekinden otomatik seçer:
//   - DeepSeek ("sk-..."):  demo modunda sunucu anahtarı burada.
//   - Groq ("gsk_..."):     kullanıcılar ücretsiz anahtar alabilir.
// İki mod:
//   - Demo modu: sunucudaki DEEPSEEK_API_KEY ile, IP başına günlük limitle.
//   - BYOK modu: kullanıcının kendi anahtarıyla (DeepSeek veya Groq), limitsiz.

interface Provider {
  name: "deepseek" | "groq";
  url: string;
  model: string;
}

function providerForKey(key: string): Provider {
  if (key.startsWith("gsk_")) {
    return {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }
  return {
    name: "deepseek",
    url: "https://api.deepseek.com/chat/completions",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  };
}

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
          "Demo şu an kullanılamıyor. Kendi API anahtarınızı (Groq ücretsiz ya da DeepSeek) girerek devam edebilirsiniz.",
        code: "NO_DEMO_KEY",
      },
    };
  }

  const provider = providerForKey(apiKey);

  // Demo modunda limit uygula.
  if (!byok) {
    const { allowed, remaining } = rateLimitStatus(ip);
    if (!allowed) {
      return {
        status: 429,
        body: {
          error:
            "Ücretsiz deneme hakkınız doldu. Kendi API anahtarınızı (Groq ücretsiz ya da DeepSeek) girerek sınırsız devam edebilirsiniz.",
          code: "RATE_LIMITED",
          remaining,
        },
      };
    }
    consume(ip);
  }

  const payload: Record<string, unknown> = {
    model: body.model || provider.model,
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
    upstream = await fetch(provider.url, {
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
