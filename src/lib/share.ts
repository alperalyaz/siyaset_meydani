import type { Guest, Utterance } from "../types";

export interface SharePayload {
  g: Guest[];
  t: string;
  u: Utterance[];
  r: number;
}

// Oturumu URL-safe base64 string'e encode eder.
export function encodeSession(
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  rating: number,
): string {
  const payload: SharePayload = { g: guests, t: topic, u: utterances, r: rating };
  const json = JSON.stringify(payload);
  // btoa Unicode desteklemez; önce UTF-8 byte dizisine çevir.
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// URL-safe base64 string'i oturum verisine decode eder.
export function decodeSession(encoded: string): SharePayload | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as SharePayload;
    if (
      Array.isArray(payload.g) &&
      typeof payload.t === "string" &&
      Array.isArray(payload.u) &&
      typeof payload.r === "number"
    ) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}
