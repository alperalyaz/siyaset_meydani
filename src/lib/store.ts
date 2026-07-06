// Basit yerel depolama yardımcıları. Kullanıcının API anahtarı yalnızca
// tarayıcının localStorage'ında tutulur; sunucuya kalıcı olarak yazılmaz.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const KEY = "siyaset_meydani_api_key";

export function loadApiKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveApiKey(key: string): void {
  try {
    localStorage.setItem(KEY, key.trim());
  } catch {
    /* yoksay */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}
