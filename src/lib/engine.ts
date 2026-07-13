import type { Guest, OpeningResult, RatingDecision, Stance, Utterance, DebateStyle } from "../types";
import { chat, chatStream, parseJsonLoose, ApiError, API_BASE } from "./deepseek";
import { detectTopicLang } from "./i18n";
import type { ChatMessage } from "./store";
import {
  introMessages,
  openingMessages,
  guestMessages,
  ratingDirectorMessages,
  suggestQuestionsMessages,
  guestSuggestMessages,
  castingMessages,
  moderationMessages,
  trendTopicsMessages,
  topicIdeasMessages,
  clashMessages,
  moderatorBridgeMessages,
  walkoutMessages,
  lastStandingMessages,
  type GuestRole,
} from "./prompts";

// Açık oturum konu fikirleri üretir (çoğu polemik-gündelik, azı derin).
// Yüksek sıcaklıkta model nadiren (~1/8) dejenere/bozuk JSON üretiyor;
// bu durumda sessizce boş dönmek yerine bir kez daha denenir — kullanıcı
// bunu neredeyse hiç görmez.
export async function suggestTopicIdeas(
  avoid: string[],
  apiKey: string | null,
  signal?: AbortSignal,
  deep = false,
  lang: "tr" | "en" = "tr",
): Promise<string[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content } = await chat(topicIdeasMessages(avoid, deep, lang), apiKey, {
      json: true,
      temperature: 1.1,
      max_tokens: 500,
      signal,
    });
    const parsed = parseJsonLoose<{ topics?: string[] }>(content);
    const topics = Array.isArray(parsed?.topics)
      ? parsed!.topics!.filter((t) => typeof t === "string" && t.trim()).slice(0, 8)
      : [];
    if (topics.length) return topics;
  }
  return [];
}

export interface ModerationVerdict {
  allowed: boolean;
  category: string;
  meaningful: boolean; // gerçek bir konu mu (gibberish "sdkfj" → false)
  debatable: boolean; // konunun gerçekten iki tarafı var mı (2×2=4 → false)
}

export interface TrendItem {
  title: string;
  traffic: string;
  snippets: string[];
}

// Ham gündemden türetilmiş, tartışmaya hazır konu (grounding bağlamıyla).
export interface TrendTopic {
  topic: string; // açık oturum konusu (cümle)
  context: string; // grounding metni (haber snippet'leri)
  source: string; // kaynak ham gündem başlığı
  traffic: string;
}

// Google Trends TR gündemini çeker (/api/context proxy'si üzerinden).
export async function fetchTrends(signal?: AbortSignal): Promise<TrendItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/context?action=trends`, { signal });
    const d = (await res.json()) as { trends?: TrendItem[] };
    return Array.isArray(d.trends) ? d.trends : [];
  } catch {
    return [];
  }
}

// Ham gündem terimlerini, haber bağlamıyla tartışmaya hazır konulara çevirir.
export async function curateTrendTopics(
  trends: TrendItem[],
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<TrendTopic[]> {
  if (trends.length === 0) return [];
  try {
    const { content } = await chat(trendTopicsMessages(trends), apiKey, {
      json: true,
      temperature: 0.8,
      max_tokens: 600,
      signal,
    });
    const parsed = parseJsonLoose<{ topics?: { i: number; konu: string }[] }>(content);
    const out: TrendTopic[] = [];
    for (const t of parsed?.topics ?? []) {
      const src = trends[t.i];
      if (!src || !t.konu?.trim()) continue;
      out.push({
        topic: t.konu.trim(),
        context: src.snippets.join(" • "),
        source: src.title,
        traffic: src.traffic,
      });
    }
    return out;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    if (e instanceof ApiError && (e.code === "RATE_LIMITED" || e.code === "NO_DEMO_KEY")) throw e;
    return [];
  }
}

// Bir Ekşi Sözlük başlığının entry'lerini grounding metni olarak çeker.
export async function fetchEksiContext(url: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/context?action=eksi&url=${encodeURIComponent(url)}`, {
      signal,
    });
    const d = (await res.json()) as { entries?: string[]; title?: string };
    if (!res.ok || !Array.isArray(d.entries)) return "";
    return d.entries.map((e) => `• ${e}`).join("\n");
  } catch {
    return "";
  }
}

// İçerik güvenliği kapısı. Auth hatasını yukarı iletir; başka hatada güvenli
// tarafta değil, akışı kırmamak için izin verir (persona içindeki hakaret
// sınırı ikincil koruma sağlar).
export async function moderateTopic(
  topic: string,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<ModerationVerdict> {
  try {
    const { content } = await chat(moderationMessages(topic), apiKey, {
      json: true,
      temperature: 0,
      max_tokens: 120,
      signal,
    });
    const p = parseJsonLoose<{ allowed?: boolean; category?: string; meaningful?: boolean; debatable?: boolean }>(content);
    if (p && typeof p.allowed === "boolean") {
      return { allowed: p.allowed, category: p.category ?? "", meaningful: p.meaningful !== false, debatable: p.debatable !== false };
    }
    return { allowed: true, category: "", meaningful: true, debatable: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    if (e instanceof ApiError && (e.code === "RATE_LIMITED" || e.code === "NO_DEMO_KEY")) throw e;
    return { allowed: true, category: "", meaningful: true, debatable: true };
  }
}

// Konuya göre ilgili kişi isimleri önerir (Vikipedi doğrulaması ayrı yapılır).
// Nadiren model bozuk/tamamlanmamış JSON döndürebilir; bir kez daha denenir.
export async function suggestGuestNames(
  topic: string,
  context: string | null,
  avoid: string[],
  apiKey: string | null,
  signal?: AbortSignal,
  popular = false,
  lang: "tr" | "en" = "tr",
): Promise<string[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content } = await chat(guestSuggestMessages(topic, context, avoid, popular, lang), apiKey, {
      json: true,
      temperature: 1.05,
      max_tokens: 400,
      signal,
    });
    const parsed = parseJsonLoose<{ names?: string[] }>(content);
    const names = Array.isArray(parsed?.names) ? parsed!.names!.filter((n) => typeof n === "string") : [];
    if (names.length) return names;
  }
  return [];
}

// Yapımcı: konukları karşıt pozisyonlara yerleştirir (guest index'ine göre dizi).
export interface CastResult {
  stances: (Stance | null)[];
  genders: ("male" | "female" | undefined)[];
  styles: (DebateStyle | undefined)[];
}

const DEBATE_STYLES = new Set<DebateStyle>([
  "agresif", "pasif-agresif", "alaycı", "bilgiç", "duygusal",
  "soğukkanlı", "provokatör", "arabulucu", "nükteli", "otoriter",
]);

export async function assignStances(
  guests: Guest[],
  topic: string,
  context: string | null,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<CastResult> {
  const stances: (Stance | null)[] = guests.map(() => null);
  const genders: ("male" | "female" | undefined)[] = guests.map(() => undefined);
  const styles: (DebateStyle | undefined)[] = guests.map(() => undefined);
  try {
    const { content } = await chat(castingMessages(guests, topic, context), apiKey, {
      json: true,
      temperature: 0.8,
      max_tokens: 500,
      signal,
    });
    const parsed = parseJsonLoose<{
      roles?: { i: number; pozisyon: string; aci: string; cinsiyet?: string; uslup?: string }[];
    }>(content);
    for (const r of parsed?.roles ?? []) {
      if (r.i >= 0 && r.i < guests.length) {
        stances[r.i] = { position: r.pozisyon || "Kısmen", angle: r.aci || "" };
        const c = (r.cinsiyet || "").toLocaleLowerCase("tr");
        if (c.startsWith("kad")) genders[r.i] = "female";
        else if (c.startsWith("erk")) genders[r.i] = "male";
        const u = (r.uslup || "").toLocaleLowerCase("tr").trim() as DebateStyle;
        if (DEBATE_STYLES.has(u)) styles[r.i] = u;
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Kadrolama başarısızsa pozisyonsuz devam (yine de fikir turu çalışır).
  }
  return { stances, genders, styles };
}

// Token akışını görünür metne yazar ve TAM metni biriktirip döndürür.
// Seslendirme burada YAPILMAZ; TTS'i App katmanındaki pace() tek noktadan yönetir
// (çift ses, iptal sinyali, anlık hız ve "ses kapalı" durumu orada ele alınır).
async function streamReply(
  msgs: ChatMessage[],
  apiKey: string | null,
  opts: { temperature: number; max_tokens: number },
  signal: AbortSignal | undefined,
  onToken: (t: string) => void,
): Promise<string> {
  let full = "";
  await chatStream(
    msgs,
    apiKey,
    (token) => {
      const ft = stripNonLatin(token);
      if (!ft) return;
      full += ft;
      onToken(ft);
    },
    { ...opts, signal },
  );
  // Akış hiç içerik üretmeden bittiyse bunu sessizce yutma (model/kota sorunu).
  if (!full.trim()) {
    throw new ApiError(
      "Sağlayıcı boş yanıt döndürdü. Model/kota sorunu olabilir — tekrar deneyin; sürerse farklı bir API anahtarı girin.",
      502,
      "EMPTY_CONTENT",
    );
  }
  return full;
}

export async function runIntro(
  guest: Guest,
  guests: Guest[],
  topic: string,
  _guestIndex: number,
  apiKey: string | null,
  signal?: AbortSignal,
  onToken?: (t: string) => void,
): Promise<string> {
  const msgs = introMessages(guest, guests, topic);
  if (onToken) {
    const full = await streamReply(
      msgs as ChatMessage[],
      apiKey,
      { temperature: 0.85, max_tokens: 260 },
      signal,
      onToken,
    );
    return cleanReply(full, guest.name);
  }
  const { content } = await chat(msgs as ChatMessage[], apiKey, {
    temperature: 0.85,
    max_tokens: 260,
    signal,
  });
  return cleanReply(content, guest.name);
}

// ── DİL GÜVENLİK AĞI ── Prompt ne kadar sert olursa olsun model ara sıra
// yanlış dile kayıyor (talimatlar Türkçe; özel personalar Türkçe). Cevap
// geldikten sonra dili DETERMİNİSTİK kontrol edilir; yanlışsa modele tek
// seferlik "aynı içeriği doğru dilde yeniden yaz" düzeltmesi yaptırılır.
function wrongLang(topic: string, reply: string): boolean {
  if (!reply.trim()) return false;
  return detectTopicLang(topic) !== detectTopicLang(reply);
}

async function rewriteInSessionLang(
  msgs: ChatMessage[],
  draft: string,
  topic: string,
  guestName: string,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const fix =
    detectTopicLang(topic) === "en"
      ? "STOP — you wrote in the WRONG LANGUAGE. Rewrite your reply ENTIRELY in the language of the session topic (English). Keep the same content, persona and tone; only fix the language. Output ONLY the rewritten reply text."
      : "DUR — YANLIŞ DİLDE yazdın. Repliğini aynı içerik, aynı karakter ve tonla TAMAMEN TÜRKÇE yeniden yaz. Sadece yeni replik metnini ver.";
  try {
    const { content } = await chat(
      [...msgs, { role: "assistant", content: draft }, { role: "user", content: fix }],
      apiKey,
      { temperature: 0.7, max_tokens: 460, signal },
    );
    const fixed = cleanReply(content, guestName);
    return fixed.trim() ? fixed : draft;
  } catch {
    return draft; // düzeltme başarısızsa taslağı koru (abort dahil)
  }
}

// Açılış görüşü JSON döndürür ({hasStance, text}); bu yüzden AKIŞ KULLANILMAZ
// (aksi halde ham JSON kullanıcıya sızardı). Tek seferde alınır, ayrıştırılır.
export async function runOpeningStatement(
  guest: Guest,
  guests: Guest[],
  topic: string,
  stance: Stance | null,
  context: string | null,
  _guestIndex: number,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<OpeningResult> {
  const msgs = openingMessages(guest, guests, topic, stance, context);
  const { content } = await chat(msgs as ChatMessage[], apiKey, {
    json: true,
    temperature: 0.85,
    max_tokens: 340,
    signal,
  });
  const parsed = parseJsonLoose<Partial<OpeningResult>>(content);
  let text =
    parsed && typeof parsed.text === "string" && parsed.text.trim()
      ? cleanReply(parsed.text, guest.name)
      : cleanReply(content, guest.name);
  const hasStance = parsed && typeof parsed.text === "string" ? parsed.hasStance !== false : true;
  if (wrongLang(topic, text)) {
    text = await rewriteInSessionLang(msgs as ChatMessage[], text, topic, guest.name, apiKey, signal);
  }
  return { text, hasStance };
}

// Yönetmen: sadece reyting + kısa koçluk (sırayı kod belirler).
export async function runRatingDirector(
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  nextName: string,
  role: GuestRole,
  lastModeratorNote: string | undefined,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<RatingDecision> {
  const { content } = await chat(
    ratingDirectorMessages(guests, topic, utterances, nextName, role, lastModeratorNote),
    apiKey,
    { json: true, temperature: 0.6, max_tokens: 160, signal },
  );
  const parsed = parseJsonLoose<Partial<RatingDecision>>(content);
  return {
    rating: clampRating(parsed?.rating),
    note: parsed?.note ?? "",
    cue: parsed?.cue,
  };
}

export async function runGuest(
  guest: Guest,
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  cue: string | undefined,
  role: GuestRole,
  stance: Stance | null,
  context: string | null,
  _guestIndex: number,
  apiKey: string | null,
  signal?: AbortSignal,
  onToken?: (t: string) => void,
): Promise<string> {
  const msgs = guestMessages(guest, guests, topic, utterances, cue, role, stance, context);
  let text: string;
  if (onToken) {
    const full = await streamReply(
      msgs as ChatMessage[],
      apiKey,
      { temperature: 0.9, max_tokens: 460 },
      signal,
      onToken,
    );
    text = cleanReply(full, guest.name);
  } else {
    const { content } = await chat(msgs as ChatMessage[], apiKey, {
      temperature: 0.9, max_tokens: 460, signal,
    });
    text = cleanReply(content, guest.name);
  }
  // Dil güvenlik ağı: yanlış dilde geldiyse aynı içeriği doğru dilde yazdır.
  if (wrongLang(topic, text)) {
    text = await rewriteInSessionLang(msgs as ChatMessage[], text, topic, guest.name, apiKey, signal);
  }
  return text;
}

// Kızışma: bir konuğun söz kesişi + kesilenin tersleyişi (tek çağrı, JSON).
export async function runClash(
  interrupter: Guest,
  speaker: Guest,
  topic: string,
  lastText: string,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<{ interrupt: string; retort: string }> {
  const { content } = await chat(clashMessages(interrupter, speaker, topic, lastText) as ChatMessage[], apiKey, {
    json: true,
    temperature: 0.95,
    max_tokens: 240,
    signal,
  });
  const parsed = parseJsonLoose<{ interrupt?: string; retort?: string }>(content);
  return {
    interrupt: typeof parsed?.interrupt === "string" ? parsed.interrupt.trim() : "",
    retort: typeof parsed?.retort === "string" ? parsed.retort.trim() : "",
  };
}

// Konuk öfkeyle masayı terk ederken ayrılık repliği.
export async function runWalkout(
  guest: Guest,
  guests: Guest[],
  topic: string,
  stance: Stance | null,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const { content } = await chat(walkoutMessages(guest, guests, topic, stance) as ChatMessage[], apiKey, {
    temperature: 0.9,
    max_tokens: 160,
    signal,
  });
  return cleanReply(content, guest.name);
}

// Masada tek kalan konuğun meydan okuyan kapanış özeti.
export async function runLastStanding(
  guest: Guest,
  guests: Guest[],
  topic: string,
  leftNames: string,
  stance: Stance | null,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const { content } = await chat(
    lastStandingMessages(guest, guests, topic, leftNames, stance) as ChatMessage[],
    apiKey,
    { temperature: 0.9, max_tokens: 240, signal },
  );
  return cleanReply(content, guest.name);
}

// Sunucu köprüsü: önceki konuşmayı özetleyip sözü sıradaki konuğa devreder.
export async function runModeratorBridge(
  prevName: string,
  prevText: string,
  nextName: string,
  topic: string,
  gunluk: boolean,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const { content } = await chat(
    moderatorBridgeMessages(prevName, prevText, nextName, topic, gunluk) as ChatMessage[],
    apiKey,
    { temperature: 0.7, max_tokens: 160, signal },
  );
  return cleanReply(content, "");
}

// Konuya göre kışkırtıcı spiker soruları.
export async function suggestQuestions(
  topic: string,
  guests: Guest[],
  utterances: Utterance[],
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string[]> {
  const { content } = await chat(suggestQuestionsMessages(topic, guests, utterances), apiKey, {
    json: true,
    temperature: 0.9,
    max_tokens: 400,
    signal,
  });
  const parsed = parseJsonLoose<{ questions?: string[] }>(content);
  return Array.isArray(parsed?.questions) ? parsed!.questions!.slice(0, 4) : [];
}

function clampRating(r: unknown): number {
  const n = typeof r === "number" ? r : 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Model bazen "İsim:" ön eki, tırnak veya sahne yönergesi ekler; temizle.
// Ayrıca Groq/Llama modellerinden sızabilen CJK, Kiril, Arapça karakterleri temizler.
function cleanReply(text: string, name: string): string {
  let t = text.trim();
  const prefix = new RegExp(`^${escapeRe(name)}\\s*[:：]-?\\s*`, "i");
  t = t.replace(prefix, "");
  t = t.replace(/^["'“”]|["'“”]$/g, "");
  t = t.replace(/^\((.*?)\)\s*/, "");
  return stripNonLatin(t.trim());
}

// Groq/Llama gibi modellerden araya sızabilen CJK (Çin/Japon/Kore),
// Kiril ve Arap alfabesi karakterlerini temizler.
function stripNonLatin(text: string): string {
  return text.replace(/[\u0400-\u052F\u0600-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u1100-\u11FF\u3040-\u312F\u3190-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uA960-\uA97F\uAC00-\uD7AF\uFF00-\uFFEF]+/g, "");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
