import type { DirectorDecision, Guest, Utterance } from "../types";
import { chat, parseJsonLoose } from "./deepseek";
import {
  directorMessages,
  guestMessages,
  suggestQuestionsMessages,
} from "./prompts";

// Yönetmeni çalıştır: sıradaki konuşmacı + reyting kararı.
export async function runDirector(
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  lastModeratorNote: string | undefined,
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<DirectorDecision> {
  const { content } = await chat(
    directorMessages(guests, topic, utterances, lastModeratorNote),
    apiKey,
    { json: true, temperature: 0.7, max_tokens: 200, signal },
  );
  const parsed = parseJsonLoose<Partial<DirectorDecision>>(content);

  // Model bozuk döndürürse makul bir yedek karar üret.
  const fallbackNext = pickLeastRecentSpeaker(guests.length, utterances);
  const next =
    typeof parsed?.next === "number" && parsed.next >= 0 && parsed.next < guests.length
      ? parsed.next
      : fallbackNext;

  return {
    rating: clampRating(parsed?.rating),
    note: parsed?.note ?? "",
    next,
    mode: parsed?.mode === "interrupt" ? "interrupt" : "normal",
    cue: parsed?.cue,
  };
}

// Bir konuğun repliğini üret.
export async function runGuest(
  guest: Guest,
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  cue: string | undefined,
  mode: "normal" | "interrupt",
  apiKey: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const { content } = await chat(
    guestMessages(guest, guests, topic, utterances, cue, mode),
    apiKey,
    { temperature: 0.95, max_tokens: 220, signal },
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
  const { content } = await chat(
    suggestQuestionsMessages(topic, guests),
    apiKey,
    { json: true, temperature: 0.9, max_tokens: 300, signal },
  );
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
  t = t.replace(/^\((.*?)\)\s*/, ""); // baştaki sahne yönergesi
  return t.trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// En uzun süredir konuşmayan konuğu bul (yedek seçim).
function pickLeastRecentSpeaker(n: number, utterances: Utterance[]): number {
  const lastSeen = new Array(n).fill(-1);
  utterances.forEach((u, idx) => {
    if (typeof u.speaker === "number") lastSeen[u.speaker] = idx;
  });
  let best = 0;
  for (let i = 1; i < n; i++) {
    if (lastSeen[i] < lastSeen[best]) best = i;
  }
  return best;
}
