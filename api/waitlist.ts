// Premium bekleme listesi — e-posta toplar (Supabase RPC).
// İsteğe bağlı: RESEND_API_KEY ayarlıysa kaydolana "teşekkürler" maili gönderir.
interface Req {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function addToWaitlist(email: string, lang: string, source: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const res = await fetch(`${url}/rest/v1/rpc/siyaset_waitlist_add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_email: email, p_lang: lang, p_source: source }),
  });
  return res.ok;
}

// Opsiyonel onay maili (yalnızca RESEND_API_KEY ve RESEND_FROM ayarlıysa).
async function sendConfirmation(email: string, lang: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM; // ör. "debate.be <hello@debate.be>"
  if (!apiKey || !from) return;
  const en = lang === "en";
  const subject = en ? "You're on the debate.be Premium list 🎙️" : "debate.be Premium listesindesin 🎙️";
  const html = en
    ? `<p>Thanks for your interest in <b>debate.be Premium</b>!</p><p>You're on the list — we'll email you the moment it launches (unlimited HD voices, no API keys, priority).</p><p>— debate.be</p>`
    : `<p><b>debate.be Premium</b>'e gösterdiğin ilgi için teşekkürler!</p><p>Listeye eklendin — açıldığı an sana haber vereceğiz (sınırsız HD ses, anahtar derdi yok, öncelik).</p><p>— debate.be</p>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: email, subject, html }),
    });
  } catch {
    /* mail başarısızsa kayıt yine de tutuldu — sessiz geç */
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Yalnızca POST." });
    return;
  }

  let body: { email?: string; lang?: string; source?: string };
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as typeof body;
  } catch {
    res.status(400).json({ error: "Geçersiz JSON.", code: "BAD_REQUEST" });
    return;
  }

  const email = (body?.email ?? "").toString().trim().toLowerCase();
  const lang = body?.lang === "en" ? "en" : "tr";
  const source = (body?.source ?? "settings").toString().slice(0, 40);
  if (!EMAIL_RE.test(email) || email.length > 200) {
    res.status(400).json({ error: "Geçerli bir e-posta girin.", code: "BAD_EMAIL" });
    return;
  }

  const ok = await addToWaitlist(email, lang, source);
  if (!ok) {
    res.status(503).json({ error: "Liste şu an kullanılamıyor.", code: "NO_STORE" });
    return;
  }
  void sendConfirmation(email, lang); // fire-and-forget
  res.status(200).json({ ok: true });
}
