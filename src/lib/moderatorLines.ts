import type { Lang } from "./i18n";

// Spiker (moderatör) senaryo replikleri — iki tonda (gündelik/ciddi) ve iki
// dilde (TR/EN). Dil OTURUMUN dilidir (= konunun dili), arayüz dili değil;
// böylece İngilizce konuda spiker de İngilizce konuşur.
export function modLines(gunluk: boolean, lang: Lang = "tr") {
  if (lang === "en") {
    return {
      // Tek-nefes açılış: konukları isimle tanıt + konu + doğrudan görüşlere geç.
      welcomeOpen: (names: string, topic: string) =>
        gunluk
          ? `Helloooo my dears, welcome! 💕 At our table today: ${names}. Our topic: ${topic} Come on darlings, no bios needed — dive straight into your thoughts!`
          : `Welcome! At our table today: ${names}. Our topic: ${topic} Let's begin straight with your views — go ahead.`,
      welcome: gunluk
        ? "Helloooo my dears, welcome sweethearts! 💕 We've got wonderful guests today and a delightful chat ahead. Let's get to know each other first — go on, tell us about yourselves, darlings."
        : "Hello and welcome to our session. First, let's get to know you — please introduce yourselves briefly, one by one.",
      toOpening: (topic: string) =>
        gunluk
          ? `Aww you're all lovely, I adore you! 😍 Now to the real matter, darlings: ${topic} So, who says what? Go on, don't be shy, spill it!`
          : `Thank you. Now to our main matter: ${topic} Let's hear your views one by one, please.`,
      noStance: gunluk
        ? "Aww nobody said a thing, dears, the chat just wouldn't heat up. Never mind, let's leave it here sweetie, don't be sad. 🌸"
        : "The guests didn't state a clear opinion on this; the session stops here.",
      final: (goal: number, hold: number, finalGoal: number) =>
        gunluk
          ? `Ohh the ratings soared, darlings! 🎉 Above ${goal} for a full ${hold} seconds, I'm loving you all! Come on, one last push sweethearts, let's pass ${finalGoal} and end this beautifully! 💃💕`
          : `🎉 Congratulations! Ratings have stayed above ${goal} for ${hold} seconds! We're now in the FINAL round — push the rating above ${finalGoal} and finish as champions!`,
      win: (finalGoal: number) =>
        gunluk
          ? `You were magnificent, darlings, you set the place on fire! 💕 Ratings passed ${finalGoal}, the audience adored you. Big kisses to you all, thank you sweethearts! We're back next week, don't miss it! 😘🎬`
          : `What a session! Our ratings passed the final target of ${finalGoal} and the audience is thrilled. Thanks to our dear guests and to you, our dear host. Our broadcast ends here — see you next time! 👋🎬`,
      closing: gunluk
        ? "Well my dears, sadly the show ends here. 🥹 Thank you each so much, you were absolute sweethearts. Take care, see you next week okay? Kisses, byee! 💋"
        : "Dear guests, we've reached the end of our program. Thank you all for your participation and valuable contributions. See you in the next program, goodbye.",
      idlePause: gunluk
        ? "Aww dears, since you went quiet the chat drifted off — I took a little break so it wouldn't go to waste. 🌸 Come pick a question below or hit ▶ Resume, let's have fun together!"
        : "You've been quiet for a while; I paused so the session wouldn't run on its own. Jump in with one of the questions below, or continue with ▶ Resume.",
      clashChaos: gunluk
        ? "Sweethearts, please, one at a time! 😅 Everyone's talking over each other, I can't hear a thing!"
        : "Dear guests, please! Everyone is talking at once and nothing can be heard — order in the studio, please! 🗯️",
    };
  }
  return {
    welcomeOpen: (names: string, topic: string) =>
      gunluk
        ? `Merhabaaa canlarım, hoş geldiniz tatlılarım! 💕 Bugün masamızda ${names} var. Konumuz: ${topic} Hadi canlarım, tanıtıma gerek yok — doğrudan fikirlerinizle başlayalım, çekinmek yok!`
        : `Hoş geldiniz! Bugün masamızda ${names} var. Konumuz: ${topic} Buyurun, doğrudan görüşlerinizle başlayalım.`,
    welcome: gunluk
      ? "Merhabaaa canlarım, hoş geldiniz tatlılarım! 💕 Bugün yine bir dünya güzel konuğumuz var, çok keyifli bir muhabbet bizi bekliyor. Hadi önce şöyle bir tanışalım, buyurun bakalım kendinizi anlatın canlarım."
      : "Merhaba, oturumumuza hoş geldiniz. Öncelikle sizleri tanıyalım — buyurun, sırayla kısaca kendinizi tanıtın.",
    toOpening: (topic: string) =>
      gunluk
        ? `Ay ne tatlısınız hepiniz, bayıldım! 😍 Hadi şimdi asıl mevzuya gelelim canlarım: ${topic} Eee, kim ne diyor bu işe? Buyurun, çekinmek yok, dökülün bakalım!`
        : `Teşekkür ederim. Şimdi asıl meselemize gelelim: ${topic} Bu konudaki görüşlerinizi sırayla alalım, buyurun.`,
    noStance: gunluk
      ? "Aaa kimsecikler bir şey demedi ki canlarım, muhabbet bir türlü kızışmadı. Neyse, burada bırakalım tatlım, üzülmeyin. 🌸"
      : "Konuklar bu konuda net bir fikir beyan etmedi; oturum burada duruyor.",
    final: (goal: number, hold: number, finalGoal: number) =>
      gunluk
        ? `Ayyy reytingler uçtu canlarım! 🎉 ${goal} üstünde tam ${hold} saniyedir gidiyoruz, valla bayıldım hepinize! Hadi son bir gaz tatlılarım, ${finalGoal}'i de geçelim de program şahane bitsin! 💃💕`
        : `🎉 Tebrikler! Reytingler ${goal} üzerinde ${hold} saniyedir seyrediyor! Şimdi FİNAL bölümüne girdik — reytingi ${finalGoal} üzerine çıkarın, oturum şampiyon bitsin!`,
    win: (finalGoal: number) =>
      gunluk
        ? `Muhteşemdiniz canlarım, resmen coşturdunuz ortalığı! 💕 Reytingler ${finalGoal}'i geçti, seyircimiz size bayıldı. Hepinize kocaman öpücükler, sağ olun var olun tatlılarım! Haftaya yine buradayız, kaçırmak yok! 😘🎬`
        : `Harika bir oturum oldu! Reytinglerimiz final hedefi olan ${finalGoal}'i aştı ve seyircimiz coştu. Değerli konuklarımıza ve siz sevgili spikerimize teşekkür ediyorum. Yayınımız burada sona eriyor — bir sonraki oturumda görüşmek üzere! 👋🎬`,
    closing: gunluk
      ? "Eee canlarım, ne yazık ki program burada bitiyor. 🥹 Hepinize ayrı ayrı teşekkürler, bir dünya tatlıydınız valla. Kendinize iyi bakın, haftaya yine görüşürüz olur mu? Öptüm sizi, bayy! 💋"
      : "Sayın konuklar, programımızın sonuna geldik. Hepinize katılımınız ve değerli katkılarınız için çok teşekkür ederiz. Bir sonraki programda görüşmek üzere, hoşçakalın.",
    idlePause: gunluk
      ? "Ay canlarım, siz bir şey demeyince muhabbet başıboş kaldı — boşa gitmesin diye ufak bir mola verdim. 🌸 Hadi aşağıdan bir soru seçin ya da ▶ Devam deyin, birlikte coşalım!"
      : "Bir süredir söz almadınız; oturum kendi başına sürmesin diye ara verdim. Aşağıdaki sorulardan biriyle söze girin ya da ▶ Devam ile sürdürün.",
    clashChaos: gunluk
      ? "Ayy canlarım, birbirinize girmeyin! 😅 Herkes aynı anda konuşuyor, hiçbir şey anlamıyorum ki!"
      : "Sayın konuklar, lütfen! Herkes aynı anda konuşuyor, hiçbir şey anlaşılmıyor — stüdyoya bir sükûnet lütfen! 🗯️",
  };
}
