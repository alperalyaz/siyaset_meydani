# Mobil (Android / Play Store) — Capacitor

Bu proje aynı web kod tabanını Capacitor ile Android uygulamasına paketler.
Uygulama, arayüzü telefonda paketli çalıştırır; API çağrıları (LLM, moderasyon,
gündem) canlı Vercel backend'ine (`https://siyaset-meydani.vercel.app`) gider.
Yani uygulama **internet gerektirir** ve backend'siz çalışmaz.

## Mimari notu

- Web derlemesi `VITE_API_BASE` **boş** → `/api/...` (göreli, aynı origin).
- Mobil derleme (`build:mobile`) `VITE_API_BASE=https://siyaset-meydani.vercel.app`
  → API mutlak adrese gider. Backend'e CORS eklendi (mobil farklı origin'den çağırır).

## Gereksinimler (kendi bilgisayarında)

- Node.js 18+
- Java JDK 17
- Android Studio (Android SDK + platform-tools)

## Derleme adımları

```bash
npm install
npm run build:mobile      # web'i mobil API adresiyle derler + android'e senkronlar
npm run android           # Android Studio'da açar  (ya da android/ klasörünü elle aç)
```

Android Studio'da:

1. İlk açılışta Gradle sync'in bitmesini bekle.
2. (İsteğe bağlı) Uygulama simgesi/ismi: `android/app/src/main/res` altından değiştirilir.
   Şu an Capacitor'ın varsayılan ikonu var.
3. **İmzalı AAB üret:** Build → Generate Signed Bundle / APK → **Android App Bundle**
   → yeni bir **keystore** oluştur.
   - ⚠️ Keystore dosyasını ve şifrelerini GÜVENLE SAKLA. Kaybedersen uygulamayı
     bir daha güncelleyemezsin (Play, aynı imzayı ister).
   - `release` variant → `.aab` dosyası çıkar (`android/app/release/`).

## Google Play'e yükleme

1. Google Play Console hesabı aç (tek seferlik **$25** geliştirici ücreti).
2. "Uygulama oluştur" → `.aab` dosyasını yükle.
3. Mağaza kaydı: kısa/uzun açıklama, ekran görüntüleri (telefon), 512×512 ikon,
   grafik başlık, kategori.
4. **Gizlilik politikası şart** (bir URL vermelisin). Toplanan veri: demo limiti
   için IP başına günlük sayaç (Supabase). Bunu politikada belirt.
5. İçerik derecelendirme anketini doldur; hedef kitle & içerik beyanı.
6. İnceleme sürecinden geçince yayınla (genelde birkaç gün).

## ⚠️ İçerik politikası riski (önemli)

Uygulama gerçek/tarihî/dinî figürlerin ağzına kurgusal sözler koyuyor. Play'in
içerik politikaları (nefret, taciz, dinî hassasiyet, yanıltıcı içerik) açısından
şunlar hâlihazırda kodda mevcut ve başvuruda vurgulanmalı:

- Konu kapısı (yasa dışı/hakaret/nefret konularını engeller).
- Konuk kapısı (peygamberler + koruma altındaki kişiler konuk olamaz).
- Persona koruması (kışkırtılsa bile hakaret/nefret üretmez).
- Her ekranda görünür "sorumluluk reddi" (kurgusaldır, gerçek görüş değildir).

Yine de reddedilme ihtimali sıfır değildir; incelemede içeriğin **hiciv/kurgu**
olduğunu ve moderasyon katmanlarını açıkça belirtmek işe yarar.

## Güncelleme döngüsü

Kod değişince: `npm run build:mobile` → Android Studio'da `versionCode`/`versionName`'i
artır (`android/app/build.gradle`) → yeni imzalı AAB → Play Console'a yükle.

## Uygulama kimliği

`capacitor.config.ts` içinde: `appId: com.alperalyaz.siyasetmeydani`,
`appName: Siyaset Meydanı`. Değiştirmek istersen buradan (ve Play'de yayınlamadan önce).
