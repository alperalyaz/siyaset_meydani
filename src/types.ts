export type DebateStyle =
  | "agresif"
  | "pasif-agresif"
  | "alaycı"
  | "bilgiç"
  | "duygusal"
  | "soğukkanlı"
  | "provokatör"
  | "arabulucu"
  | "nükteli"
  | "otoriter";

export interface Guest {
  /** Görünen ad, ör. "Bilge Kağan" */
  name: string;
  /** Vikipedi başlığı (varsa) */
  title?: string;
  /** Kısa dönem/etiket, ör. "Göktürk kağanı, 8. yüzyıl" */
  era: string;
  /** Persona'yı besleyen kısa tanım (Vikipedi özeti veya küratör metni) */
  blurb: string;
  /** Vikipedi'den gelen görsel (varsa) */
  thumbnail?: string;
  /** Renk teması (avatar/isim) */
  color: string;
  /** Seslendirmede erkek/kadın sesi seçimi için (Wikidata P21) */
  gender?: "male" | "female";
  /** ok = TR Vikipedi, en_wiki = İngilizce Vikipedi, minimal = bulunamadı */
  summaryStatus?: "ok" | "minimal" | "blocked" | "en_wiki";
  /** Tartışma üslubu: agresif, alaycı, bilgiç, duygusal, soğukkanlı vb. */
  debateStyle?: DebateStyle;
}

export type Speaker = "moderator" | number; // number = guests[i]

export interface Utterance {
  id: string;
  speaker: Speaker;
  text: string;
  /** "redirect" = sözü alıp yönlendirme, "interrupt" = söz kesme (kızışma),
   *  "walkout" = konuk masayı terk ederken, "system" = sahne notu,
   *  "normal" = sıradan */
  mode: "normal" | "redirect" | "interrupt" | "walkout" | "system";
}

// Yönetmen artık sadece reyting + koçluk üretir; sırayı kod belirler.
export interface RatingDecision {
  /** 0-100 anlık heyecan/reyting */
  rating: number;
  /** Reyting neden bu seviyede (kullanıcıya ipucu) */
  note: string;
  /** Konuşacak konuğa kısa yönerge */
  cue?: string;
}

export interface OpeningResult {
  text: string;
  /** Konuk bu konuda net bir fikir beyan etti mi? Etmediyse pasif kalır. */
  hasStance: boolean;
}

// Yapımcının konuğa atadığı tartışma pozisyonu (karşıt görüşleri garantiler).
export interface Stance {
  position: string; // "Lehte" | "Aleyhte" | "Kısmen"
  angle: string; // savunacağı özgün açı
}

// ── Gamification ──

export type Difficulty = "kolay" | "orta" | "zor";

export interface DifficultyConfig {
  label: string;
  guestCount: number;
  goalRating: number;    // hedef reyting
  holdSeconds: number;   // bu seviyede kaç saniye tutulmalı
  finalGoal: number;     // final bölümünde hedef (debate goal'dan yüksek)
}

export type SessionPhase = "warmup" | "debate" | "final" | "ended";

export interface RatingSnapshot {
  rating: number;
  at: number; // Date.now()
}

export interface SessionEvent {
  id: string;
  type: "crowd_hot" | "crowd_cold" | "phase_change" | "badge_earned";
  text: string;
  at: number;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface SessionResult {
  ended: "win" | "quit";
  averageRating: number;
  peakRating: number;
  troughRating: number;
  totalSeconds: number;
  utteranceCount: number;
  moderatorInterventions: number;
  mostTalkative: string | null;
  mostTalkativeCount: number;
  mostControversialMoment: string | null;
  mostControversialRating: number;
  badges: Badge[];
  difficulty: Difficulty;
}
