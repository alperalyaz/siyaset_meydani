import { useEffect, useState } from "react";
import { fetchGalleryList, type GalleryItem } from "../lib/gallery";
import { useT } from "../lib/i18n";

// Ana sayfada "yayınlanan oturumlar" bölümü. Kullanıcıların RIZAYLA
// yayınladığı oturumlara bağlantı verir; sayfalar /s/:slug altında
// sunucudan üretildiği için Google tarafından indekslenebilir.
export function PublicGallery() {
  const { t, lang } = useT();
  const [items, setItems] = useState<GalleryItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchGalleryList(8)
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (items === null || items.length === 0) return null; // boşken bölüm hiç görünmez

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "";
    }
  };

  return (
    <section className="setup__block gallery">
      <div className="setup__block-head">
        <h2>{t("gallery.title")}</h2>
      </div>
      <div className="gallery__list">
        {items.map((s) => (
          <a key={s.slug} className="gallery__item" href={`/s/${s.slug}`} target="_blank" rel="noopener">
            <div className="gallery__topic">{s.topic}</div>
            <div className="gallery__meta">
              {(s.guestNames ?? []).slice(0, 4).join(" · ")}
              <span className="gallery__date">{fmt(s.created_at)}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
