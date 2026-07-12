import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";

// Hero'daki stüdyo sahnesi: 4 ünlü zihin GERÇEK portreleriyle (Wikipedia)
// masada; konuşma balonları sırayla belirir, konuşan konuğun halkası parlar
// ve altında mini ekolayzer oynar. Portreler en.wikipedia REST özetinden
// çekilir ve localStorage'da önbelleklenir; yüklenene dek emoji gösterilir.
// Kadro BİLEREK dört ayrı çağdan — "çağlar ötesi masa" iddiası ilk bakışta
// okunmalı (iki antik figür yan yana bu zenginliği öldürüyordu).
const CAST = [
  {
    key: "socrates",
    title: "Socrates",
    name: "Sokrates",
    nameEn: "Socrates",
    eraTr: "Antik Yunan",
    eraEn: "Ancient Greece",
    emoji: "🏛️",
    color: "#e0447a",
    qTr: "Peki… adalet tam olarak nedir?",
    qEn: "But tell me — what exactly is justice?",
  },
  {
    key: "leonardo",
    title: "Leonardo_da_Vinci",
    name: "Da Vinci",
    nameEn: "Da Vinci",
    eraTr: "Rönesans",
    eraEn: "Renaissance",
    emoji: "🎨",
    color: "#8e6cf0",
    qTr: "Basitlik, en büyük ustalıktır.",
    qEn: "Simplicity is the ultimate sophistication.",
  },
  {
    key: "marx",
    title: "Karl_Marx",
    name: "Karl Marx",
    nameEn: "Karl Marx",
    eraTr: "19. yüzyıl",
    eraEn: "19th century",
    emoji: "⚒️",
    color: "#e05555",
    qTr: "Zincirlerinizden başka kaybedecek neyiniz var?",
    qEn: "You have nothing to lose but your chains.",
  },
  {
    key: "curie",
    title: "Marie_Curie",
    name: "Marie Curie",
    nameEn: "Marie Curie",
    eraTr: "20. yüzyıl",
    eraEn: "20th century",
    emoji: "🧪",
    color: "#3fb6c9",
    qTr: "Korkma — sadece anla.",
    qEn: "Nothing is to be feared, only understood.",
  },
];

const IMG_CACHE_KEY = "siyaset_meydani_hero_imgs_v1";

function loadCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(IMG_CACHE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function HeroStage() {
  const { lang } = useT();
  const [imgs, setImgs] = useState<Record<string, string>>(loadCache);

  useEffect(() => {
    const missing = CAST.filter((c) => !imgs[c.key]);
    if (missing.length === 0) return;
    let alive = true;
    void Promise.all(
      missing.map(async (c) => {
        try {
          const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(c.title)}`,
          );
          if (!res.ok) return null;
          const data = (await res.json()) as { thumbnail?: { source?: string } };
          const src = data.thumbnail?.source;
          return src ? ([c.key, src] as const) : null;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (!alive) return;
      const found = pairs.filter(Boolean) as (readonly [string, string])[];
      if (!found.length) return;
      setImgs((prev) => {
        const next = { ...prev };
        for (const [k, v] of found) next[k] = v;
        try {
          localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(next));
        } catch {
          /* yoksay */
        }
        return next;
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hero-stage" aria-hidden="true">
      {CAST.map((c, i) => (
        <div key={c.key} className="hero-guest" style={{ animationDelay: `${i * 1.1}s` }}>
          <span className="hero-guest__bubble" style={{ animationDelay: `${i * 3}s` }}>
            {lang === "en" ? c.qEn : c.qTr}
          </span>
          <span
            className="hero-guest__ring"
            style={{ animationDelay: `${i * 3}s`, ["--ring" as string]: c.color }}
          >
            <span className="hero-guest__avatar" style={{ background: c.color }}>
              {imgs[c.key] ? <img src={imgs[c.key]} alt="" loading="eager" /> : c.emoji}
            </span>
          </span>
          <span className="hero-eq" style={{ animationDelay: `${i * 3}s` }}>
            <i /><i /><i />
          </span>
          <span className="hero-guest__name">{lang === "en" ? c.nameEn : c.name}</span>
          <span className="hero-guest__era">{lang === "en" ? c.eraEn : c.eraTr}</span>
        </div>
      ))}
    </div>
  );
}
