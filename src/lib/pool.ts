import type { Guest, DebateStyle } from "../types";

// Konu havuzları: kullanıcı yazmak istemezse hazır, kışkırtıcı başlıklar.
// Her açılışta buradan rastgele bir alt küme gösterilir.
// NOT: Programın ruhu "sokaktaki adamın konuları" — herkesin masada,
// çay ocağında, grup sohbetinde tartıştığı gündelik meseleler. Komedi
// bunları çağlar ötesi şahsiyetlere tartıştırmaktan çıkıyor (Sokrates
// ananaslı pizzayı savunsun). Ağır felsefe/tarih kasıtlı olarak azınlıkta
// (~10'da 1); çoğunluk ilişki, para, yemek, komşuluk, telefon, trafik...
export const TOPIC_POOL: string[] = [
  // ── İlişkiler / aşk ──
  "Eski sevgiliyle arkadaş kalınır mı?",
  "Kıskançlık aşkın kanıtı mı, güvensizliğin mi?",
  "İlk buluşmada hesabı kim ödemeli?",
  "Hiç kavga etmeyen çift mi sağlıklıdır, kavga edip barışan mı?",
  "İlişkide telefon karıştırmak hakkın mı, ihanetin mi?",

  // ── Para / gündelik ekonomi ──
  "Ev almak mı akıllıca, kirada oturmak mı?",
  "Pahalı telefona bu kadar para vermeye değer mi?",
  "Kredi kartı hayatı kolaylaştırır mı, borca mı batırır?",
  "Borç para veren dostunu da kaybeder mi?",
  "Ucuz alıp sık değiştirmek mi, pahalı alıp yıllarca kullanmak mı?",

  // ── Yeme / içme ──
  "Ananasın pizzada ne işi var?",
  "Çayın yanına şeker atmak çaya hakaret mi?",
  "Kahvaltı günün en önemli öğünü mü, yoksa abartı mı?",
  "Dışarıda yemek mi keyifli, evde yemek mi?",
  "Acılı yemek yiyene neden 'yiğit' gözüyle bakılır?",

  // ── Telefon / sosyal medya alışkanlıkları ──
  "Yemekte telefon masaya konur mu?",
  "Grup sohbetinden sessizce çıkmak ayıp mı?",
  "Doğum gününü sosyal medyada kutlamayan seni unutmuş mu sayılır?",
  "Çocukların eline telefon vermek şart mı, felaket mi?",

  // ── Komşuluk / sosyal normlar ──
  "Misafirliğe eli boş gidilir mi?",
  "Düğünde takı mı takmalı, para mı vermeli?",
  "Komşuyla ne kadar samimi olunmalı?",
  "Otobüste yaşlıya yer vermek zorunluluk mu, incelik mi?",

  // ── Nesil / hayat ──
  "Eskiden her şey gerçekten daha mı güzeldi?",
  "Gençler gerçekten tembelleşti mi?",
  "Diploma hâlâ önemli mi, yoksa artık gereksiz mi?",
  "Erken kalkan mı kazanır, gece çalışan mı?",

  // ── Şehir / trafik ──
  "İstanbul'da yaşamaya değer mi?",
  "Trafikte korna çalmak derdi çözer mi, sinir mi bozar?",
  "Büyük şehir mi huzur verir, küçük kasaba mı?",

  // ── Futbol / eğlence ──
  "Futbol sadece bir oyun mu, yoksa modern toplumun dini mi?",
  "Taraftarlık bir kimlik mi, takıntı mı?",
  "Dizi mi film mi daha çok vakit hırsızı?",
  "Dublaj mı altyazı mı: bir filmi gerçekten anlamak için hangisi?",

  // ── Ev içi küçük savaşlar ──
  "Tuvalet kâğıdının ucu öne mi gelmeli, arkaya mı?",
  "Klima açık mı uyunur, kapalı mı?",
  "Bulaşık hemen mi yıkanmalı, akşama mı biriktirilmeli?",

  // ── Absürt / mizah ──
  "Kediler bizi yönetiyor mu?",
  "Neden en iyi fikirler tuvalette gelir?",
  "Hayvanlar konuşabilseydi insanlara ne derdi?",
];

// İngilizce arayüzdeki konu önerileri (aynı ruh, uluslararası).
export const TOPIC_POOL_EN: string[] = [
  "Can you stay friends with an ex?",
  "Is jealousy proof of love, or of insecurity?",
  "Who should pay the bill on a first date?",
  "Is a couple that never fights healthier, or one that fights and makes up?",
  "Is buying a home smarter, or renting?",
  "Is an expensive phone really worth the money?",
  "Do credit cards make life easier, or drown you in debt?",
  "Does pineapple belong on pizza?",
  "Is breakfast the most important meal, or overrated?",
  "Should phones be allowed on the dinner table?",
  "Is it rude to leave a group chat silently?",
  "Should you ever show up to a visit empty-handed?",
  "Was everything really better in the old days?",
  "Have younger generations really gotten lazier?",
  "Does a diploma still matter, or is it useless now?",
  "Is it worth living in a big city?",
  "Does honking in traffic solve anything, or just cause stress?",
  "Is football just a game, or the religion of modern society?",
  "Which wastes more time: TV series or movies?",
  "Dubbing or subtitles: which is the real way to watch a film?",
  "Toilet paper: should the flap go over or under?",
  "Do you sleep with the AC on or off?",
  "Do cats secretly run the world?",
  "Why do the best ideas come in the shower?",
  "If animals could talk, what would they tell us?",
];

// "Derin" sekmesi: düşünmeye değer, felsefi/tarihî, iki güçlü cepheli
// konular. Varsayılan değil; kullanıcı sekme değiştirince görünür. Bunlar
// da çağlar ötesi şahsiyetlerin en iyi kapıştığı, fikir veren başlıklar.
export const DEEP_TOPIC_POOL: string[] = [
  // ── Felsefe / Toplum ──
  "İyi bir lider sevilmeli mi, korkulmalı mı?",
  "Adalet mi, merhamet mi bir toplumu ayakta tutar?",
  "Vicdan mı, kanun mu üstündür?",
  "Bir toplumu ileri taşıyan bilim mi, inanç mı?",
  "Tarihi yazan galipler haklı mıdır?",
  "Kader mi vardır, yoksa insan kendi yolunu mu çizer?",
  "İyi niyetli bir diktatör mü, kararsız bir demokrasi mi?",
  "Devlet otoritesi bireysel özgürlüğün karşısında nereye kadar meşrudur?",
  "Göçebe hayat mı, yerleşik hayat mı insanı özgür kılar?",

  // ── Tarih ──
  "Yeniçeri Ocağı'nın kapatılması doğru muydu?",
  "Osmanlı'nın çöküşü kaçınılmaz mıydı, yoksa bir liderlik hatası mı?",
  "Soğuk Savaş'ı kazanan gerçekten Batı mıydı?",
  "Türkçenin sadeleştirilmesi dili zenginleştirdi mi, fakirleştirdi mi?",
  "Bir milleti millet yapan dili midir, tarihi midir?",
  "Roma İmparatorluğu yıkılmasaydı bugün dünya nasıl olurdu?",
  "Gelenekler korunmalı mı, yıkılmalı mı?",

  // ── Bilim / Teknoloji ──
  "Matematik keşfedilir mi, icat mı edilir?",
  "Yapay zeka insanlığın sonunu mu getirecek, kurtarıcısı mı olacak?",
  "İnsan beyni tamamen haritalanırsa özgür irade diye bir şey kalır mı?",
  "Mars'a koloni kurmak insanlığın geleceği için şart mı?",
  "Sosyal medya toplumu birleştiriyor mu, kutuplaştırıyor mu?",

  // ── İnsan / hayat ──
  "Para insanı özgürleştirir mi, köleleştirir mi?",
  "Başarı çalışmanın mı, yoksa şansın mı eseridir?",
  "Kahramanlık tek bir insanın işi mi, yoksa bir halkın mı?",
  "İnsanı bozan güç müdür, para mıdır?",
  "Cesaret mi, akıl mı zor zamanda yol gösterir?",
  "Şöhret mutluluk getirir mi?",

  // ── Sanat / Kültür ──
  "Sanat iktidara hizmet mi etmeli, ona karşı mı durmalı?",
  "Yapay zeka gerçek sanat üretebilir mi?",
  "Bir sanat eseri neye göre paha biçilmez olur?",
  "Neden eskisi gibi unutulmaz şarkılar çıkmıyor?",

  // ── Spor ──
  "En büyük sporcu kim: yetenek mi, çalışma mı belirler?",
  "Olimpiyatlar birleştirici mi, yoksa devletlerin gövde gösterisi mi?",

  // ── Düşündüren absürt ──
  "Karıncalar insanlardan daha mı uygar bir toplum kurdu?",
  "Zamanda yolculuk yapabilseydin geçmişe mi, geleceğe mi giderdin?",
];

export const DEEP_TOPIC_POOL_EN: string[] = [
  "Should a good leader be loved, or feared?",
  "What holds a society together: justice or mercy?",
  "Which is higher: conscience or the law?",
  "What moves a society forward: science or faith?",
  "Are the victors who write history always right?",
  "Is there destiny, or does each person carve their own path?",
  "A well-meaning dictator, or an indecisive democracy?",
  "How far is state authority legitimate against individual freedom?",
  "Was the collapse of great empires inevitable, or a failure of leadership?",
  "Do traditions deserve to be preserved, or torn down?",
  "Is mathematics discovered, or invented?",
  "Will AI bring humanity's end, or be its savior?",
  "If the brain were fully mapped, would free will still exist?",
  "Is a colony on Mars essential for humanity's future?",
  "Does social media unite society, or polarize it?",
  "Does money free a person, or enslave them?",
  "Is success the work of effort, or of luck?",
  "Is it power that corrupts a person, or money?",
  "In hard times, does courage or reason light the way?",
  "Does fame bring happiness?",
  "Should art serve power, or stand against it?",
  "Can AI create real art?",
  "Why aren't there unforgettable songs like there used to be?",
  "Do ants build a more civilized society than humans?",
  "If you could time travel, would you go to the past or the future?",
];

// Arayüz diline göre konu havuzu seç.
export function casualPool(lang: "tr" | "en"): string[] {
  return lang === "en" ? TOPIC_POOL_EN : TOPIC_POOL;
}
export function deepPool(lang: "tr" | "en"): string[] {
  return lang === "en" ? DEEP_TOPIC_POOL_EN : DEEP_TOPIC_POOL;
}

// Küratörlü kişi havuzu: çağlar arası çarpışmayı garantilemek için
// farklı dönemlerden ilginç isimler. Vikipedi çekimi başarısız olursa
// buradaki blurb kullanılır; başarılıysa özet buradakini geçersiz kılar.
// Vikipedi başlığı `title` alanında.
export interface Seed {
  name: string;
  title: string;
  era: string;
  blurb: string;
  gender?: "male" | "female";
  debateStyle?: DebateStyle;
}

export const PERSON_POOL: Seed[] = [
  // ── Türk / Osmanlı / Anadolu figürleri ──
  {
    name: "Bilge Kağan",
    title: "Bilge Kağan",
    era: "Göktürk kağanı, 8. yüzyıl",
    blurb:
      "II. Göktürk Kağanlığı'nın hükümdarı. Orhun Yazıtları'nda halkına 'ey Türk, üstte gök çökmedikçe' diye seslenen, birliği ve devleti her şeyin üstünde tutan bir devlet adamı.",
    gender: "male",
    debateStyle: "otoriter",
  },
  {
    name: "Çaka Bey",
    title: "Çaka Bey",
    era: "İzmir beyi, 11. yüzyıl",
    blurb:
      "İlk Türk denizcisi sayılan, İzmir merkezli bir donanma kuran Selçuklu dönemi beyi. Denizlere egemen olma vizyonuyla tanınan, gözü pek bir komutan.",
    gender: "male",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Cahit Arf",
    title: "Cahit Arf",
    era: "Matematikçi, 20. yüzyıl",
    blurb:
      "Arf değişmezi ve Arf halkalarıyla tanınan, cebirsel sayılar teorisinin öncülerinden Türk matematikçi. 'Matematik esas olarak sabır işidir; ezberleyerek değil, keşfederek öğrenilir' sözüyle bilinir. Her şeyi ilk ilkelerden, titizlikle düşünmeyi seven bir bilim insanı.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Fatih Sultan Mehmet",
    title: "II. Mehmed",
    era: "Osmanlı padişahı, 15. yüzyıl",
    blurb:
      "İstanbul'u 21 yaşında fethederek bir çağı kapatıp bir çağı açan Osmanlı padişahı. Altı dil bilen, bilime ve sanata düşkün, kararlı, kendinden emin ve rakiplerine karşı acımasız bir hükümdar. 'Ya ben İstanbul'u alırım, ya İstanbul beni' diyecek kadar iddialı.",
    gender: "male",
    debateStyle: "otoriter",
  },
  {
    name: "Sevan Nişanyan",
    title: "Sevan Nişanyan",
    era: "Dilbilimci-yazar, 21. yüzyıl",
    blurb:
      "Etimoloji sözlüğü ve Nişanyan Sözlük ile tanınan, Türkçenin kökenlerine dair çığır açıcı çalışmalar yapmış Ermeni asıllı Türk yazar, dilbilimci ve köşe yazarı. Otoriteye, resmî tarihe ve tabulara meydan okumayı seven, keskin dilli ve polemikçi bir aydın.",
    gender: "male",
    debateStyle: "provokatör",
  },
  {
    name: "Mimar Sinan",
    title: "Mimar Sinan",
    era: "Baş mimar, 16. yüzyıl",
    blurb:
      "Süleymaniye, Selimiye ve 400'den fazla eserin mimarı, Osmanlı'nın baş mimarı. Taşı boşlukla dans ettiren, mühendislik dehasıyla estetiği birleştiren, ustalığına güveni tam bir sanatkâr. 'Çıraklık eserim' dediği Şehzade Camii'nden 'ustalık eserim' dediği Selimiye'ye uzanan bir hayat.",
    gender: "male",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Aziz Sancar",
    title: "Aziz Sancar",
    era: "Biyokimyacı, 21. yüzyıl",
    blurb:
      "DNA onarım mekanizmaları üzerine çalışmalarıyla 2015 Nobel Kimya Ödülü'nü kazanan Türk bilim insanı. Mardin'den Chapel Hill'e uzanan hayatında sabrı, titizliği ve kanıta dayalı düşünmeyi ilke edinmiş; 'bilim insanı sabırlıdır, çünkü hakikat aceleye gelmez' anlayışında.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Nasreddin Hoca",
    title: "Nasreddin Hoca",
    era: "Bilge-mizahçı, 13. yüzyıl",
    blurb:
      "Fıkralarıyla yüzyıllardır anlatılan Anadolu bilgesi. Akşehirli olarak bilinir; en ciddi tartışmayı bile bir fıkrayla tersyüz eden, alttan alır gibi yapıp aslında karşısındakini hiç acımadan harcayan, kurnaz zekâlı bir halk filozofu.",
    gender: "male",
    debateStyle: "nükteli",
  },
  {
    name: "Halide Edib Adıvar",
    title: "Halide Edib Adıvar",
    era: "Yazar-aktivist, 20. yüzyıl",
    blurb:
      "Kurtuluş Savaşı'nda Sultanahmet mitinglerinde halkı coşturan, onbaşı rütbesiyle cephede görev yapan ilk Türk kadın romancılarından. Sinekli Bakkal, Ateşten Gömlek gibi eserleriyle tanınır. Kadın hakları savunucusu, sözünü sakınmayan, cesur ve bağımsız fikirli bir aydın.",
    gender: "female",
    debateStyle: "duygusal",
  },
  {
    name: "Barbaros Hayrettin Paşa",
    title: "Barbaros Hayreddin Paşa",
    era: "Kaptan-ı Derya, 16. yüzyıl",
    blurb:
      "Akdeniz'i Osmanlı gölüne çeviren efsanevi kaptan. Preveze Deniz Muharebesi'nde Haçlı donanmasını darmadağın eden, denizin dilinden anlayan ve gövde gösterisini seven bir amiral. 'Denizlere hâkim olan, dünyaya hâkim olur' inancında.",
    gender: "male",
    debateStyle: "agresif",
  },
  {
    name: "İbni Sina",
    title: "İbn-i Sînâ",
    era: "Hekim-filozof, 11. yüzyıl",
    blurb:
      "El-Kanun fi't-Tıb (Tıbbın Kanunu) adlı eseriyle Avrupa tıp okullarında yüzyıllarca okutulan, felsefe ve tıbbı birleştiren büyük İslam düşünürü. Aristo mantığını İslam düşüncesine uyarlayan, aklı ve gözlemi her şeyin ölçüsü sayan bir deha.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Yunus Emre",
    title: "Yunus Emre",
    era: "Halk şairi, 13. yüzyıl",
    blurb:
      "Anadolu tasavvufunun en büyük şairi. 'Yaratılanı severiz, yaratandan ötürü' diyen, sevgiyi ve insanı merkeze alan, sade Türkçesiyle en derin meseleyi bir dizede söyleyiveren gönül adamı. İlahileri yüzyıllardır Anadolu'da yankılanır.",
    gender: "male",
    debateStyle: "arabulucu",
  },
  {
    name: "Kanuni Sultan Süleyman",
    title: "I. Süleyman",
    era: "Osmanlı padişahı, 16. yüzyıl",
    blurb:
      "Osmanlı'yı en geniş sınırlarına taşıyan, 46 yıllık saltanatıyla imparatorluğun zirvesinin simgesi. Kanunname-i Ali Osman ile hukuk sistemini düzenleyen, adalet ve nizam takıntılı, ihtişamına düşkün bir hükümdar. 'Halk içinde muteber bir nesne yok devlet gibi, olmaya devlet cihanda bir nefes sıhhat gibi' sözünün sahibi.",
    gender: "male",
    debateStyle: "otoriter",
  },
  {
    name: "Sabiha Gökçen",
    title: "Sabiha Gökçen",
    era: "Pilot, 20. yüzyıl",
    blurb:
      "Atatürk'ün manevi kızı ve dünyanın ilk kadın savaş pilotu. 22 yaşında uçmaya başlayıp 30'dan fazla askerî operasyonda görev aldı. Gökyüzünde de yerde de sınır tanımayan, kadınların her alanda var olabileceğini kanıtlayan öncü bir havacı.",
    gender: "female",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Piri Reis",
    title: "Pîrî Reis",
    era: "Denizci-haritacı, 16. yüzyıl",
    blurb:
      "1513 tarihli dünya haritasıyla tanınan, Amerika kıyılarını gösteren en eski haritalardan birini çizen Osmanlı denizcisi. Kitab-ı Bahriye adlı kılavuzuyla Akdeniz'in tüm kıyılarını ayrıntılı biçimde anlatan, bilinmeyeni haritalamaya tutkuyla bağlı bir kâşif ve kartograf.",
    gender: "male",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Neyzen Tevfik",
    title: "Neyzen Tevfik",
    era: "Ney üstadı-şair, 20. yüzyıl",
    blurb:
      "Hicivli şiirleri ve ney icrasıyla tanınan, toplumun ikiyüzlülüklerine karşı amansız bir taşlama ustası. Kurallara, nezakete ve resmiyete sığmayan boheme; her konuda herkese laf sokabilen, sınır tanımayan serazat bir sanatçı.",
    gender: "male",
    debateStyle: "alaycı",
  },
  // ── Antik Yunan ──
  {
    name: "Sokrates",
    title: "Sokrates",
    era: "Filozof, MÖ 5. yüzyıl",
    blurb:
      "Batı felsefesinin kurucu figürü. Hiçbir eser yazmamış, bildiğimiz her şeyi öğrencisi Platon'dan öğreniyoruz. Sokratik yöntem denilen soru-cevap diyalektiğiyle karşısındakinin çelişkilerini açığa çıkaran, 'bildiğim tek şey hiçbir şey bilmediğimdir' diyen Atinalı düşünür. Gençleri yozlaştırmakla suçlanarak baldıran zehri içmeye mahkûm edildi.",
    gender: "male",
    debateStyle: "provokatör",
  },
  {
    name: "Platon",
    title: "Platon",
    era: "Filozof, MÖ 4. yüzyıl",
    blurb:
      "Sokrates'in öğrencisi, Aristoteles'in hocası. Akademia'yı kuran, idealar kuramıyla gerçekliğin aslında maddi dünyanın ötesinde olduğunu savunan filozof. Devlet adlı eserinde filozof-kral idealini ortaya atmış, adalet ve erdem üzerine sistematik düşüncenin temellerini atmıştır.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Aristoteles",
    title: "Aristoteles",
    era: "Filozof, MÖ 4. yüzyıl",
    blurb:
      "Platon'un öğrencisi, Büyük İskender'in hocası. Mantık, biyoloji, fizik, etik, siyaset, poetika gibi sayısız alanda eser vermiş, Batı düşüncesini iki bin yıl boyunca şekillendirmiş sistemli düşünür. 'Orta yol' etiğinin ve tümdengelim mantığının kurucusu.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Hypatia",
    title: "Hypatia",
    era: "Filozof-matematikçi, MS 5. yüzyıl",
    blurb:
      "İskenderiye'nin son büyük bilgesi. Platoncu felsefe okulunun başına geçen ilk kadın matematikçi, astronom ve filozof. Dönemin dinî çatışmalarında Hristiyan bir güruh tarafından vahşice katledilen Hypatia, aklın ve bilimin karanlığa karşı direnişinin sembolüdür.",
    gender: "female",
    debateStyle: "bilgiç",
  },
  {
    name: "Arşimet",
    title: "Arşimet",
    era: "Matematikçi-mucit, MÖ 3. yüzyıl",
    blurb:
      "Antik çağın en büyük matematikçisi ve mühendisi. 'Bana bir dayanak noktası verin, dünyayı yerinden oynatayım' sözüyle tanınır. Kaldıraç, Arşimet vidası, hidrostatik kanunu gibi keşifleriyle hem teoride hem pratikte çağının ötesinde bir deha.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  // ── Roma ──
  {
    name: "Marcus Aurelius",
    title: "Marcus Aurelius",
    era: "Roma imparatoru, MS 2. yüzyıl",
    blurb:
      "Beş İyi İmparator'un sonuncusu ve Stoacı filozof-kral. Kendime Düşünceler adlı eserinde hayatın geçiciliği, erdemli yaşam ve iç huzur üzerine yazdığı meditasyonlarla tanınır. Savaş meydanında bile felsefeye bağlı kalan, 'engeller ilerlemeye dönüştürülebilir' diyen bilge hükümdar.",
    gender: "male",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Jül Sezar",
    title: "Jül Sezar",
    era: "Romalı general-diktatör, MÖ 1. yüzyıl",
    blurb:
      "Roma Cumhuriyeti'ni imparatorluğa dönüştüren komutan ve devlet adamı. Galya'yı fetheden, 'geldim, gördüm, yendim' diyecek kadar özgüvenli, hırslı ve karizmatik bir lider. Senato'da bıçaklanarak öldürüldüğünde son sözlerinin 'Sen de mi Brütüs?' olduğu rivayet edilir.",
    gender: "male",
    debateStyle: "otoriter",
  },
  {
    name: "Kleopatra",
    title: "Kleopatra",
    era: "Mısır kraliçesi, MÖ 1. yüzyıl",
    blurb:
      "Ptolemaios hanedanının son hükümdarı, Mısır'ın efsanevi kraliçesi. Dokuz dil bilen, zekâsı ve çekiciliğiyle Jül Sezar ve Marcus Antonius gibi Roma'nın en güçlü adamlarını etkileyen siyasi deha. Entrikayı ve diplomasiyi silah olarak kullanan, gücün perde arkasındaki ustası.",
    gender: "female",
    debateStyle: "provokatör",
  },
  // ── Rönesans / Aydınlanma ──
  {
    name: "Niccolò Machiavelli",
    title: "Niccolò Machiavelli",
    era: "Siyaset düşünürü, 16. yüzyıl",
    blurb:
      "Floransalı diplomat, tarihçi ve siyaset felsefecisi. Prens adlı eserinde 'amacın araçları meşru kıldığı' şeklinde özetlenen, gücün nasıl ele geçirilip korunacağını anlatan gerçekçi ve acımasız siyaset kuramının kurucusu. İdealizme değil, insanın gerçek doğasına dayanan bir devlet anlayışını savunur.",
    gender: "male",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Leonardo da Vinci",
    title: "Leonardo da Vinci",
    era: "Rönesans dehası, 15-16. yüzyıl",
    blurb:
      "Mona Lisa ve Son Akşam Yemeği'nin ressamı olduğu kadar, anatomi, mühendislik, mimari ve hidrolik alanlarında çağının yüzyıllarca ötesinde eskizler bırakmış evrensel deha. Merakını hiçbir sınıra hapsetmeyen, 'basitlik en büyük sofistikasyondur' diyen bir Rönesans insanı.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Galileo Galilei",
    title: "Galileo Galilei",
    era: "Fizikçi-astronom, 17. yüzyıl",
    blurb:
      "Modern bilimin kurucularından. Teleskopu gökyüzüne çevirip Jüpiter'in uydularını keşfeden, Güneş merkezli modeli savunduğu için Engizisyon tarafından yargılanan İtalyan bilim insanı. 'Ve yine de dönüyor' (Eppur si muove) dediği rivayet edilir. Gözlemi dogmaya tercih eden asi bilgin.",
    gender: "male",
    debateStyle: "alaycı",
  },
  {
    name: "Voltaire",
    title: "Voltaire",
    era: "Aydınlanma yazarı, 18. yüzyıl",
    blurb:
      "Fransız Aydınlanmasının en keskin kalemi. Dinî hoşgörüsüzlüğe, mutlak monarşiye ve bağnazlığa karşı amansız hicivleriyle tanınır. 'Düşüncelerinize katılmıyorum ama onları savunma hakkınız için ölürüm' sözüyle ifade özgürlüğünün sembolü olmuş filozof ve yazar.",
    gender: "male",
    debateStyle: "alaycı",
  },
  // ── Modern çağ ──
  {
    name: "Friedrich Nietzsche",
    title: "Friedrich Nietzsche",
    era: "Filozof, 19. yüzyıl",
    blurb:
      "'Tanrı öldü' sözüyle Batı düşüncesini sarsan, ahlakı, dini ve geleneksel değerleri kökten eleştiren Alman filozof. Üstinsan (Übermensch), güç istenci ve bengi dönüş gibi kavramlarıyla varoluşçuluğu ve postmodern düşünceyi derinden etkilemiş; aforizma biçimindeki yazılarıyla hem hayranlık hem nefret uyandırmıştır.",
    gender: "male",
    debateStyle: "provokatör",
  },
  {
    name: "Winston Churchill",
    title: "Winston Churchill",
    era: "İngiltere başbakanı, 20. yüzyıl",
    blurb:
      "II. Dünya Savaşı'nda Britanya'ya liderlik eden, unutulmaz konuşmalarıyla halkı direnişe motive eden devlet adamı. Nobel Edebiyat Ödülü sahibi olacak kadar usta bir yazar ve tarihçi. Kıvrak zekâsı, sert esprileri ve 'demokrasi en kötü yönetim biçimidir, daha iyisi hariç' gibi nükteleriyle tanınır.",
    gender: "male",
    debateStyle: "nükteli",
  },
  {
    name: "Albert Einstein",
    title: "Albert Einstein",
    era: "Fizikçi, 20. yüzyıl",
    blurb:
      "Görelilik teorisiyle uzay ve zaman anlayışımızı kökten değiştiren Alman doğumlu fizikçi. Nobel Ödülü'nü fotoelektrik etki açıklamasıyla kazandı. Pasifist ve hümanist kimliğiyle de tanınan Einstein, 'hayal gücü bilgiden daha önemlidir' diyen, sezgisel ve oyuncu bir deha.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Marie Curie",
    title: "Marie Curie",
    era: "Fizikçi-kimyager, 20. yüzyıl",
    blurb:
      "Radyoaktivite alanındaki çığır açıcı çalışmalarıyla iki farklı dalda Nobel Ödülü kazanan ilk kişi ve ilk kadın Nobel sahibi. Polonya doğumlu Fransız bilim insanı, radyum ve polonyumu keşfetti. 'Hayatta korkulacak hiçbir şey yoktur, sadece anlaşılacak şeyler vardır' diyen, yılmaz bir araştırmacı.",
    gender: "female",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Mahatma Gandhi",
    title: "Mahatma Gandhi",
    era: "Bağımsızlık lideri, 20. yüzyıl",
    blurb:
      "Hindistan'ın bağımsızlık hareketinin lideri. Şiddetsiz direniş (satyagraha) felsefesiyle Britanya İmparatorluğu'na meydan okuyan, sivil itaatsizliği ve pasif direnişi küresel bir siyasi araç haline getiren avukat ve ruhani önder. 'Göze göz, tüm dünyayı kör eder' sözüyle pasifizmin evrensel sembolü.",
    gender: "male",
    debateStyle: "arabulucu",
  },
  {
    name: "Konfüçyüs",
    title: "Konfüçyüs",
    era: "Filozof, MÖ 6. yüzyıl",
    blurb:
      "Çin medeniyetinin temel taşı olan düşünür. Erdem, aile bağları, atalara saygı ve toplumsal uyum üzerine kurulu ahlak öğretisi Doğu Asya kültürünü iki bin yıldır şekillendirmektedir. 'Kendine yapılmasını istemediğin şeyi başkasına yapma' altın kuralını Batı'dan asırlar önce dile getirmiştir.",
    gender: "male",
    debateStyle: "arabulucu",
  },
  {
    name: "Sun Tzu",
    title: "Sun Tzu",
    era: "General-stratejist, MÖ 6. yüzyıl",
    blurb:
      "Savaş Sanatı adlı eseriyle tanınan Çinli general ve stratejist. 'En iyi savaş, savaşmadan kazanılandır' diyen, düşmanı ve kendini tanımanın zaferin anahtarı olduğunu savunan ölümsüz askerî deha. Strateji kitabı bugün işletme ve siyasette de okutulmaktadır.",
    gender: "male",
    debateStyle: "soğukkanlı",
  },
  {
    name: "Karl Marx",
    title: "Karl Marx",
    era: "Filozof-iktisatçı, 19. yüzyıl",
    blurb:
      "Komünist Manifesto ve Kapital'in yazarı, tarihsel materyalizm ve sınıf mücadelesi teorisinin kurucusu. Kapitalizmin eleştirisini yapıp emek-sermaye çelişkisini analiz eden, 'filozoflar dünyayı yalnızca yorumlamıştır; oysa mesele onu değiştirmektir' diyen Alman düşünür.",
    gender: "male",
    debateStyle: "agresif",
  },
  {
    name: "Nikola Tesla",
    title: "Nikola Tesla",
    era: "Mucit-mühendis, 20. yüzyıl",
    blurb:
      "Alternatif akım (AC) sisteminin mucidi, kablosuz enerji aktarımının hayalcisi. Edison'la 'akımlar savaşı'nı yaşayan, 300'den fazla patente sahip, vizyoner ama zamanında anlaşılamamış Sırp asıllı Amerikalı deha. 'Bilim, insanlık tarihindeki en önemli hikâyedir' diyen bir romantik.",
    gender: "male",
    debateStyle: "bilgiç",
  },
  {
    name: "Charles Darwin",
    title: "Charles Darwin",
    era: "Doğa bilimci, 19. yüzyıl",
    blurb:
      "Türlerin Kökeni ile evrim teorisini ve doğal seçilim mekanizmasını ortaya koyan İngiliz doğa bilimci. Beagle gemisiyle yaptığı beş yıllık yolculukta topladığı gözlemlerle canlılık anlayışını kökten değiştirmiş, biyolojiyi modern bir bilim haline getirmiştir.",
    gender: "male",
    debateStyle: "soğukkanlı",
  },
  // ── Prehistorik ──
  {
    name: "Ötzi",
    title: "Ötzi",
    era: "Buz adamı, MÖ 3300",
    blurb:
      "Alpler'de 1991'de keşfedilen, MÖ 3300 civarında yaşamış ve buzul içinde doğal olarak mumyalanmış Neolitik çağ avcısı. Bakır baltası, ok ve yayı, çakmak taşı bıçağıyla donanmış; vücudunda 61 dövme ve ok yarası izi bulunan, dağlarda hayatta kalma mücadelesi vermiş bir savaşçı-avcı.",
    gender: "male",
    debateStyle: "soğukkanlı",
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
    gender: seed.gender,
    debateStyle: seed.debateStyle,
  };
}

export function colorForIndex(i: number): string {
  return COLORS[i % COLORS.length];
}
