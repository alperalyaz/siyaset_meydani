// Çoklu sağlayıcı sohbet proxy'si. OpenAI uyumlu üç sağlayıcıyı
// destekler ve anahtarın önekinden otomatik seçer:
//   - DeepSeek ("sk-..."):  demo modunda sunucu anahtarı burada.
//   - OpenAI ("sk-proj-..." veya "sk-"):  kullanıcı kendi anahtarını girer.
//   - Anthropic ("sk-ant-..."):   farklı API formatı — handler'da çeviri yapılır.
// İstemci "provider" alanı göndererek de sağlayıcıyı belirtebilir.
// İki mod:
//   - Demo modu: sunucudaki DEEPSEEK_API_KEY ile, IP başına günlük limitle.
//   - BYOK modu: kullanıcının kendi anahtarıyla, limitsiz.

type ProviderName = "deepseek" | "openai" | "anthropic";

interface Provider {
  name: ProviderName;
  url: string;
  model: string;
}

function detectProvider(key: string): ProviderName {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  if (key.startsWith("gsk_")) return "deepseek"; // Groq as deepseek compatible
  return "deepseek";
}

function providerForKey(key: string): Provider {
  const name = detectProvider(key);
  switch (name) {
    case "anthropic":
      return {
        name: "anthropic",
        url: "https://api.anthropic.com/v1/messages",
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      };
    case "openai":
      return {
        name: "openai",
        url: "https://api.openai.com/v1/chat/completions",
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      };
    default:
      return {
        name: "deepseek",
        url: "https://api.deepseek.com/chat/completions",
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      };
  }
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
  stream?: boolean;
  provider?: ProviderName;
}

export interface HandlerResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  stream?: ReadableStream<Uint8Array>;
}

// Demo sayacı: kalıcı olması için Supabase RPC'si (SUPABASE_URL + SUPABASE_ANON_KEY
// ayarlıysa). Ayarlı değilse bellek içi yedeğe düşer (serverless'ta sıfırlanır).
type Bucket = { day: string; count: number };
const buckets = new Map<string, Bucket>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function consumeMemory(ip: string): number {
  const day = today();
  const b = buckets.get(ip);
  if (!b || b.day !== day) {
    buckets.set(ip, { day, count: 1 });
    return 1;
  }
  b.count += 1;
  return b.count;
}

async function consumeDemo(ip: string): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/siyaset_demo_touch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ p_ip: ip }),
      });
      if (res.ok) {
        const data = await res.json();
        const n = typeof data === "number" ? data : Number(data);
        if (Number.isFinite(n)) return n;
      }
    } catch {
      /* Supabase erişilemedi */
    }
  }
  return consumeMemory(ip);
}

function buildAnthropicPayload(
  body: ChatRequestBody,
): { url: string; headers: Record<string, string>; payload: Record<string, unknown> } {
  const provider = providerForKey("sk-ant-xxx");
  const systemMsg = body.messages.find((m) => m.role === "system");
  const chatMsgs = body.messages.filter((m) => m.role !== "system");

  const anthropicMessages = chatMsgs.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const payload: Record<string, unknown> = {
    model: body.model || provider.model,
    messages: anthropicMessages,
    max_tokens: body.max_tokens ?? 400,
  };

  if (systemMsg) {
    payload.system = systemMsg.content;
  }

  // Anthropic doesn't support temperature with json_object
  if (!body.json && body.temperature !== undefined) {
    payload.temperature = body.temperature;
  }

  if (!body.stream) {
    // For JSON responses, prefill assistant with "{" to guide format
    if (body.json) {
      const lastMsg = anthropicMessages[anthropicMessages.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        lastMsg.content += "\n\nYalnızca şu JSON'u döndür, başka hiçbir şey yazma:";
      }
    }
  }

  return {
    url: provider.url,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "", // filled later
      "anthropic-version": "2023-06-01",
    },
    payload,
  };
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
        error: "Demo şu an kullanılamıyor. Kendi API anahtarınızı girerek devam edebilirsiniz.",
        code: "NO_DEMO_KEY",
      },
    };
  }

  const providerName = body.provider || detectProvider(apiKey);
  const provider = providerForKey(apiKey);

  // Demo modunda limit uygula (kalıcı Supabase sayacı).
  let demoRemaining: number | null = null;
  if (!byok) {
    const used = await consumeDemo(ip);
    demoRemaining = Math.max(0, DEMO_DAILY_LIMIT - used);
    if (used > DEMO_DAILY_LIMIT) {
      return {
        status: 429,
        body: {
          error: "Ücretsiz deneme hakkınız doldu. Kendi API anahtarınızı girerek sınırsız devam edebilirsiniz.",
          code: "RATE_LIMITED",
          remaining: 0,
        },
      };
    }
  }

  const useStream = body.stream === true && !body.json;

  // --- Anthropic özel işleme ---
  if (providerName === "anthropic") {
    const ap = buildAnthropicPayload(body);
    ap.headers["x-api-key"] = apiKey;

    let upstream: Response | undefined;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        upstream = await fetch(ap.url, { method: "POST", headers: ap.headers, body: JSON.stringify(ap.payload) });
      } catch (err) {
        if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, (attempt + 1) * 1500)); continue; }
        return { status: 502, body: { error: "Anthropic'e ulaşılamadı.", detail: String(err) } };
      }
      if (upstream.ok) break;
      if ((upstream.status === 429 || upstream.status === 503) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      const text = await upstream.text().catch(() => "");
      return { status: upstream.status, body: { error: "Anthropic hatası.", status: upstream.status, detail: text.slice(0, 500) } };
    }
    if (!upstream) return { status: 502, body: { error: "Beklenmeyen hata." } };

    const adata = (await upstream.json()) as { content?: { text?: string }[] };
    const content = adata.content?.[0]?.text ?? "";
    return { status: 200, body: { content, remaining: demoRemaining, byok } };
  }

  // --- OpenAI / DeepSeek (OpenAI uyumlu) ---
  const payload: Record<string, unknown> = {
    model: body.model || provider.model,
    messages: body.messages,
    temperature: body.temperature ?? 0.9,
    max_tokens: body.max_tokens ?? 400,
    stream: useStream,
  };
  if (body.json) {
    payload.response_format = { type: "json_object" };
  }

  let upstream: Response | undefined;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      return { status: 502, body: { error: "Sağlayıcıya ulaşılamadı.", detail: String(err) } };
    }

    if (upstream.ok) break;

    if ((upstream.status === 429 || upstream.status === 503) && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
      continue;
    }

    const text = await upstream.text().catch(() => "");
    return { status: upstream.status, body: { error: "Sağlayıcı hatası.", status: upstream.status, detail: text.slice(0, 500) } };
  }

  if (!upstream) return { status: 502, body: { error: "Beklenmeyen hata." } };

  if (useStream && upstream.body) {
    return {
      status: 200,
      body: { remaining: demoRemaining, byok },
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
      stream: upstream.body,
    };
  }

  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";

  return { status: 200, body: { content, remaining: demoRemaining, byok } };
}
