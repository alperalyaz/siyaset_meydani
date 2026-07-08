# Siyaset Meydanı 🎙️

Vikipedi'den rastgele seçilen ünlüleri aynı masada tartıştıran, televizyondaki açık
oturumların yapay zeka botlarıyla yapılmış hali. Çağlar arası konuklar (mesela Bilge Kağan,
Çaka Bey ve Cahit Arf) aynı konuyu tartışır; birbirlerinin lafını keser, laf sokar, yer yer
hak verir ama hep "bu masadaki en haklı benim" havasındadır. Siz **spikersiniz**: söz verir,
yönlendirir, "durun" der, konuyu değiştirirsiniz.

Sağdaki (mobilde üstteki) **Reytingmetre** ortamın heyecanını ölçer: çatışma ve laf sokma
yükseltir, biri konuyu fazla uzatınca ya da herkes nazikçe uzlaşınca düşer. Dibe vurunca sizi
müdahaleye çağırır.

## Nasıl çalışır

- **Konuk seçimi:** Küratörlü, çağlar arası bir kişi havuzundan rastgele 3 kişi seçilir; her biri
  canlı olarak Türkçe Vikipedi özetiyle (giriş metni + görsel) zenginleştirilir. "Vikipedi'de
  popüler olanlardan çek" seçeneği ise Wikimedia pageviews API'sinden son günlerin en çok
  görüntülenen kişilerini çeker.
- **Persona:** Her konuğa Vikipedi metniyle beslenen ayrı bir system prompt verilir. Kendi çağının
  diliyle konuşur, konuyu kendi tecrübesine bağlar, kısa ve iddialı replikler verir.
- **Yönetmen (director):** Görünmez bir orkestratör her turda transkripti okur; sıradaki
  konuşmacıyı, araya girip girmeyeceğini ve **anlık reytingi** tek bir JSON çağrısıyla belirler.
  Reyting düşerse ortamı gerecek bir konuğu araya sokar.
- **Spiker müdahalesi:** Mesaj gönderdiğinizde sürmekte olan replik kesilir, konuklar sizin
  sözünüze göre şekillenir ama konu bağlamından kopmaz. "⏸ Durun" ile oturumu duraklatır,
  "▶ Devam" ile sürdürürsünüz.

## Model / API

Proxy DeepSeek API'sini kullanır (`deepseek-chat` modeli).

İki mod var:

1. **Demo modu:** Sunucudaki `DEEPSEEK_API_KEY` kullanılır, IP başına günlük limitle. Kısa süreli,
   anahtarsız deneme için.
2. **BYOK:** Kullanıcı kendi DeepSeek anahtarını girer (🔑). Anahtar yalnızca
   tarayıcının `localStorage`'ında saklanır, isteklerde header ile taşınır, hiçbir yerde kalıcı
   tutulmaz. Sınırsız kullanım.

İstekler `/api/chat` proxy'si üzerinden gider; anahtar tarayıcıdan doğrudan sağlayıcıya sızmaz.
Model `DEEPSEEK_MODEL` ortam değişkeniyle değiştirilebilir.

## Çalıştırma

```bash
npm install
# Demo modu istiyorsanız:  export DEEPSEEK_API_KEY=sk-...
npm run dev
```

`http://localhost:5173` — `npm run dev` tek başına yeter; `/api/chat` yerel geliştirmede Vite
middleware'i üzerinden Vercel fonksiyonunun aynı mantığıyla çalışır.

## Yayınlama (Vercel)

Repo'yu Vercel'e bağlayın. Framework otomatik "Vite" algılanır, `api/` klasörü serverless
fonksiyon olur. Demo modu için proje ayarlarından `DEEPSEEK_API_KEY` (ve isteğe bağlı
`DEMO_DAILY_LIMIT`) ortam değişkenini girin. Anahtar hiç girilmezse uygulama yalnızca BYOK
modunda çalışır.

## Notlar / geliştirilebilecekler

- Demo limitleyici şu an **bellek içi** (serverless soğuk başlangıçta sıfırlanır). Gerçek üretimde
  `api/_lib/handler.ts` içindeki `rateLimitStatus`/`consume` fonksiyonlarını kalıcı bir depoyla
  (Supabase, KV vb.) değiştirin.
- Sağlayıcı `api/_lib/handler.ts` içinde tek yerde tanımlı; başka bir OpenAI uyumlu sağlayıcıya
  geçiş kolaydır.
- "Sign in with ChatGPT / Claude aboneliğiyle giriş" bugün üçüncü parti uygulamalara açık
  olmadığından demo + BYOK modeli tercih edildi.

## Proje yapısı

```
api/
  chat.ts            Vercel serverless giriş noktası
  _lib/handler.ts    Sağlayıcı proxy + demo limitleyici (tek kaynak)
src/
  lib/
    wikipedia.ts     Konuk seçimi + Vikipedi zenginleştirme
    pool.ts          Küratörlü kişi/konu havuzu
    prompts.ts       Persona + yönetmen + soru promptları
    engine.ts        Yönetmen/konuk çağrıları
    deepseek.ts      /api/chat istemcisi
    store.ts         localStorage (API anahtarı)
  components/        SetupScreen, ChatStream, RatingMeter, ModeratorBar, ApiKeyModal
  App.tsx            Durum makinesi + tur döngüsü
```
