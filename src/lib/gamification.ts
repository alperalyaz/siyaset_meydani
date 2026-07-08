import type {
  Badge,
  Difficulty,
  DifficultyConfig,
  RatingSnapshot,
  SessionEvent,
  SessionResult,
  Utterance,
  Guest,
} from "../types";

// ── Zorluk seviyesi konfigürasyonları ──

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  kolay: {
    label: "Kolay",
    guestCount: 3,
    goalRating: 60,
    holdSeconds: 60,
    finalGoal: 70,
  },
  orta: {
    label: "Orta",
    guestCount: 2,
    goalRating: 70,
    holdSeconds: 45,
    finalGoal: 80,
  },
  zor: {
    label: "Zor",
    guestCount: 2,
    goalRating: 80,
    holdSeconds: 30,
    finalGoal: 90,
  },
};

// ── Tüm kazanılabilir rozetler ──

export const ALL_BADGES: Badge[] = [
  { id: "ilk_oturum", name: "İlk Oturum", emoji: "🎬", description: "İlk oturumunu tamamladın!" },
  { id: "reyting_90", name: "Reyting Zirvesi", emoji: "📈", description: "Reyting 90+ seviyesine ulaştın" },
  { id: "tum_konuklar", name: "Kapsayıcı Spiker", emoji: "🎙️", description: "Tüm konukları konuşturdun" },
  { id: "laf_sokma", name: "Laf Sokma Ustası", emoji: "🎯", description: "3 laf sokma anı yaşandı" },
  { id: "seyirci_costu", name: "Seyirciyi Coşturdun", emoji: "🔥", description: "Combo: seyirci coştu bildirimi aldın" },
  { id: "kurtarici", name: "Kurtarıcı Spiker", emoji: "🦸", description: "Reyting 30 altındayken 60+ üstüne çıkardın" },
  { id: "maraton", name: "Maraton Spikeri", emoji: "⏱️", description: "150+ replikli uzun oturum" },
  { id: "bes_mudahale", name: "Deneyimli Spiker", emoji: "🎤", description: "5+ kez müdahale ettin" },
  { id: "final", name: "Final Vuruşu", emoji: "🏆", description: "Final bölümüne ulaştın" },
  { id: "galibiyet", name: "Zafer", emoji: "👑", description: "Oturumu başarıyla tamamladın" },
];

// ── Badge saklama (localStorage) ──

const BADGES_KEY = "siyaset_meydani_badges";

export function earnedBadgeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(BADGES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveBadgeIds(ids: Set<string>): void {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify([...ids]));
  } catch { /* yoksay */ }
}

export function awardBadge(id: string): Badge | null {
  const earned = earnedBadgeIds();
  if (earned.has(id)) return null; // zaten var
  const badge = ALL_BADGES.find((b) => b.id === id);
  if (!badge) return null;
  earned.add(id);
  saveBadgeIds(earned);
  return badge;
}

// ── Reyting penceresi (sürekli ölçüm için) ──

const COMBO_HOT_THRESHOLD = 80;
const COMBO_COLD_THRESHOLD = 30;
const COMBO_HOLD_MS = 15_000;

export class RatingTracker {
  private window: RatingSnapshot[] = [];
  private hotComboFired = false;
  private coldComboFired = false;
  private hotBelow: number | null = null; // 80 altına düştüğü an
  private coldAbove: number | null = null; // 30 üstüne çıktığı an

  push(rating: number, now: number): void {
    this.window.push({ rating, at: now });
    // Son 120 saniyeden eski kayıtları temizle
    const cutoff = now - 120_000;
    this.window = this.window.filter((s) => s.at > cutoff);
  }

  /** Rating hedef seviyede yeterince uzun süredir mi? */
  aboveFor(threshold: number, ms: number, now: number): boolean {
    if (this.window.length === 0) return false;
    const neededSince = now - ms;
    const recent = this.window.filter((s) => s.at >= neededSince);
    if (recent.length < 2) return false;
    return recent.every((s) => s.rating >= threshold);
  }

  /** 15sn boyunca combo tetikleyici kontrolü — hem hot hem cold döndürür */
  checkCombos(now: number): { hot: boolean; cold: boolean } {
    const result = { hot: false, cold: false };

    // Clean up old combos
    if (this.hotComboFired && this.hotBelow && now - this.hotBelow > COMBO_HOLD_MS) {
      this.hotComboFired = false;
      this.hotBelow = null;
    }
    if (this.coldComboFired && this.coldAbove && now - this.coldAbove > COMBO_HOLD_MS) {
      this.coldComboFired = false;
      this.coldAbove = null;
    }

    const neededSince = now - COMBO_HOLD_MS;
    const recent = this.window.filter((s) => s.at >= neededSince);
    if (recent.length < 2) return result;

    const allHot = recent.every((s) => s.rating >= COMBO_HOT_THRESHOLD);
    const allCold = recent.every((s) => s.rating < COMBO_COLD_THRESHOLD);

    // Hot combo
    if (allHot && !this.hotComboFired) {
      this.hotComboFired = true;
      result.hot = true;
    }
    if (!allHot && this.hotComboFired && !this.hotBelow) {
      this.hotBelow = now;
    }

    // Cold combo
    if (allCold && !this.coldComboFired) {
      this.coldComboFired = true;
      result.cold = true;
    }
    if (!allCold && this.coldComboFired && !this.coldAbove) {
      this.coldAbove = now;
    }

    return result;
  }

  /** Son N saniyedeki ortalama */
  averageIn(lastMs: number, now: number): number {
    const recent = this.window.filter((s) => s.at > now - lastMs);
    if (recent.length === 0) return 50;
    return recent.reduce((a, s) => a + s.rating, 0) / recent.length;
  }

  allSnapshots(): RatingSnapshot[] {
    return [...this.window];
  }
}

// ── Oturum sonuç hesaplama ──

export function computeSessionResult(
  utterances: Utterance[],
  guests: Guest[],
  ratingSnapshots: RatingSnapshot[],
  startTime: number,
  difficulty: Difficulty,
  badgesEarned: Badge[],
  win: boolean,
): SessionResult {
  const ratings = ratingSnapshots.map((s) => s.rating);
  const avg =
    ratings.length > 0
      ? Math.round(ratings.reduce((a, r) => a + r, 0) / ratings.length)
      : 50;
  const peak = ratings.length > 0 ? Math.max(...ratings) : 50;
  const trough = ratings.length > 0 ? Math.min(...ratings) : 50;

  const totalSeconds = Math.round((Date.now() - startTime) / 1000);
  const utteranceCount = utterances.length;

  const modInterventions = utterances.filter(
    (u) => u.speaker === "moderator" || u.mode === "system",
  ).length;

  // En çok konuşan konuk (ısınma turu hariç)
  const warmupSkip = guests.length * 2; // intro + opening
  const debateUtterances = utterances.filter((u, i) => {
    if (u.speaker === "moderator" || u.mode === "system") return true; // spiker her zaman sayılsın
    const guestIdx = utterances.slice(0, i + 1).filter((x) => typeof x.speaker === "number").length;
    return guestIdx > warmupSkip; // ısınma turunu atla
  });
  const counts = new Map<string, number>();
  for (const u of debateUtterances) {
    if (typeof u.speaker === "number") {
      const name = guests[u.speaker]?.name ?? "?";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  let mostTalkative: string | null = null;
  let mostTalkativeCount = 0;
  for (const [name, c] of counts) {
    if (c > mostTalkativeCount) {
      mostTalkativeCount = c;
      mostTalkative = name;
    }
  }

  // En tartışmalı an (reytingin en yüksek olduğu nokta)
  let mostControversialMoment: string | null = null;
  let mostControversialRating = peak;
  if (ratingSnapshots.length > 0) {
    const best = ratingSnapshots.reduce((a, b) => (a.rating > b.rating ? a : b));
    mostControversialRating = best.rating;
    // En yakın TARTIŞMA utterance'ını bul (ısınma turu hariç)
    let closest: Utterance | null = null;
    let minDiff = Infinity;
    for (const u of debateUtterances) {
      const uIdx = utterances.indexOf(u);
      const snapIdx = ratingSnapshots.indexOf(best);
      if (Math.abs(uIdx - snapIdx) < minDiff) {
        minDiff = Math.abs(uIdx - snapIdx);
        closest = u;
      }
    }
    if (closest) {
      mostControversialMoment = closest.text.slice(0, 120);
    }
  }

  return {
    ended: win ? "win" : "quit",
    averageRating: avg,
    peakRating: peak,
    troughRating: trough,
    totalSeconds,
    utteranceCount,
    moderatorInterventions: modInterventions,
    mostTalkative,
    mostTalkativeCount,
    mostControversialMoment,
    mostControversialRating,
    badges: badgesEarned,
    difficulty,
  };
}

// ── Anlık combo event builder ──

export function comboEvent(type: "crowd_hot" | "crowd_cold", now: number): SessionEvent {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type,
    text: type === "crowd_hot" ? "🔥 Seyirci coştu!" : "😴 Seyirci sıkıldı!",
    at: now,
  };
}

export function badgeEvent(badge: Badge, now: number): SessionEvent {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: "badge_earned",
    text: `${badge.emoji} Rozet kazandın: ${badge.name}`,
    at: now,
  };
}

export function phaseChangeEvent(phase: string, now: number): SessionEvent {
  const labels: Record<string, string> = {
    warmup: "Isınma turu başladı 🌱",
    debate: "Tartışma başladı ⚔️",
    final: "FİNAL bölümüne girdin! 🏁 Reytingi yükselt!",
  };
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: "phase_change",
    text: labels[phase] ?? phase,
    at: now,
  };
}

// ── Rozet değerlendirme ──

export function evaluateBadges(
  result: SessionResult,
  utterances: Utterance[],
  guests: Guest[],
  snapshots: RatingSnapshot[],
): Badge[] {
  const earned: Badge[] = [];

  const maybeAward = (id: string) => {
    const b = awardBadge(id);
    if (b) earned.push(b);
  };

  maybeAward("ilk_oturum");

  if (result.peakRating >= 90) maybeAward("reyting_90");

  // Tüm konuklar en az 1 kez konuştu mu?
  const spokeSet = new Set<number>();
  for (const u of utterances) {
    if (typeof u.speaker === "number") spokeSet.add(u.speaker);
  }
  if (spokeSet.size === guests.length) maybeAward("tum_konuklar");

  // 3 laf sokma anı: rating 75+ iken gelen replikler
  const spicyCount = utterances.filter((u, i) => {
    const snap = snapshots[i] ?? snapshots[snapshots.length - 1];
    return typeof u.speaker === "number" && snap && snap.rating >= 75;
  }).length;
  if (spicyCount >= 3) maybeAward("laf_sokma");

  // Seyirci coştu combo'su alındı mı (rating 80+ 15sn)
  if (result.peakRating >= 80) maybeAward("seyirci_costu");

  // Kurtarıcı: rating 30 altından 60+ üstüne
  let wasLow = false;
  let rescued = false;
  for (const s of snapshots) {
    if (s.rating < 30) wasLow = true;
    if (wasLow && s.rating >= 60) { rescued = true; break; }
  }
  if (rescued) maybeAward("kurtarici");

  if (result.utteranceCount >= 150) maybeAward("maraton");
  if (result.moderatorInterventions >= 5) maybeAward("bes_mudahale");

  if (result.ended === "win") {
    maybeAward("final");
    maybeAward("galibiyet");
  }

  return earned;
}

/** SessionPhase için etiket */
export function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    warmup: "🌱 Isınma",
    debate: "⚔️ Tartışma",
    final: "🏁 Final",
    ended: "🏁 Sonuç",
  };
  return map[phase] ?? phase;
}
