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
}

export type Speaker = "moderator" | number; // number = guests[i]

export interface Utterance {
  id: string;
  speaker: Speaker;
  text: string;
  /** "interrupt" = araya girme, "normal" = sırayla söz */
  mode: "normal" | "interrupt" | "system";
}

export interface DirectorDecision {
  /** 0-100 anlık heyecan/reyting */
  rating: number;
  /** Reyting neden bu seviyede (kullanıcıya ipucu) */
  note: string;
  /** Sıradaki konuşmacı guest index'i */
  next: number;
  /** Araya mı giriyor yoksa sırayla mı söz alıyor */
  mode: "normal" | "interrupt";
  /** Yönetmenin sahne yönergesi (ör. "ortamı ger") */
  cue?: string;
}
