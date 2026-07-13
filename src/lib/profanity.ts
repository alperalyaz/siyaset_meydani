// Küfür tespiti + yayın "bip"i.
//
// Kapsam bilinçli olarak KABA küfürlerle sınırlı: "aptal", "salak" gibi hafif
// hakaretler programı bitirmez (onlar tartışmanın tuzu). Buradaki liste
// yakalarsa konuklar stüdyoyu terk eder ve oturum sonlanır; galeriye yayında
// ise yakalanan kelime [bip] ile maskelenir, sahnenin kalanı aynen yayınlanır.
//
// \b Türkçe harflerle (ç, ğ, ı, ö, ş, ü) güvenilir çalışmadığı için kelime
// sınırları lookaround ile elle kuruluyor.

const L = "a-zA-Z0-9çğıiöşüÇĞİIÖŞÜâîûÂÎÛ";
const B = `(?<![${L}])`;
const E = `(?![${L}])`;

// Her kalıp kelime-sınırlı derlenir. Türevleri (çekim ekleri) \w* yerine
// [harf]* ile yakalıyoruz ki "siktir git" gibi ifadelerin ekleri de maskelensin.
const ROOTS: string[] = [
  // Türkçe — net küfürler (masum eş-yazımlılara çarpmayacak biçimde):
  "amk", "aq", "a\\.q", "awk",
  `am[ıi]na[${L}]*`, // amına koyayım/koyim...
  `amc[ıi]k[${L}]*`,
  `orr?osp[uü][${L}]*`, `oruspu[${L}]*`,
  `piç[${L}]*`,
  `yarr?ak[${L}]*`, `yarr?a[ğg][ıi][${L}]*`,
  `pezeven[kg][${L}]*`,
  `kahpe[${L}]*`,
  `[iİIı]bne[${L}]*`, // Türkçe büyük İ /i bayrağına girmez, elle
  `[iİIı]bine[${L}]*`,
  `gavat[${L}]*`,
  `puşt[${L}]*`,
  `siktir[${L}]*`, "hassiktir", `sikey[${L}]*`, `sikerim[${L}]*`,
  `sikik[${L}]*`, `sikiyor[${L}]*`, `sikiş[${L}]*`, `sikt[ıi][${L}]*`,
  `götveren[${L}]*`, `götlek[${L}]*`,
  "oç",
  // İngilizce:
  `f+u+c+k+[${L}]*`, "fck", `fucking`, `motherfuck[${L}]*`,
  `sh[i1]t[${L}]*`, `bullshit[${L}]*`,
  `bitch[${L}]*`,
  "cunt", `cunts`,
  `assholes?`, `arseholes?`,
  `dickheads?`,
  `wankers?`,
  `whores?`,
  `sluts?`,
  `bastards?`,
];

const PROFANITY_RE = new RegExp(`${B}(?:${ROOTS.join("|")})${E}`, "giu");

// Metinde kaba küfür var mı? (Spiker mesajları için — skandal tetikleyicisi.)
export function hasProfanity(text: string): boolean {
  PROFANITY_RE.lastIndex = 0;
  return PROFANITY_RE.test(text);
}

// Galeri yayını için küfürleri TV usulü maskele; metnin kalanına dokunma.
export function maskProfanity(text: string, lang: "tr" | "en" = "tr"): string {
  const beep = lang === "en" ? "[beep]" : "[bip]";
  PROFANITY_RE.lastIndex = 0;
  return text.replace(PROFANITY_RE, beep);
}
