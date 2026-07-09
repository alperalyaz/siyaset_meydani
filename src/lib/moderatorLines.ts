// Spiker (moderatör) senaryo replikleri — iki tonda.
// Gündelik ("Sohbet Meydanı") modunda spiker ÇOK gevşek, sıcak, "canlarım
// tatlılarım" havasında bir gündüz kuşağı sunucusu; normal ("Siyaset Meydanı")
// modda ölçülü ve ciddi. App bu repliklerin hangi tonunu kullanacağını oturum
// modundan (gündelik teması) seçer.
export function modLines(gunluk: boolean) {
  return {
    welcome: gunluk
      ? "Merhabaaa canlarım, hoş geldiniz tatlılarım! 💕 Bugün yine bir dünya güzel konuğumuz var, çok keyifli bir muhabbet bizi bekliyor. Hadi önce şöyle bir tanışalım, buyurun bakalım kendinizi anlatın canlarım."
      : "Merhaba, oturumumuza hoş geldiniz. Öncelikle sizleri tanıyalım — buyurun, sırayla kısaca kendinizi tanıtın.",

    toOpening: (t: string) =>
      gunluk
        ? `Ay ne tatlısınız hepiniz, bayıldım! 😍 Hadi şimdi asıl mevzuya gelelim canlarım: ${t} Eee, kim ne diyor bu işe? Buyurun, çekinmek yok, dökülün bakalım!`
        : `Teşekkür ederim. Şimdi asıl meselemize gelelim: ${t} Bu konudaki görüşlerinizi sırayla alalım, buyurun.`,

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
  };
}
