// Basit i18n: arayüz dili Türkçe (Türkiye) ya da İngilizce (dünya).
// Tarayıcı diline göre otomatik seçilir; kullanıcı başlıktan değiştirebilir.
// Not: OTURUM/tartışma dili ayrıdır — o KONUNUN diline göre belirlenir
// (detectTopicLang). Buradaki diller yalnızca ARAYÜZ metinleri içindir.
import { createContext, useContext } from "react";

export type Lang = "tr" | "en";
const LANG_KEY = "siyaset_meydani_lang";

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "tr" || saved === "en") return saved;
  } catch {
    /* yoksay */
  }
  try {
    return (navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en";
  } catch {
    return "en";
  }
}
export function saveLang(l: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* yoksay */
  }
}

// Konunun dilini kabaca tespit et (spiker senaryo replikleri için). Türkçeye
// özgü harf/kelimeler varsa "tr", yoksa "en" (şimdilik Latin diller).
export function detectTopicLang(topic: string): Lang {
  const t = (topic || "").toLocaleLowerCase("tr");
  if (/[çğıİöşü]/.test(topic)) return "tr";
  if (/\b(mı|mi|mu|mü|ve|bir|ne|nasıl|neden|için|daha|çok|değil|mıdır|midir|kim|hangi)\b/.test(t))
    return "tr";
  return "en";
}

const TR: Record<string, string> = {
  // App: dil, ortak
  "lang.toggle": "EN",
  "lang.title": "Switch to English",
  // App: modallar
  "block.title": "Bu konu uygun değil",
  "block.ok": "Tamam, başka konu seçeyim",
  "leave.title": "Oturumu sonlandır",
  "leave.body": "Oturumu sonlandırmak istediğinize emin misiniz? Spiker bir kapanış konuşması yapacak ve sonuçlar gösterilecektir.",
  "leave.cancel": "İptal",
  "leave.confirm": "Oturumu Bitir",
  // App: toasts / bildirimler
  "toast.saved": "✅ Oturum kaydedildi",
  "toast.shared": "🔗 Paylaşım linki kopyalandı!",
  "err.providerLimit": "Sağlayıcı limiti sürüyor — anahtarınızın günlük kotası dolmuş olabilir (özellikle Groq'un ücretsiz kotası hızlı dolar). Bir süre sonra ▶ Devam ile deneyin ya da farklı bir API anahtarı girin.",
  "block.hate": "Bu konuyla ilgili açık oturum düzenlenemiyor 🌱 Hakaret/karalama içeren başlıklara konuk çağrılmaz; lütfen farklı bir konu seçin.",
  "block.generic": "Bu konuyla ilgili açık oturum düzenlenemiyor 🌱 Lütfen farklı bir konu seçin.",
  "hd.probing": "🎧 HD sesler sınanıyor…",
  "hd.on": "🎧 HD sesler açık — yüksek kaliteli seslendirme aktif.",
  "hd.off": "🎧 HD sesler kapatıldı — normal (tarayıcı) sesler kullanılıyor.",
  "hd.noKey": "🎧 HD çalışmıyor: sunucuda ElevenLabs anahtarı yok. Sınırsız HD için ⚙️ ayarlardan kendi anahtarınızı girin. Şimdilik normal sesler.",
  "hd.quota": "🎧 Ortak HD ses kotası dolmuş — normal sesler kullanılıyor. Kesintisiz HD için ⚙️ ayarlardan kendi ücretsiz Gemini anahtarını girebilirsin.",
  "hd.unreachable": "🎧 HD seslere ulaşılamadı — normal sesler kullanılıyor.",
  "hd.quotaFell": "🎧 Ortak HD ses kotası doldu — normal seslere geçildi. Kesintisiz HD için ⚙️ ayarlardan kendi ücretsiz Gemini anahtarını (AIza…) girebilirsin.",
  "hd.offFell": "🎧 HD sesler şu an kapalı — normal seslere geçildi.",
  "hd.demoOver": "🎧 Ücretsiz HD ses demosu tanışma turuyla sınırlı — oturumun geri kalanı normal seslerle sürecek. Sınırsız HD için ⚙️ ayarlardan ElevenLabs anahtarınızı girebilirsiniz.",
  "hd.keySaved": "🎧 ElevenLabs anahtarı kaydedildi — artık tüm oturum boyunca sınırsız HD ses.",
  "hd.keyCleared": "🎧 ElevenLabs anahtarı silindi — HD ses yeniden tanışma turuyla sınırlı.",
  // App: footer
  "footer.disclaimerLabel": "Sorumluluk reddi:",
  "footer.disclaimer": " Bu deneysel bir eğlence ve mizah projesidir. Oturumdaki konuşmalar yapay zeka tarafından üretilir; kurgusaldır ve adı geçen gerçek ya da tarihî kişilerin gerçek görüşlerini, sözlerini veya kişiliğini yansıtmaz. İçerik hatalı, eksik ya da yanıltıcı olabilir; kaynak veya danışmanlık niteliği taşımaz.",
  "footer.by": "'ın kişisel projesidir · DeepSeek / OpenAI / Claude ile çalışır · Vikipedi verileriyle beslenir",
  // Setup: hero
  "setup.title.derin": "Siyaset Meydanı",
  "setup.title.gunluk": "Sohbet Meydanı",
  "setup.tag.derin": "Çağların en keskin zihinlerini aynı masada buluşturun. Büyük soruların spikeri sizsiniz.",
  "setup.tag.gunluk": "Günün magazini, dedikodusu, muhabbeti… Yıldızlar masada, mikrofon sizde! ✨",
  // Setup: kayıtlı / paylaşılan oturum
  "setup.saved.title": "💾 Kaydedilmiş Oturum",
  "setup.saved.delete": "Sil",
  "setup.saved.continue": "Kaldığın yerden devam et ▶",
  "setup.shared.title": "🔗 Paylaşılan Oturum",
  "setup.shared.close": "Kapat",
  "setup.shared.watch": "İzle ▶",
  "setup.topicWord": "Konu:",
  "setup.repliesWord": "replik",
  // Setup: konu bloğu
  "setup.block1": "1 · Bugünün Konusu",
  "setup.tab.derin": "🧠 Derin",
  "setup.tab.gunluk": "☕ Gündelik",
  "setup.tab.bonus": "bonus",
  "setup.topicsMore": "↻ Başka konular öner",
  "setup.topicsLoading": "⏳ Konu üretiliyor…",
  "setup.topicPlaceholder": "…ya da kendi konunuzu yazın (futbol, aşk, uzay, tarih…)",
  "setup.fetchGuests": "Konukları getir",
  // Setup: konuklar bloğu
  "setup.block2": "2 · Sayın Konuklar",
  "setup.reshuffle": "↻ Başkaları",
  "setup.guestEmpty": "Bir konu seçin ya da yazıp “Konukları getir”e basın; o konunun çağlar-ötesi isimlerini masaya davet edeyim. Dilerseniz aşağıdan kendi konuğunuzu da ekleyebilirsiniz.",
  "setup.guestRemove": "Çıkar",
  "setup.badge.enWiki": "İngilizce Vikipedi'den",
  "setup.badge.minimal": "Vikipedi özeti yok — yine de masada!",
  "setup.quickLabel": "Hazır konuklar — dokun, masaya gelsin",
  "setup.quick.onTable": "Zaten masada",
  "setup.quick.add": "{name} — masaya ekle",
  "setup.quick.removeShelf": "Raftan çıkar",
  "setup.quick.removeShelfAria": "{name} raftan çıkar",
  "setup.addPlaceholder": "Kendi konuğunuzu ekleyin: bir isim yazın (ör. {ex}) ya da Vikipedi linki",
  "setup.addExample.gunluk": "İbrahim Tatlıses",
  "setup.addExample.derin": "Sevan Nişanyan",
  "setup.searching": "Aranıyor…",
  "setup.add": "＋ Ekle",
  // Setup: footer / başlat
  "setup.checking": "Konu kontrol ediliyor…",
  "setup.open": "Oturumu Aç ▶",
  "setup.ownKey": "🔑 Kendi anahtarınız kullanılıyor",
  "setup.demoLeft": "Demo hakkı: ~{n} istek",
  "setup.demoShort": "Kısa demo · sonra kendi anahtarınız",
  "setup.enterKey": "🔑 Kendi API anahtarınızı girin",
  // Setup: geçmiş
  "setup.history": "📜 Geçmiş Oturumlar",
  "setup.history.watch": "▶ İzle",
  "setup.history.continue": "▶ Devam",
  "setup.history.delete": "Sil",
  // Setup: notices
  "notice.topicFail": "⚠️ Konu üretilemedi — yapay zekâ beklenmedik biçimde yanıt verdi. Tekrar deneyin.",
  "notice.noGuests": "⚠️ Yapay zekâ bu konu için konuk öneremedi; hazır havuzdan konuk getirildi. Tekrar denemek için ↻ Başkaları'na basın.",
  "notice.blockHate": "🚫 Bu başlıkla açık oturum düzenlenemiyor (hakaret/karalama). Konuk getirilmedi — lütfen konuyu saygılı bir dille yeniden yazın.",
  "notice.blockHate2": "🚫 Bu konuyla açık oturum düzenlenemiyor — hakaret/karalama içeren başlıklar için konuk getirilmez. Lütfen konuyu tartışmaya uygun, saygılı bir dille yeniden yazın.",
  "notice.gibberish": "🤔 Bunu bir tartışma konusu olarak anlayamadım. Lütfen gerçek bir başlık yazın (ör. “Ev almak mı akıllıca, kirada oturmak mı?”).",
  "notice.notDebatable": "ℹ️ Bu konunun tek bir doğru cevabı var, pek tartışmaya açık değil (ör. 2×2=4). Konukları getiriyorum ama büyük ölçüde hemfikir olacaklar — çekişmeli bir oturum için iki tarafı olan bir başlık deneyin.",
  "notice.blockedName": "Bu isim konuk olarak eklenemez. Lütfen başka bir isim seçin.",
  "notice.notFound": "“{q}” Vikipedi'de bir kişi olarak bulunamadı. İsmi tam yazmayı ya da linkini yapıştırmayı deneyin.",
  // Setup: içerik güvenliği bloke (App)
  "blocked.topicUnsuitable": "Bu konuyla ilgili açık oturum düzenlenemiyor 🌱 Lütfen farklı bir konu seçin.",
  // ModeratorBar
  "mod.pause": "⏸ Durun",
  "mod.resume": "▶ Devam",
  "mod.pauseTitle": "Sayın konuklar, lütfen durun",
  "mod.resumeTitle": "Devam edin",
  "mod.input": "Spiker olarak söz alın… (soru sorun, yönlendirin)",
  "mod.ttsOn": "Seslendirme açık",
  "mod.ttsOff": "Seslendirme kapalı",
  "mod.settings": "Ayarlar — kendi HD ses anahtarını gir",
  "mod.slower": "Yavaşlat",
  "mod.faster": "Hızlandır",
  "mod.save": "Oturumu kaydet",
  "mod.share": "Paylaş",
  "mod.end": "Oturumu bitir",
  "mod.suggest": "Soru öner",
  "mod.give": "Söz Ver",
  "mod.busy": "Konuklar hararetle tartışıyor…",
  // ApiKeyModal
  "key.title": "API Anahtarı",
  "key.desc": "Kendi API anahtarınızı girerek sınırsız oturum açabilirsiniz. Anahtar yalnızca bu tarayıcıda saklanır, hiçbir sunucuda tutulmaz.",
  "key.getFrom": "adresinden alabilirsiniz.",
  "key.delete": "Anahtarı sil",
  "key.close": "Kapat",
  "key.save": "Kaydet",
  "key.eleven.title": "🎧 Kendi HD Ses Anahtarın — opsiyonel",
  "key.eleven.desc": "HD sesler ücretsiz çalışır (Google Gemini). Yoğunlukta ortak demo kotası dolarsa, kendi ÜCRETSİZ Gemini anahtarını (AIza… — aistudio.google.com) girerek HD'de kalırsın; dilersen bir ElevenLabs anahtarı (sk_…) da girebilirsin. Anahtar yalnızca bu tarayıcıda saklanır.",
  "key.eleven.delete": "HD anahtarını sil",
  "key.eleven.save": "HD anahtarını kaydet",
  // RatingMeter
  "meter.label": "REYTİNGMETRE",
  "meter.low": "⚠️ REYTİNGLER DİPTE",
  "meter.lowSub": "Spiker, müdahale edin!",
  "meter.hype": "🔥 Ortam kızıştı!",
  // SessionResult
  "res.win": "🏆 Oturum Başarılı!",
  "res.end": "📺 Oturum Sona Erdi",
  "res.avg": "Ortalama Reyting",
  "res.peak": "Zirve Reyting",
  "res.trough": "Dip Reyting",
  "res.duration": "Toplam Süre",
  "res.replies": "Toplam Replik",
  "res.interventions": "Müdahale",
  "res.mostTalkative": "En Çok Konuşan",
  "res.moment": "🔥 En Tartışmalı An (Reyting {n})",
  "res.badges": "Rozetler ({n}/{total})",
  "res.earned": "Kazanıldı: {d}",
  "res.locked": "Kilitli: {d}",
  "res.sharePrep": "🎨 Görsel hazırlanıyor…",
  "res.share": "📸 Karneyi Paylaş",
  "res.back": "Ana Ekrana Dön",
  "res.hint": "Rozetlerin tarayıcında saklanır — biriktirmeye devam et!",
  "res.imgFail": "Görsel oluşturulamadı, tekrar deneyin.",
  "res.shareCaption": "“{topic}” — Reyting {n}. Sen de tarihi tartıştır!",
  "res.downloaded": "📥 Görsel indirildi — paylaşabilirsin!",
  "res.shareFail": "Paylaşım başarısız oldu.",
  "diff.kolay": "Kolay",
  "diff.orta": "Orta",
  "diff.zor": "Zor",
  // Rozetler
  "badge.ilk_oturum.name": "İlk Oturum",
  "badge.ilk_oturum.desc": "İlk oturumunu tamamladın!",
  "badge.reyting_90.name": "Reyting Zirvesi",
  "badge.reyting_90.desc": "Reyting 90+ seviyesine ulaştın",
  "badge.tum_konuklar.name": "Kapsayıcı Spiker",
  "badge.tum_konuklar.desc": "Tüm konukları konuşturdun",
  "badge.laf_sokma.name": "Laf Sokma Ustası",
  "badge.laf_sokma.desc": "3 laf sokma anı yaşandı",
  "badge.seyirci_costu.name": "Seyirciyi Coşturdun",
  "badge.seyirci_costu.desc": "Combo: seyirci coştu bildirimi aldın",
  "badge.kurtarici.name": "Kurtarıcı Spiker",
  "badge.kurtarici.desc": "Reyting 30 altındayken 60+ üstüne çıkardın",
  "badge.maraton.name": "Maraton Spikeri",
  "badge.maraton.desc": "150+ replikli uzun oturum",
  "badge.bes_mudahale.name": "Deneyimli Spiker",
  "badge.bes_mudahale.desc": "5+ kez müdahale ettin",
  "badge.final.name": "Final Vuruşu",
  "badge.final.desc": "Final bölümüne ulaştın",
  "badge.galibiyet.name": "Zafer",
  "badge.galibiyet.desc": "Oturumu başarıyla tamamladın",
};

const EN: Record<string, string> = {
  "lang.toggle": "TR",
  "lang.title": "Türkçeye geç",
  "block.title": "This topic isn't suitable",
  "block.ok": "OK, I'll pick another topic",
  "leave.title": "End the session",
  "leave.body": "Are you sure you want to end the session? The host will give a closing remark and the results will be shown.",
  "leave.cancel": "Cancel",
  "leave.confirm": "End Session",
  "toast.saved": "✅ Session saved",
  "toast.shared": "🔗 Share link copied!",
  "err.providerLimit": "Provider rate limit persists — your key's daily quota may be exhausted (Groq's free quota fills up fast). Try ▶ Resume in a while or enter a different API key.",
  "block.hate": "A debate can't be held on this topic 🌱 Guests aren't invited for insulting/defamatory titles; please pick a different topic.",
  "block.generic": "A debate can't be held on this topic 🌱 Please pick a different topic.",
  "hd.probing": "🎧 Testing HD voices…",
  "hd.on": "🎧 HD voices on — high-quality narration active.",
  "hd.off": "🎧 HD voices off — normal (browser) voices in use.",
  "hd.noKey": "🎧 HD isn't working: no ElevenLabs key on the server. For unlimited HD, add your own key in ⚙️ settings. Normal voices for now.",
  "hd.quota": "🎧 Shared HD voice quota is used up — normal voices in use. For uninterrupted HD, add your own free Gemini key in ⚙️ settings.",
  "hd.unreachable": "🎧 Couldn't reach HD voices — normal voices in use.",
  "hd.quotaFell": "🎧 Shared HD voice quota used up — switched to normal voices. For uninterrupted HD, add your own free Gemini key (AIza…) in ⚙️ settings.",
  "hd.offFell": "🎧 HD voices are off right now — switched to normal voices.",
  "hd.demoOver": "🎧 The free HD voice demo is limited to the intro round — the rest of the session continues with normal voices. For unlimited HD, add your ElevenLabs key in ⚙️ settings.",
  "hd.keySaved": "🎧 ElevenLabs key saved — unlimited HD voices for the whole session now.",
  "hd.keyCleared": "🎧 ElevenLabs key removed — HD voice is limited to the intro round again.",
  "footer.disclaimerLabel": "Disclaimer:",
  "footer.disclaimer": " This is an experimental entertainment and satire project. Session dialogue is AI-generated; it is fictional and does not reflect the real views, statements, or personalities of the real or historical people named. Content may be wrong, incomplete, or misleading; it is not a source or advice.",
  "footer.by": "'s personal project · Runs on DeepSeek / OpenAI / Claude · Fed by Wikipedia data",
  "setup.title.derin": "Debate Arena",
  "setup.title.gunluk": "Chat Arena",
  "setup.tag.derin": "Bring the sharpest minds of the ages to one table. You're the host of the big questions.",
  "setup.tag.gunluk": "Today's gossip, buzz, and chatter… Stars at the table, mic in your hand! ✨",
  "setup.saved.title": "💾 Saved Session",
  "setup.saved.delete": "Delete",
  "setup.saved.continue": "Continue where you left off ▶",
  "setup.shared.title": "🔗 Shared Session",
  "setup.shared.close": "Close",
  "setup.shared.watch": "Watch ▶",
  "setup.topicWord": "Topic:",
  "setup.repliesWord": "replies",
  "setup.block1": "1 · Today's Topic",
  "setup.tab.derin": "🧠 Deep",
  "setup.tab.gunluk": "☕ Casual",
  "setup.tab.bonus": "bonus",
  "setup.topicsMore": "↻ Suggest other topics",
  "setup.topicsLoading": "⏳ Generating topics…",
  "setup.topicPlaceholder": "…or type your own topic (football, love, space, history…)",
  "setup.fetchGuests": "Get guests",
  "setup.block2": "2 · Distinguished Guests",
  "setup.reshuffle": "↻ Others",
  "setup.guestEmpty": "Pick a topic or type one and press “Get guests”; I'll invite that topic's across-the-ages figures to the table. You can also add your own guest below.",
  "setup.guestRemove": "Remove",
  "setup.badge.enWiki": "From English Wikipedia",
  "setup.badge.minimal": "No Wikipedia summary — at the table anyway!",
  "setup.quickLabel": "Quick guests — tap to seat them",
  "setup.quick.onTable": "Already at the table",
  "setup.quick.add": "{name} — add to table",
  "setup.quick.removeShelf": "Remove from shelf",
  "setup.quick.removeShelfAria": "Remove {name} from shelf",
  "setup.addPlaceholder": "Add your own guest: type a name (e.g. {ex}) or a Wikipedia link",
  "setup.addExample.gunluk": "Beyoncé",
  "setup.addExample.derin": "Christopher Hitchens",
  "setup.searching": "Searching…",
  "setup.add": "＋ Add",
  "setup.checking": "Checking topic…",
  "setup.open": "Open Session ▶",
  "setup.ownKey": "🔑 Using your own key",
  "setup.demoLeft": "Demo left: ~{n} requests",
  "setup.demoShort": "Short demo · then your own key",
  "setup.enterKey": "🔑 Enter your own API key",
  "setup.history": "📜 Past Sessions",
  "setup.history.watch": "▶ Watch",
  "setup.history.continue": "▶ Resume",
  "setup.history.delete": "Delete",
  "notice.topicFail": "⚠️ Couldn't generate topics — the AI responded unexpectedly. Try again.",
  "notice.noGuests": "⚠️ The AI couldn't suggest guests for this topic; guests were drawn from the ready pool. Press ↻ Others to try again.",
  "notice.blockHate": "🚫 A debate can't be held under this title (insult/defamation). No guests were fetched — please rewrite the topic respectfully.",
  "notice.blockHate2": "🚫 A debate can't be held on this topic — guests aren't fetched for insulting/defamatory titles. Please rewrite it respectfully.",
  "notice.gibberish": "🤔 I couldn't read this as a debate topic. Please write a real title (e.g. “Is buying a home smarter, or renting?”).",
  "notice.notDebatable": "ℹ️ This topic has a single correct answer and isn't really debatable (e.g. 2×2=4). I'll fetch guests but they'll mostly agree — for a heated session, try a two-sided title.",
  "notice.blockedName": "This name can't be added as a guest. Please pick another name.",
  "notice.notFound": "“{q}” wasn't found as a person on Wikipedia. Try the full name or paste a link.",
  "blocked.topicUnsuitable": "A debate can't be held on this topic 🌱 Please pick a different topic.",
  "mod.pause": "⏸ Stop",
  "mod.resume": "▶ Resume",
  "mod.pauseTitle": "Guests, please stop",
  "mod.resumeTitle": "Continue",
  "mod.input": "Take the floor as host… (ask a question, steer)",
  "mod.ttsOn": "Narration on",
  "mod.ttsOff": "Narration off",
  "mod.settings": "Settings — enter your own HD voice key",
  "mod.slower": "Slower",
  "mod.faster": "Faster",
  "mod.save": "Save session",
  "mod.share": "Share",
  "mod.end": "End session",
  "mod.suggest": "Suggest a question",
  "mod.give": "Give Floor",
  "mod.busy": "Guests are debating heatedly…",
  "key.title": "API Key",
  "key.desc": "Enter your own API key for unlimited sessions. The key is stored only in this browser, never on any server.",
  "key.getFrom": "you can get it there.",
  "key.delete": "Delete key",
  "key.close": "Close",
  "key.save": "Save",
  "key.eleven.title": "🎧 Your Own HD Voice Key — optional",
  "key.eleven.desc": "HD voices are free (Google Gemini). If the shared demo quota fills up under load, paste your own FREE Gemini key (AIza… — aistudio.google.com) to stay on HD; you can also enter an ElevenLabs key (sk_…). The key is stored only in this browser.",
  "key.eleven.delete": "Delete HD key",
  "key.eleven.save": "Save HD key",
  "meter.label": "RATING METER",
  "meter.low": "⚠️ RATINGS AT ROCK BOTTOM",
  "meter.lowSub": "Host, step in!",
  "meter.hype": "🔥 It's heating up!",
  "res.win": "🏆 Session Successful!",
  "res.end": "📺 Session Ended",
  "res.avg": "Average Rating",
  "res.peak": "Peak Rating",
  "res.trough": "Lowest Rating",
  "res.duration": "Total Time",
  "res.replies": "Total Replies",
  "res.interventions": "Interventions",
  "res.mostTalkative": "Most Talkative",
  "res.moment": "🔥 Most Heated Moment (Rating {n})",
  "res.badges": "Badges ({n}/{total})",
  "res.earned": "Earned: {d}",
  "res.locked": "Locked: {d}",
  "res.sharePrep": "🎨 Preparing image…",
  "res.share": "📸 Share Report Card",
  "res.back": "Back to Home",
  "res.hint": "Your badges are saved in your browser — keep collecting!",
  "res.imgFail": "Couldn't create the image, try again.",
  "res.shareCaption": "“{topic}” — Rating {n}. Make history debate too!",
  "res.downloaded": "📥 Image downloaded — share it!",
  "res.shareFail": "Sharing failed.",
  "diff.kolay": "Easy",
  "diff.orta": "Medium",
  "diff.zor": "Hard",
  "badge.ilk_oturum.name": "First Session",
  "badge.ilk_oturum.desc": "You completed your first session!",
  "badge.reyting_90.name": "Rating Peak",
  "badge.reyting_90.desc": "You reached a rating of 90+",
  "badge.tum_konuklar.name": "Inclusive Host",
  "badge.tum_konuklar.desc": "You got every guest to speak",
  "badge.laf_sokma.name": "Zinger Master",
  "badge.laf_sokma.desc": "3 zinger moments happened",
  "badge.seyirci_costu.name": "Crowd Pleaser",
  "badge.seyirci_costu.desc": "Combo: you got the crowd-hype notice",
  "badge.kurtarici.name": "Rescuer Host",
  "badge.kurtarici.desc": "You pushed the rating above 60 while it was under 30",
  "badge.maraton.name": "Marathon Host",
  "badge.maraton.desc": "A long session of 150+ replies",
  "badge.bes_mudahale.name": "Seasoned Host",
  "badge.bes_mudahale.desc": "You intervened 5+ times",
  "badge.final.name": "Final Strike",
  "badge.final.desc": "You reached the final round",
  "badge.galibiyet.name": "Victory",
  "badge.galibiyet.desc": "You completed the session successfully",
};

const DICT: Record<Lang, Record<string, string>> = { tr: TR, en: EN };

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? DICT.tr[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

// Modül seviyesi geçerli dil — React dışı yerlerde (callback/toast) kullanılır.
let currentLang: Lang = detectLang();
export function setCurrentLang(l: Lang): void {
  currentLang = l;
}
export function getCurrentLang(): Lang {
  return currentLang;
}
// React dışı çeviri kısayolu (setError/setNotice gibi callback'ler için).
export function ct(key: string, params?: Record<string, string | number>): string {
  return translate(currentLang, key, params);
}

export interface I18n {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
}
export const I18nContext = createContext<I18n>({
  lang: "tr",
  t: (k) => k,
  setLang: () => {},
});
export function useT(): I18n {
  return useContext(I18nContext);
}
