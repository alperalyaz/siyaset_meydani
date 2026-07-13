# debate.be · Siyaset Meydanı 🎙️

Tarihin kayıtlı bütün zihinlerini aynı masaya oturtan yapay zekâ açık oturumu.
Çağlar ötesi konuklar (Sokrates, Machiavelli, Marx, Marie Curie… ya da sizin
seçtiğiniz herhangi biri) aynı konuyu tartışır; birbirinin lafını keser, laf
sokar, hatasını yakalar, yer yer hak verir ama hep "bu masadaki en haklı benim"
havasındadır. Siz **spikersiniz**: söz verir, yönlendirir, "durun" der, konuyu
değiştirirsiniz.

Gerçek dünyada asla kurulamayacak bu masayı yapay zekâ mümkün kılıyor — canlı:
**[debate.be](https://debate.be)**

Arayüz **Türkçe/İngilizce** otomatik seçilir (tarayıcı diline göre), üstten
değiştirilebilir. **Oturumun dili konunun dilini takip eder** — İngilizce bir
konu açarsanız tüm masa İngilizce tartışır.

## İki mod

- **🧠 Siyaset Meydanı (Debate Arena):** Derin, çekişmeli, felsefî/tarihî/toplumsal
  tartışma. Reyting *çatışmayla* yükselir.
- **☕ Sohbet Meydanı (Chat Arena):** Gündüz kuşağı magazin/muhabbet tonu; yıldızlar
  masada, spiker "canlarım tatlılarım" kıvamında. Reyting *kahkahayla* yükselir.

Sağdaki (mobilde üstteki) **Reytingmetre** ortamın heyecanını ölçer; dibe vurunca
sizi müdahaleye çağırır.

## Nasıl çalışır

- **Konuk seçimi:** Konuya göre gerçekten *ilgili* kişiler önerilir (relevans
  çeşitlilikten önce gelir). Varsayılan 2 konuk gelir (düello formatı en akıcısı);
  raftan ya da aramayla eklenir. Her konuk canlı olarak Vikipedi özetiyle (giriş
  metni + görsel) zenginleştirilir — arayüz İngilizceyse en.wikipedia'dan.
- **Persona:** Her konuğa Vikipedi metniyle beslenen ayrı bir system prompt verilir.
  Doğum dönemine uygun ses tonu ve dilinden konuşur, gerçek kimliğine sadık kalır,
  kısa/insanî replikler verir (ağdalı değil), arada sürçüp düzeltir, doğal tepkiler
  ("ııı", "aaah", öksürük) kullanır. Sokrates gibi bazı isimlerin özel personası
  vardır. **İçerik güvenliği:** kutsal figürlere/Atatürk'e hakaret içeren konular
  hiç açılmaz, konuk bile çağrılmaz.
- **Yönetmen (director):** Görünmez orkestratör her turda transkripti okur;
  sıradaki konuşmacıyı, rolünü ve **anlık reytingi** tek JSON çağrısıyla belirler.
- **Kızışma:** Tansiyon tavan yapınca (yüksek reyting) rakip konuk konuşanın
  **sözünü ortasından keser** (ses gerçekten yarıda kesilir), kesilen tersler,
  spiker araya girer ve zorunlu müdahale ekranı açılır ("kapışsınlar" seçeneğiyle).
- **Akış borusu (look-ahead):** Sıradaki tur (yönetmen + replik + ses) mevcut
  konuşma çalarken arkada hazırlanır; sıra gelince yazı ve ses anında başlar.
  Spiker araya girerse hazırlanan tur çöpe gider, yeni yönle üretilir.
- **Boşta koruması:** Spiker 3 dakika hiç katılmazsa (sadece söz alma sayılır)
  oturum nazikçe duraklar ve ekranın önüne yönlendirme sorularıyla müdahale
  ekranı çıkar — token yakmasın diye.
- **Spiker müdahalesi:** Mesaj yazdığınızda sürmekte olan replik/ses TAM bitince
  araya girilir (yarım kesilmez), konuklar sözünüze göre şekillenir. İsimle
  çağırdığınız konuk cevap verir.

## Seslendirme (HD sesler)

Konuşmalar HD sesle seslendirilir; her konuğa cinsiyet + dönem + üsluba göre AYRI
ve kişiliğine uygun ses atanır (spikerin kendine ait sesi vardır).

- **Demo motoru:** Google **Cloud TTS Chirp 3 HD** (`GOOGLE_TTS_API_KEY`). Üretim
  ürünü — günlük istek tavanı yok, ayda 1M karakter ücretsiz. Türkçe destekli.
  IP başına günlük karakter limiti uygulanır (`TTS_DEMO_CHAR_LIMIT`).
- **BYOK:** Kullanıcı ⚙️ ayarlardan kendi **Gemini** (`AIza…`/`AQ…`) ya da
  **ElevenLabs** (`sk_…`) anahtarını girerse tüm oturum onunla, limitsiz.
- **Yedek:** Anahtar yoksa/kota dolunca otomatik tarayıcı Web Speech API sesine
  düşülür; kesinti olmaz.

Tümü `/api/tts` proxy'si üzerinden gider; kullanıcı anahtarı sunucuda tutulmaz.

## Dil modeli / API

Proxy **DeepSeek** API'sini kullanır (`deepseek-v4-flash`); Groq/OpenAI/Claude
anahtarları da desteklenir (önekten otomatik algılanır). İki mod:

1. **Demo modu:** Sunucudaki `DEEPSEEK_API_KEY`, IP başına günlük limitle
   (`DEMO_DAILY_LIMIT`).
2. **BYOK:** Kullanıcı kendi anahtarını girer (⚙️). Anahtar yalnızca tarayıcının
   `localStorage`'ında saklanır, isteklerde header ile taşınır, kalıcı tutulmaz.

İstekler `/api/chat` proxy'si üzerinden gider; anahtar tarayıcıdan doğrudan
sağlayıcıya sızmaz.

## Yayınlanan oturumlar (galeri) + SEO

Tamamlanan oturumlar (opt-out; kullanıcı sonuç ekranında bilgilendirilir ve tek
tıkla kaldırabilir) **anonim** olarak galeriye yayınlanır. Her yayın
`debate.be/s/:slug` adresinde **sunucudan üretilen** (SSR) gerçek bir HTML
transkript sayfası olur — meta/OG/JSON-LD etiketli, arama motorları tarafından
indekslenebilir. Ana sayfada "Yayınlanan Oturumlar" bölümü bunları listeler.

Sitemap **dinamiktir** (`/api/sitemap` → ana sayfa + tüm yayınlar); `robots.txt`,
canonical, Open Graph görseli (`public/og.png`), Twitter card ve JSON-LD mevcuttur.

Yayın verisi ve demo sayaçları **Supabase**'de tutulur (RLS kilitli tablolar,
tüm erişim `SECURITY DEFINER` RPC'leri üzerinden): `siyaset_demo_touch`,
`siyaset_tts_touch`, `siyaset_gallery_*`. Supabase ayarlı değilse sayaçlar
bellek içi yedeğe düşer.

## Çalıştırma

```bash
npm install
# Demo modu istiyorsanız:
export DEEPSEEK_API_KEY=sk-...        # dil modeli demosu
export GOOGLE_TTS_API_KEY=...         # HD ses demosu (opsiyonel)
npm run dev
```

`http://localhost:5173` — `npm run dev` tek başına yeter; `api/` uçları yerel
geliştirmede Vite middleware'i üzerinden Vercel fonksiyonlarının aynı mantığıyla
çalışır.

## Yayınlama (Vercel)

Repo'yu Vercel'e bağlayın; framework otomatik "Vite" algılanır, `api/` klasörü
serverless fonksiyon olur. Ortam değişkenleri:

| Değişken | Ne için |
|---|---|
| `DEEPSEEK_API_KEY` | Dil modeli demosu (yoksa yalnızca BYOK) |
| `GOOGLE_TTS_API_KEY` | HD ses demosu (Cloud TTS Chirp 3 HD) |
| `ELEVENLABS_API_KEY` | Alternatif ses demosu (opsiyonel) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Kalıcı demo sayaçları + galeri |
| `DEMO_DAILY_LIMIT` | LLM demo: istek/IP/gün (varsayılan 150) |
| `TTS_DEMO_CHAR_LIMIT` | TTS demo: karakter/IP/gün (varsayılan 12000) |
| `DEEPSEEK_MODEL` / `GROQ_MODEL` / `OPENAI_MODEL` / `ANTHROPIC_MODEL` / `GEMINI_TTS_MODEL` / `ELEVENLABS_MODEL` | Model override (opsiyonel) |

`vercel.json` içindeki rewrite'lar `/s/:slug`'ı SSR transkript sayfasına,
`/sitemap.xml`'i dinamik sitemap'e yönlendirir.

## Proje yapısı

```
api/
  chat.ts            LLM proxy giriş noktası
  tts.ts             HD ses proxy'si (Chirp 3 HD / ElevenLabs / Gemini)
  context.ts         Güncel konu grounding (web özeti)
  gallery.ts         Yayın galerisi (yayınla/oku/listele/kaldır)
  session-page.ts    /s/:slug için SSR indekslenebilir transkript
  sitemap.ts         Dinamik sitemap
  _lib/              Ortak handler mantığı (chat/tts/context/gallery)
src/
  lib/
    wikipedia.ts     Konuk seçimi + Vikipedi zenginleştirme (TR/EN)
    pool.ts          Küratörlü kişi/konu havuzları (TR/EN)
    prompts.ts       Persona + yönetmen + kızışma + güvenlik promptları
    engine.ts        Yönetmen/konuk çağrıları + dil güvenlik ağı
    elevenTts.ts     HD ses istemcisi (ses atama, önbellek, boru)
    tts.ts           Tarayıcı Web Speech yedeği
    gallery.ts       Galeri istemcisi (yayın + owner token)
    i18n.ts          TR/EN sözlük + dil tespiti
    store.ts         localStorage (anahtarlar, hız, hazır konuklar)
    shareCard.ts     Paylaşılabilir görsel kart (Canvas)
    moderatorLines.ts Spiker replikleri (iki dil, iki ton)
    safety.ts        İçerik güvenliği (deterministik ön-filtre)
    gamification.ts  Reyting takibi, rozetler, sezon sonucu
  components/        SetupScreen, HeroStage, ChatStream, RatingMeter,
                     ModeratorBar, ApiKeyModal, PublicGallery,
                     SessionResultScreen, I18nProvider
  App.tsx            Durum makinesi + tur döngüsü + akış borusu
```

## Not

Oturumlardaki konuşmalar yapay zekâ tarafından üretilmiş **kurgusal**
canlandırmalardır; adı geçen gerçek ya da tarihî kişilerin gerçek görüşlerini
yansıtmaz, onlar adına konuşmaz. Amaç düşündürmek ve tartışma kültürünü
beslemektir.
