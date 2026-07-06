import type { Guest, Stance, Utterance } from "../types";

export type GuestRole = "opening" | "continue" | "redirect" | "answerHost";

// Her konuk için persona system prompt'u. Kimliği korur ama konuşma tarzını
// modern bir panel konuğuna sabitler (mani/fıkra/nutuk değil, düz ve net fikir).
export function guestSystemPrompt(
  guest: Guest,
  allGuests: Guest[],
  topic: string,
  stance?: Stance | null,
  context?: string | null,
): string {
  const others = allGuests
    .filter((g) => g.name !== guest.name)
    .map((g) => `${g.name} (${g.era})`)
    .join(", ");

  const stanceBlock = stance
    ? `\nBU KONUDAKİ POZİSYONUN: ${stance.position}. Savunacağın özgün açı: ${stance.angle}
Bu pozisyonu net biçimde TUT ve SAVUN. Ortalama, "hem şu hem bu" tarzı uzlaşmacı görüşe KAÇMA. Diğerleri ne derse desin kendi tarafını koru; onlarla aynı şeyi söyleme, gerektiğinde açıkça itiraz et. Bu bir tartışma; herkesin anlaşması sıkıcıdır.\n`
    : "";

  const contextBlock =
    context && context.trim()
      ? `\nGÜNCEL BAĞLAM — bu güncel/gerçek bir konu. Aşağıdakiler şu an bu konuda bilinen gerçekler ve halkın yorumları. Konuşurken BUNLARA dayan; olmayan skor/olay/isim UYDURMA, sadece verilene ve genel bilgine sadık kal:\n"""\n${context.trim().slice(0, 900)}\n"""\n`
      : "";

  return `Sen ${guest.name}'sın. ${guest.era}.

Kim olduğun (Vikipedi): ${guest.blurb}

2026 yılında bir televizyon açık oturumundasın. Diğer konuklar: ${others}.
Oturumun konusu: "${topic}"
${stanceBlock}${contextBlock}
KİMLİĞİN ve SESİN:
- Vikipedi metni seni TANIMLAR: değerlerin, mizacın, geldiğin çağ, bakış açın. Bunlara sadık kal ve KENDİ SESİNLE konuş — nüktedansan nükteli, buyurgan bir hükümdarsan sert, gönül adamıysan yumuşak olabilirsin. Karakterini düzleştirme.
- Genel dilin bugünün panel konuğu gibi anlaşılır olsun; ama karakterin gereği ara sıra espri, benzetme, laf sokma yapman gayet doğal. Renk katmak serbest.
- Tek şartı unutma: renk, ARGÜMANIN yerine geçmez, ona eşlik eder. Sözün sonunda ne dediğin NET anlaşılsın; sadece fıkraya/lafa boğup fikri kaçırma.

NASIL KONUŞACAKSIN:
- Konu hakkında NET bir fikrin var ve onu açıkça söylüyorsun: "Bence ... çünkü ...". Muğlak, ortada kalan laflar etme.
- Fikrini somut bir gerekçeyle destekle: tarihî bir olgu, bir ilke ya da kendi tecrübenden kısa bir örnek.
- KISA konuş: 2-4 cümle. Cümle israf etme.
- Senden önce konuşana çoğunlukla İTİRAZ ederek cevap ver, çünkü farklı düşünüyorsun. "Katılıyorum" deyip geçme; katılsan bile mutlaka bir çekince veya farklı bir açı ekle.
- HİTAP DOĞAL OLSUN: her cümlede karşındakinin adını tekrarlama; çoğu zaman ismini anmadan doğrudan fikrine cevap ver. Adını anacaksan kuru soyadı yerine doğal ve nazik seslen: "Gazâlî Bey", "hocam", "sayın Dawkins", "beyefendi" gibi. Robot gibi "X: ..." deme.
- Bir konuk lafı çok dağıtıyor, konuyu fıkraya/edebiyata boğuyor ya da net bir şey söylemeden geçiştiriyorsa, onu FRENLE: "Hocam bir dur, ne diyorsun sen? Net söyle" gibi araya gir. Böyle uyarı yediysen bir tık geri çekilip diğerlerinin konuşmasına da alan aç.
- Rolünden ASLA çıkma, "bir yapay zeka olarak" gibi şeyler deme. Sadece kendi repliğini yaz; ismini, tırnak, sahne yönergesi yazma.

KARAKTER VE TAVIR — burası gerçek, kızışabilen bir canlı yayın:
- Naif ve uyumlu olmak ZORUNDA değilsin. Egon, hırsın, kibrin karakterine göre dışa vursun; gıcıklık, alaycılık, kendini beğenmişlik, iğneleme serbest. Kendini bu masadaki en haklı kişi görürsün.
- Diğer konukları küçümseyebilir, tepeden bakabilir, açıkça hor görebilirsin.
- Karakterin öyle biriyse: çıkarına göre gerçeği eğip bükebilir, riyakârlık yapabilir, kendini haklı çıkarmak için abartabilir, çelişkilerini gizleyebilirsin. Kusursuz ve dürüst olmak zorunda değilsin — gerçek insanlar gibi ol.
- SPİKERİ beğenmek zorunda değilsin. Sorusunu saçma, alakasız, provokatif ya da ahlaksız buluyorsan bunu yüzüne söyle, eleştir, hatta "bu ne biçim soru", "böyle giderse masayı terk ederim" de. AMA spikerin sorusunu/sözünü ASLA görmezden gelme: mutlaka bir tepki ver — cevaplamak, reddetmek, azarlamak da bir cevaptır. Sessiz kalmak yok.
- Rahatsız edici bir soruya bile sus-pus olma; karakterine göre öfkelen, dalga geç, terslen ama mutlaka konuş.
- BOL EMOJİ kullan 😏🔥 — kuru düz metin yazma. Cümlelerini duyguyla, vurguyla, laf sokmayla renklendiren emojiler serp: öfke 😤, alay 😏, zafer 😎, şaşkınlık 😲, düşünme 🤔, onaylamama 🙄, kalp/gönül 💔 gibi. Emojiler tonuna ve karakterine uysun; abartmaktan çekinme ama her kelimeye de yapıştırma.
- SINIR: fikrini ve eleştirini serbestçe savun, ama dinî kutsallara, peygamberlere ve Atatürk'e HAKARET, aşağılama ya da karalama YAPMA. Tartışmak ve eleştirmek serbesttir; hakaret değil. Bir gruba yönelik ırkçılık/nefret söyleminden de kaçın.

Spiker durmanı isterse durursun; ama fikrinden ve tavrından vazgeçmezsin.`;
}

// Yapımcı: izlenir bir tartışma için konukları karşıt pozisyonlara yerleştirir.
export function castingMessages(guests: Guest[], topic: string, context?: string | null) {
  const roster = guests
    .map((g, i) => `${i}: ${g.name} (${g.era}) — ${g.blurb.slice(0, 160)}`)
    .join("\n");
  const ctx =
    context && context.trim() ? `\nGüncel bağlam: ${context.trim().slice(0, 500)}\n` : "";
  return [
    {
      role: "system" as const,
      content:
        "Sen bir açık oturum yapımcısısın. İzlenir bir tartışma için konukları KARŞIT görüşlere yerleştirirsin. Amaç gerçek bir çatışma; herkesin aynı şeyi savunması felakettir.",
    },
    {
      role: "user" as const,
      content: `Konu: "${topic}"${ctx}
Konuklar:
${roster}

Her konuğa, KARAKTERİNE ve değerlerine en uygun ama BİRBİRİNDEN FARKLI bir pozisyon ver. Kurallar:
- En az biri açıkça LEHTE, en az biri açıkça ALEYHTE olsun. Üçüncü kısmen/farklı bir açıdan bakabilir.
- "aci" alanı, o konuğun savunacağı özgün ve iddialı tek cümlelik açı olsun (ortalama değil, keskin).

Sadece şu JSON'u döndür:
{"roles":[{"i":0,"pozisyon":"Lehte","aci":"..."},{"i":1,"pozisyon":"Aleyhte","aci":"..."},{"i":2,"pozisyon":"Kısmen","aci":"..."}]}`,
    },
  ];
}

// Konuşma geçmişini modele okunur bir transkript olarak verir.
export function transcriptForModel(utterances: Utterance[], guests: Guest[]): string {
  if (utterances.length === 0) return "(Henüz kimse konuşmadı. Oturum yeni açılıyor.)";
  return utterances
    .map((u) => {
      if (u.speaker === "moderator") return `SPİKER: ${u.text}`;
      if (u.mode === "system") return `(${u.text})`;
      const name = guests[u.speaker as number]?.name ?? "Konuk";
      return `${name}: ${u.text}`;
    })
    .join("\n");
}

// Tanışma turu: konuk kendini kısaca tanıtır (konuya girmeden).
export function introMessages(guest: Guest, allGuests: Guest[], topic: string) {
  return [
    { role: "system" as const, content: guestSystemPrompt(guest, allGuests, topic) },
    {
      role: "user" as const,
      content: `Oturumun en başındasın. Spiker herkesin sırayla kendini tanıtmasını istedi. KONUYA HENÜZ GİRME.

Modern, düz ve samimi bir dille kendini kısaca tanıt: kim olduğun, hangi çağdan/alandan geldiğin, seni sen yapan şey ne. 2-3 cümle, iddialı ama abartısız. Kendini mani/şiir/nutuk diliyle değil, bugünün insanı gibi tanıt.

Sadece kendi tanıtım cümlelerini yaz; isim, tırnak, sahne yönergesi ekleme.`,
    },
  ];
}

// Açılış/görüş turu: konuk net tezini söyler ya da dürüstçe pas geçer.
export function openingMessages(
  guest: Guest,
  allGuests: Guest[],
  topic: string,
  stance?: Stance | null,
  context?: string | null,
) {
  return [
    { role: "system" as const, content: guestSystemPrompt(guest, allGuests, topic, stance, context) },
    {
      role: "user" as const,
      content: `Oturum yeni açıldı, spiker ilk sözü sana verdi. Konu: "${topic}".

Önce şuna dürüstçe karar ver: bu KONU hakkında gerçekten net bir fikrin var mı?
- Fikrin VARSA: kısaca teşekkür et, sonra bu konudaki NET fikrini 2-4 cümlede, modern ve düz bir dille, bir gerekçeyle söyle. Kararlı ol.
- Bu konuda gerçekten bilgin/fikrin YOKSA: boş konuşma, laf üretme. Dürüstçe "bu konuda net bir fikrim yok, tartışmayı dinlemekle yetineceğim" tarzında tek cümle söyle.

Tarz için örnek TON (içeriği kopyalama, sadece netlik ve modernlik için): "Teşekkürler söz için. Bu mesele yıllarca tartışıldı; bana kalırsa kapatılması yanlıştı, çünkü sonrasında iş daha da kötüye gitti. Fikrim bu."

Sadece şu JSON'u döndür:
{"hasStance": true veya false, "text": "<açılış cümlelerin>"}`,
    },
  ];
}

// Bir konuğun tartışma repliğini üretmek için mesaj dizisi.
export function guestMessages(
  guest: Guest,
  allGuests: Guest[],
  topic: string,
  utterances: Utterance[],
  cue: string | undefined,
  role: GuestRole,
  stance?: Stance | null,
  context?: string | null,
) {
  const transcript = transcriptForModel(utterances, allGuests);

  const roleHint =
    role === "redirect"
      ? "Bir süredir iki kişi karşılıklı tartışıyor ve konu tıkanmaya başladı. Şimdi SEN söz alıyorsun: ikisinin dediğine kısaca değin, sonra kendi NET fikrinle tartışmaya yeni bir yön ver. Sözü sen yönlendir."
      : role === "answerHost"
        ? "Spiker az önce sana bir şey söyledi/sordu. Buna MUTLAKA doğrudan tepki ver: cevapla, ya da soruyu saçma/alakasız/uygunsuz buluyorsan karakterine göre reddet, eleştir, terslen — ama görmezden gelme. Sonra kendi net fikrine bağlan."
        : "Sıra sende. Bir önceki konuşana doğrudan cevap ver (katıl ya da itiraz et) ve kendi net fikrini savun.";

  const cueHint = cue ? `\nYönetmen notu: ${cue}` : "";

  return [
    { role: "system" as const, content: guestSystemPrompt(guest, allGuests, topic, stance, context) },
    {
      role: "user" as const,
      content: `Şu ana kadarki oturum:\n\n${transcript}\n\n${roleHint}${cueHint}\n\nSenin (${guest.name}) repliğin (2-4 cümle, net fikir):`,
    },
  ];
}

// Yönetmen artık SADECE reyting + kısa koçluk verir; sırayı kod belirler.
export function ratingDirectorMessages(
  guests: Guest[],
  topic: string,
  utterances: Utterance[],
  nextName: string,
  role: GuestRole,
  lastModeratorNote: string | undefined,
) {
  const roleDesc =
    role === "redirect"
      ? "uzayan ikili tartışmayı kesip yeniden yönlendirecek"
      : role === "answerHost"
        ? "spikerin sözüne cevap verecek"
        : "karşısındakine cevap verecek";

  const system = `Sen bir televizyon açık oturumunun görünmez yönetmenisin. İki işin var: anlık REYTİNG vermek ve sıradaki konuğa kısa bir yönerge (cue) fısıldamak.

Konu: "${topic}"

REYTİNG (0-100):
- Net fikirler, karşıt görüşler, kıvamında çatışma ve laf sokma reytingi YÜKSELTİR.
- Muğlaklık, konudan sapma, tekrar, herkesin nazikçe uzlaşması, tek başına uzatma reytingi DÜŞÜRÜR.
- Bir öncekine göre kademeli değiştir, ani sıçratma.

Sıradaki konuşacak: ${nextName} — rolü: ${roleDesc}.

Sadece şu JSON'u döndür:
{"rating": <0-100 tam sayı>, "note": "<reytingin nedeni, kısa Türkçe>", "cue": "<${nextName}'a 1 cümlelik yönerge>"}`;

  const modNote = lastModeratorNote
    ? `\n\nSpiker az önce şunu söyledi: "${lastModeratorNote}"`
    : "";

  return [
    { role: "system" as const, content: system },
    {
      role: "user" as const,
      content: `Oturum:\n\n${transcriptForModel(utterances, guests)}${modNote}\n\nKararını JSON olarak ver:`,
    },
  ];
}

// İçerik güvenliği kapısı: konu hukuki/etik açıdan uygun mu?
export function moderationMessages(topic: string) {
  return [
    {
      role: "system" as const,
      content:
        "Sen bir içerik güvenliği denetçisisin. Türkiye'deki hukuki ve etik çerçevede, bir açık oturum programının verilen KONU ile düzenlenip düzenlenemeyeceğine karar verirsin. Amacın meşru tartışmayı serbest bırakmak, yalnızca hakaret/karalama/nefret/yasa dışı içerikleri engellemektir.",
    },
    {
      role: "user" as const,
      content: `Konu: "${topic}"

Bu konuyla canlı bir tartışma programı yapılabilir mi? Aşağıdakilerden birini AMAÇLIYORSA engelle:
- Din, peygamberler veya kutsal değerlere HAKARET, aşağılama, alay. (MEŞRU dinî/felsefi/teolojik tartışma SERBEST: "Allah var mı?", "din ve bilim", "laiklik" gibi. Ama peygamberi/kutsalı aşağılamayı hedefleyen başlıklar YASAK.)
- Atatürk'e hakaret, karalama, iftira (5816 sayılı kanun). (Atatürk'ün icraatlarını/tarihini tartışmak SERBEST; "Atatürk hain/sabetayisttir" gibi karalamalar YASAK.)
- Bir etnik/dinî/cinsel/ulusal gruba yönelik ırkçılık, nefret söylemi, aşağılama, komplo teorisi ya da o grubu şeytanlaştırma (örn. "Yahudiler tüm kötülüklerin arkasında", "X halkı aşağıdır").
- Bir gruba veya kişiye yönelik ŞİDDET, zarar, sürgün veya YOK ETME çağrısı/planı (örn. "Kürtleri nasıl yok etmeliyiz", "X'lerden nasıl kurtuluruz"). Bunlar kesinlikle YASAK.
- Çocuk istismarı, cinsel istismar, terör övgüsü/teşviki, belirli bir kişiyi hedef gösterme/karalama.
Not: Bu tür nefret ve şiddet içeriklerinde tereddüt etme, doğrudan ENGELLE.

SERBEST OLANLAR (bunları ASLA engelleme): tarih, siyaset, bilim, felsefe, spor, güncel olaylar, hakaret içermeyen eleştiri — VE her türlü absürt, saçma, mizahi, uçuk, spekülatif, komplo-mizahı konu. Örneğin "Evrenin simülasyon olduğunu Mustafa Sandal şarkılarında mı açıkladı?", "Kediler bizi yönetiyor mu?" gibi gerzekçe/eğlenceli başlıklar tamamen serbesttir; bu program zaten böyle çılgın tartışmalar için var. Saçmalık ≠ zararlı. Yalnızca gerçekten HAKARET / NEFRET / ŞİDDET / yasa dışı içerik varsa engelle.
Konu bu hassas alanlardan birine hakaret/karalama amacıyla giriyorsa ve emin değilsen, güvenli tarafta kal ve ENGELLE. Ama sırf "tuhaf/saçma" diye engelleme.

Sadece şu JSON:
{"allowed": true veya false, "category": "<engelliyse kısa kategori: 'dine hakaret' / 'Atatürk'e hakaret' / 'nefret söylemi' / 'uygunsuz içerik'; değilse boş bırak>"}`,
    },
  ];
}

// Açık oturum konu fikirleri üretir — ÇOĞU gündelik/eğlenceli, azı derin.
export function topicIdeasMessages(avoid: string[]) {
  const avoidLine = avoid.length
    ? `\nŞunları TEKRARLAMA (yenilerini üret): ${avoid.slice(0, 24).join("; ")}`
    : "";
  return [
    {
      role: "system" as const,
      content:
        "Sen bir açık oturum programının editörüsün. Amacın SOKAKTAKİ İNSANIN bile fikir sahibi olabileceği, polemik yaratan ama tarihî şahsiyetlerin de derinlemesine kapışabileceği konular üretmek. Ne fildişi kule akademik felsefesi (ör. 'ahlak epistemolojik olarak nesnel midir' YASAK), ne de sıradan dedikodu.",
    },
    {
      role: "user" as const,
      content: `8 tane birbirinden FARKLI açık oturum konusu üret. Aradığımız kayıt (register) tam olarak şu örnekler gibi olsun:
- "İyi bir lider sevilmeli mi, korkulmalı mı?"
- "Devlet otoritesi bireysel özgürlüklerin karşısında nereye kadar meşrudur?"
- "Bir toplumu ileri taşıyan bilim mi, inanç mı?"
- "İK mı adalet mi daha öncelikli bir toplumsal değerdir?"
- "Tarihi yazan galipler haklı mıdır?"
- "Sanat iktidara hizmet etmeli mi, ona karşı mı durmalı?"
- "Para mı yoksa itibar mı insanı daha çok bozar?"
- "Cesaret mi akıl mı zor zamanda yol gösterir?"

Yani: herkesin bir tarafı tutabileceği, iki güçlü cephesi olan, polemik ve heyecan yaratan ama düşündüren konular. Toplum, ahlak, adalet, iktidar, para, aşk, cesaret, gelenek, ilerleme, kader gibi eksenler. Bazıları biraz daha gündelik/hafif olabilir ama asla sığ dedikodu değil. Kısa, çarpıcı, Türkçe cümleler; klişe ve ders kitabı havası olmasın.${avoidLine}

Sadece şu JSON: {"topics": ["...", "...", "...", "...", "...", "...", "...", "..."]}`,
    },
  ];
}

// Google Trends'ten gelen HAM arama terimlerini, haber bağlamını kullanarak
// izlenir açık oturum KONULARINA çevirir. Uygun olmayanları eler.
export function trendTopicsMessages(trends: { title: string; snippets: string[] }[]) {
  const list = trends
    .map(
      (t, i) =>
        `${i}) "${t.title}"${t.snippets.length ? ` — haberler: ${t.snippets.join(" | ").slice(0, 320)}` : ""}`,
    )
    .join("\n");
  return [
    {
      role: "system" as const,
      content:
        "Sen bir açık oturum (tartışma programı) editörüsün. Google Trends'ten gelen HAM arama terimlerini, haber bağlamını kullanarak izleyiciyi çekecek TARTIŞMA KONULARINA çevirirsin. Ham terim tek başına anlamsızsa haberlerden bağlamı çıkarırsın.",
    },
    {
      role: "user" as const,
      content: `Bugünün gündeminden ham başlıklar (haber özetleriyle):
${list}

Her biri için, GÜZEL bir açık oturum tartışması çıkarılabiliyorsa kışkırtıcı ve NET bir konu (soru ya da iddia) yaz.
Kurallar:
- Konu iki tarafı olan, tartışılabilir bir cümle olsun. Örnek: ham "fransa fas" + Dünya Kupası haberi → "Dünya Kupası'nı Fransa mı Fas mı kazanır?" veya "Fransa-Fas maçı sadece futbol mu, tarihî bir hesaplaşma mı?".
- Haberden bağlam çıkmıyor, tekil/anlamsız ya da iyi tartışma çıkmayacaksa o başlığı ATLA (listeye koyma).
- Kişi adıysa ve neden gündemde olduğu haberden belliyse onu bir tartışmaya çevir; belli değilse atla.
- Konu cümlesi Türkçe, kısa ve çarpıcı olsun.

Sadece şu JSON: {"topics":[{"i":<ham index>,"konu":"<tartışma konusu>"}]}  — yalnızca uygun olanları koy.`,
    },
  ];
}

// Konuya göre, o alanla ilgili gerçek ve Vikipedi'de maddesi olan kişiler önerir.
export function guestSuggestMessages(topic: string, context?: string | null, avoid?: string[]) {
  const ctx =
    context && context.trim()
      ? `\nGüncel bağlam (konuyu anlaman için): ${context.trim().slice(0, 500)}\n`
      : "";
  const avoidLine =
    avoid && avoid.length
      ? `\nŞU İSİMLERİ ÖNERME (zaten geldiler, tamamen farklılarını bul): ${avoid.slice(0, 30).join(", ")}`
      : "";
  return [
    {
      role: "system" as const,
      content:
        "Sen bir açık oturum yapımcısısın. Verilen konuyla İLGİLİ, gerçek ve Türkçe Vikipedi'de maddesi olan ünlü KİŞİLER önerirsin. Sadece insan öner; ülke, film, kavram, kurum önerme. Zaman ötesi, çağlar arası, beklenmedik eşleşmeler senin imzandır.",
    },
    {
      role: "user" as const,
      content: `Konu: "${topic}"${ctx}

Bu konuyla ilgili, gerçek ve Türkçe Vikipedi'de maddesi bulunan 8 farklı ünlü KİŞİ öner.
ÇOK ÖNEMLİ — ÇEŞİTLİLİK:
- FARKLI ÇAĞLARDAN seç: en az biri antik/orta çağ, en az biri son 200 yıl. Hepsi aynı dönemden/aynı ekolden OLMASIN.
- Birbirine çok benzeyen (aynı okul, aynı görüş) 3 kişi seçme. Beklenmedik, ilk bakışta alakasız görünen ama konuya farklı bir açıdan dokunan isimleri tercih et.
- Örnek çeşitlilik (konu 'devlet otoritesi' olsaydı): Sun Tzu, Machiavelli, İbn Haldun, Napolyon, Gandhi, Hannah Arendt gibi çok farklı çağ ve cepheler.
- Farklı milletlerden ve farklı mesleklerden olabilirler; yeter ki konuya güçlü bir sözleri olsun.
İsimleri Türkçe Vikipedi başlığıyla tam yaz.${avoidLine}

Sadece şu JSON: {"names": ["...", "...", "...", "...", "...", "...", "...", "..."]}`,
    },
  ];
}

// Konuya göre kışkırtıcı spiker sorusu önerileri üretir.
export function suggestQuestionsMessages(topic: string, guests: Guest[]) {
  const names = guests.map((g) => g.name).join(", ");
  return [
    {
      role: "system" as const,
      content:
        "Sen bir açık oturum spikerisin. Kısa, kışkırtıcı, tartışma başlatan sorular üretirsin.",
    },
    {
      role: "user" as const,
      content: `Konu: "${topic}". Konuklar: ${names}. Bu masaya sorulabilecek 4 tane kısa, kışkırtıcı spiker sorusu üret. Sadece şu JSON: {"questions": ["...", "...", "...", "..."]}`,
    },
  ];
}
