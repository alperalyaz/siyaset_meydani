# CLAUDE.md

## 🔴 DEPLOY YALNIZ KULLANICI "DEPLOY" DEYİNCE — İSTİSNA YOK (kullanıcı kararı 2026-10-01)

Kullanıcı: *"sayfa patlasa da çatlasa da ben deploy demeden deploy yapmasın."* Kullanıcının bütün projelerinde geçerli.

- **Deploy** = canlıya kod çıkaran her işlem: canlı dala push, Vercel'de yeniden yayın / öne alma (promote) /
  **geri alma (rollback)**, Supabase Edge Function deploy, Apps Script'e kod gönderme.
- **Canlı kırık olsa da istisna YOK.** "Acil", "daha önce çalışıyordu", "tek satırlık düzeltme" gerekçe değildir.
- **Bir "deploy" = bir yayın.** Yayından sonra çıkan hata için kullanıcıya YENİDEN sorulur. Başka oturumda verilen
  "deploy" bu oturuma izin değildir.
- **Canlı kırıksa boş durma:** düzelt, dene, `bekleyen/<konu>` dalına koy, kullanıcıya TEK mesaj yaz:
  `🔴 CANLI KIRIK: <ne bozuk> — <kimi etkiliyor> — düzeltme hazır (<dal>) — "deploy" dersen canlıya çıkar.`
- **"Deploy edeyim mi?" diye ısrar etme.** İş bitince bittiğini söyle ve bekle; yayını kullanıcı ister.
- Veritabanı işleri (migration, veri düzeltme) bu kuralın konusu değil; onların kendi kuralları geçerli.

## 🗂️ BEKLEYEN DAL — biten iş burada birikir (kullanıcı kararı 2026-10-02)

Kullanıcı: *"bekleyen diye dal yapsın, tüm repolar commitleri orada biriktirsin; ben demeden asla deploy istemiyorum."*

- Biten ve denenmiş iş **`bekleyen/<konu>`** dalına itilir: `git push origin HEAD:bekleyen/<konu>`
  (aynı dalı güncellerken `--force-with-lease`). Her iş KENDİ dalında — aynı anda çalışan oturumlar
  birbirinin işini ezmesin. Yarım iş konmaz: bekleyen dal "hazır, deploy bekliyor" demektir.
- Kendi `claude/...` dalına yedek push serbest. Canlı dala push YOK.
- **Kullanıcı "deploy" deyince:** `git fetch origin` → BÜTÜN `origin/bekleyen/*` dallarını kullanıcıya listele →
  canlı dala birleştir → derle/dene → **TEK** push → yayının gerçekten oluştuğunu doğrula → birleşen dalları sil
  (bulut oturumunda silme 403 verirse bırak, zararsız).

## Bu projede yayın nasıl oluşur

- Vercel projesi **`siyaset-meydani`**, canlı dal **`main`**. Canlı dala KOD push'u = CANLIYA YAYIN.
- Yalnız belge değişen push (`*.md`, `docs/`, `sql/`, `.github/`) derlenmez — Vercel proje ayarı
  "Ignored Build Step" (2026-10-02). ⚠️ Canlı dalda yayınlanmamış kod varken ya da başka bir yayın
  sürerken gönderilen belge push'u da DERLER; önce kontrol et.
- Yan dallar (`bekleyen/*`, `claude/*`) derlenmez — Vercel'de önizleme yayınları kapalı (2026-10-02).

