import type { Guest, OpeningResult, RatingDecision, Stance, Utterance } from "../types";
import { chat, parseJsonLoose } from "./deepseek";
import {
  introMessages,
  openingMessages,
  guestMessages,
  ratingDirectorMessages,
  suggestQuestionsMessages,
  guestSuggestMessages,
  castingMessages,
  type GuestRole,
} from "./prompts";

// Konuya göre ilgili kişi isimleri önerir (Vikipedi doğrulaması ayrı yapılır).
export async function suggestGuestNames(
  topic: string,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string[]> {
  const { content } = await chat(guestSuggestMessages(topic), apiKey, {
    json: true,
    temperature: 0.95,
    max_tokens: 200,
    signal,
  });
  const parsed = parseJsonLoose<{ names?: string[] }>(content);
  return Array.isArray(parsed?.names) ? parsed!.names!.filter((n) => typeof n === "string") : [];
}

// Yapımcı: konukları karşıt pozisyonlara yerleştirir (guest index'ine göre dizi).
export async function assignStances(
  guests: Guest[],
  topic: string,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<(Stance | null)[]> {
  const result: (Stance | null)[] = guests.map(() => null);
  try {
    const { content } = await chat(castingMessages(guests, topic), apiKey, {
      json: true,
      temperature: 0.8,
      max_tokens: 450,
      signal,
    });
    const parsed = parseJsonLoose<{
      roles?: { i: number; pozisyon: string; aci: string }[];
    }>(content);
    for (const r of parsed?.roles ?? []) {
      if (r.i >= 0 && r.i < guests.length) {
        result[r.i] = { position: r.pozisyon || "Kısmen", angle: r.aci || "" };
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Kadrolama başarısızsa pozisyonsuz devam (yine de fikir turu çalışır).
  }
  return result;
}

// Tanışma turu: konuk kendini kısaca tanıtır (konuya girmeden).
export async function runIntro(
  guest: Guest,
  guests: Guest[],
  topic: string,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const { content } = await chat(introMessages(guest, guests, topic), apiKey, {
    temperature: 0.85,
    max_tokens: 180,
    signal,
  });
  return cleanReply(content, guest.name);
}

// Görüş turu: konuk net tezini söyler ya da dürüstçe pas geçer.
export async function runOpeningStatement(
  guest: Guest,
  guests: Guest[],
  topic: string,
  stance: Stance | null,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<OpeningResult> {
  const { content } = await chat(openingMessages(guest, guests, topic, stance), apiKey, {
    json: true,
    temperature: 0.85,
    max_tokens: 240,
    signal,
  });
  const parsed = parseJsonLoose<Partial<OpeningResult>>(content);
  if (parsed && typeof parsed.text === "string" && parsed.text.trim()) {
    return { text: cleanReply(parsed.text, guest.name), hasStance: parsed.hasStance !== false };
  }
  // JSON bozuksa: içeriği düz metin kabul et, tez var say.
  return { text: cleanReply(content, guest.name), hasStance: true };
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

// Bir konuğun tartışma repliği.
export async function runGuest(
  guest: Guest,
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  cue: string | undefined,
  role: GuestRole,
  stance: Stance | null,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const { content } = await chat(
    guestMessages(guest, guests, topic, utterances, cue, role, stance),
    apiKey,
    { temperature: 0.9, max_tokens: 230, signal },
  );
  return cleanReply(content, guest.name);
}

// Konuya göre kışkırtıcı spiker soruları.
export async function suggestQuestions(
  topic: string,
  guests: Guest[],
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string[]> {
  const { content } = await chat(suggestQuestionsMessages(topic, guests), apiKey, {
    json: true,
    temperature: 0.9,
    max_tokens: 300,
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
function cleanReply(text: string, name: string): string {
  let t = text.trim();
  const prefix = new RegExp(`^${escapeRe(name)}\\s*[:：]-?\\s*`, "i");
  t = t.replace(prefix, "");
  t = t.replace(/^["'“”]|["'“”]$/g, "");
  t = t.replace(/^\((.*?)\)\s*/, "");
  return t.trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
