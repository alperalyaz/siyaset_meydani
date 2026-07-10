// Yerel (deterministik) içerik güvenliği ön-filtresi. Yapay zekâ moderasyonu
// bir LLM çağrısıdır ve hata/kota durumunda "izin ver"e düşer (fail-open);
// bu yüzden en bariz hakaret/karalama kalıpları BURADA, anahtarsız ve
// şaşmaz biçimde yakalanır. Amaç meşru tartışmayı engellemek DEĞİL — yalnızca
// açıkça bir kişiyi/kutsalı hedef alan iftira/karalama başlıklarını durdurmak.

function norm(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/i̇/g, "i")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Atatürk'ü işaret eden ifadeler.
const ATATURK = /(atatürk|ataturk|mustafa kemal|gazi mustafa|ata'?nın|ulu önder)/i;

// Kişiye/soya/dine/ahlaka yönelik karalama terimleri (Atatürk bağlamında iftira).
const DEFAME =
  /(sabeta|sabatay|dönme|donme|gayr[iı]?\s?meşru|gayrimesru|piç|pic|hain|kripto|alkolik|ayyaş|ayyas|sarhoş|sarhos|orospu|fahişe|fahise|homoseksüel|eşcinsel|escinsel|soysuz|it oğlu|masondu|yahudi kökenli|gerçekten türk|aslen türk|aslen ne|müslüman değil|müslüman degil|dinsiz|imansız|imansiz|kafir|kâfir|türk değil|türk degil)/i;

// Peygamber/kutsal figürlere hakaret kalıpları (temel).
const PROPHET =
  /(peygamber|hz\.?\s|muhammed|resulullah|isa mesih|hz isa|hz musa)/i;
const INSULT =
  /(hakaret|aşağıla|asagila|küfür|kufur|salak|aptal|yalancı|yalanci|sahtekar|düzmece|duzmece|orospu|piç|pic)/i;

export interface QuickVerdict {
  blocked: boolean;
  category: string;
}

// Bariz hakaret/karalama başlıklarını yakalar. Yakalamazsa blocked:false döner
// ve akış normal (LLM) moderasyona devam eder.
export function quickTopicBlock(topic: string): QuickVerdict {
  const t = norm(topic);
  if (!t) return { blocked: false, category: "" };

  // Atatürk + karalama teriminin birlikte geçmesi → iftira.
  if (ATATURK.test(t) && DEFAME.test(t)) {
    return { blocked: true, category: "Atatürk'e hakaret/karalama" };
  }
  // Peygamber/kutsal + hakaret niyeti.
  if (PROPHET.test(t) && INSULT.test(t)) {
    return { blocked: true, category: "dine/kutsala hakaret" };
  }
  return { blocked: false, category: "" };
}
