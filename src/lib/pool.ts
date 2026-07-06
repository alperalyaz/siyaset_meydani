import type { Guest } from "../types";

// Konu havuzları: kullanıcı yazmak istemezse hazır, kışkırtıcı başlıklar.
export const TOPIC_POOL: string[] = [
  "Yeniçeri Ocağı'nın kapatılması doğru muydu?",
  "İstanbul'un fethi bir zafer mi yoksa bir medeniyetin sonu mu?",
  "Türkçenin sadeleştirilmesi dili zenginleştirdi mi, fakirleştirdi mi?",
  "Bir toplumu ileri taşıyan bilim mi, inanç mı?",
  "Kahraman tek bir insan olabilir mi, yoksa kahramanlık bir halkın işi midir?",
  "Sanat iktidara hizmet etmeli mi, ona karşı durmalı mı?",
  "Göçebe hayat mı yerleşik hayat mı insanı özgür kılar?",
  "Tarihi yazan galipler haklı mıdır?",
  "Matematik keşfedilir mi, icat mı edilir?",
  "İyi bir lider sevilmeli mi, korkulmalı mı?",
];

// Küratörlü kişi havuzu: çağlar arası çarpışmayı garantilemek için
// farklı dönemlerden ilginç isimler. Vikipedi çekimi başarısız olursa
// buradaki blurb kullanılır; başarılıysa özet buradakini geçersiz kılar.
// Vikipedi başlığı `title` alanında.
export interface Seed {
  name: string;
  title: string;
  era: string;
  blurb: string;
}

export const PERSON_POOL: Seed[] = [
  {
    name: "Bilge Kağan",
    title: "Bilge Kağan",
    era: "Göktürk kağanı, 8. yüzyıl",
    blurb:
      "II. Göktürk Kağanlığı'nın hükümdarı. Orhun Yazıtları'nda halkına 'ey Türk, üstte gök çökmedikçe' diye seslenen, birliği ve devleti her şeyin üstünde tutan bir devlet adamı.",
  },
  {
    name: "Çaka Bey",
    title: "Çaka Bey",
    era: "İzmir beyi, 11. yüzyıl",
    blurb:
      "İlk Türk denizcisi sayılan, İzmir merkezli bir donanma kuran Selçuklu dönemi beyi. Denizlere Türk bayrağını taşıma tutkusuyla bilinir.",
  },
  {
    name: "Cahit Arf",
    title: "Cahit Arf",
    era: "Matematikçi, 20. yüzyıl",
    blurb:
      "Arf değişmezi ve Arf halkalarıyla tanınan, cebirsel sayılar teorisine katkı yapmış Türk matematikçi. Her şeyi ilk ilkelerden düşünmeyi sever.",
  },
  {
    name: "Fatih Sultan Mehmet",
    title: "II. Mehmed",
    era: "Osmanlı padişahı, 15. yüzyıl",
    blurb:
      "İstanbul'u fethederek bir çağı kapatıp bir çağı açan Osmanlı padişahı. Hem kılıç hem kalem sahibi, çok dil bilen, iddialı ve kendinden emin bir hükümdar.",
  },
  {
    name: "Sevan Nişanyan",
    title: "Sevan Nişanyan",
    era: "Dilbilimci-yazar, 21. yüzyıl",
    blurb:
      "Etimoloji sözlüğüyle tanınan, keskin dilli, otoriteye ve resmi tarihe meydan okumayı seven Ermeni asıllı Türk yazar ve dilbilimci.",
  },
  {
    name: "Mimar Sinan",
    title: "Mimar Sinan",
    era: "Baş mimar, 16. yüzyıl",
    blurb:
      "Süleymaniye ve Selimiye'nin mimarı, Osmanlı'nın baş mimarı. Taşı ve boşluğu konuşturan, ustalığından son derece emin bir usta.",
  },
  {
    name: "Aziz Sancar",
    title: "Aziz Sancar",
    era: "Biyokimyacı, 21. yüzyıl",
    blurb:
      "DNA onarımı üzerine çalışmalarıyla Nobel Kimya Ödülü kazanan Türk bilim insanı. Sabırlı, titiz, kanıta dayalı düşünen biri.",
  },
  {
    name: "Nasreddin Hoca",
    title: "Nasreddin Hoca",
    era: "Bilge-mizahçı, 13. yüzyıl",
    blurb:
      "Fıkralarıyla yüzyıllardır anlatılan Anadolu bilgesi. En ciddi tartışmayı bile bir fıkrayla tersyüz eden, alttan alır gibi yapıp altta bırakmayan biri.",
  },
  {
    name: "Halide Edib Adıvar",
    title: "Halide Edib Adıvar",
    era: "Yazar-aktivist, 20. yüzyıl",
    blurb:
      "Kurtuluş Savaşı'nda meydanlarda konuşan, romanlarıyla tanınan yazar ve kadın hakları savunucusu. Cesur, sözünü sakınmayan bir kalem.",
  },
  {
    name: "Barbaros Hayrettin Paşa",
    title: "Barbaros Hayreddin Paşa",
    era: "Kaptan-ı Derya, 16. yüzyıl",
    blurb:
      "Akdeniz'i Osmanlı gölüne çeviren efsanevi kaptan. Denizin dilinden anlayan, gövde gösterisini seven bir amiral.",
  },
  {
    name: "İbni Sina",
    title: "İbn-i Sînâ",
    era: "Hekim-filozof, 11. yüzyıl",
    blurb:
      "Tıbbın Kanunu'nu yazan, felsefe ve tıbbı birleştiren büyük düşünür. Aklı ve gözlemi her şeyin ölçüsü sayar.",
  },
  {
    name: "Yunus Emre",
    title: "Yunus Emre",
    era: "Halk şairi, 13. yüzyıl",
    blurb:
      "Sevgiyi ve insanı merkeze alan halk şairi. Sade Türkçesiyle en derin meseleyi bir dizede söyleyiveren gönül adamı.",
  },
  {
    name: "Kanuni Sultan Süleyman",
    title: "I. Süleyman",
    era: "Osmanlı padişahı, 16. yüzyıl",
    blurb:
      "Osmanlı'yı en geniş sınırlarına taşıyan, 'Kanuni' lakaplı padişah. Adalet ve nizam takıntılı, ihtişamına düşkün bir hükümdar.",
  },
  {
    name: "Sabiha Gökçen",
    title: "Sabiha Gökçen",
    era: "Pilot, 20. yüzyıl",
    blurb:
      "Dünyanın ilk kadın savaş pilotlarından. Gökyüzünde de yerde de sınır tanımayan, kararlı bir öncü.",
  },
  {
    name: "Piri Reis",
    title: "Pîrî Reis",
    era: "Denizci-haritacı, 16. yüzyıl",
    blurb:
      "Dünya haritasıyla ünlü Osmanlı denizcisi ve kartografı. Bilinmeyeni haritalamaya tutkuyla bağlı bir kâşif.",
  },
  {
    name: "Neyzen Tevfik",
    title: "Neyzen Tevfik",
    era: "Ney üstadı-şair, 20. yüzyıl",
    blurb:
      "Hicivli şiirleri ve neyiyle tanınan, kurallara sığmayan boheme. Herkese ve her şeye laf sokabilen serazat bir sanatçı.",
  },
];

const COLORS = [
  "#e94b6b",
  "#3fb6c9",
  "#f2b134",
  "#8b7bd8",
  "#4caf7d",
  "#ff8c5a",
];

export function seedToGuest(seed: Seed, colorIndex: number): Guest {
  return {
    name: seed.name,
    title: seed.title,
    era: seed.era,
    blurb: seed.blurb,
    color: COLORS[colorIndex % COLORS.length],
  };
}

export function colorForIndex(i: number): string {
  return COLORS[i % COLORS.length];
}
