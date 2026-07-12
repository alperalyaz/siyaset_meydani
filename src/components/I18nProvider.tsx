import { useCallback, useEffect, useState, type ReactNode } from "react";
import { I18nContext, detectLang, saveLang, setCurrentLang, translate, type Lang } from "../lib/i18n";

// Arayüz dili sağlayıcısı. Kök seviyede sarar; tüm bileşenler useT() ile okur.
// Ayrıca modül seviyesi dili (ct() için) senkron tutar.
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  useEffect(() => {
    setCurrentLang(lang);
    saveLang(lang);
    try {
      document.documentElement.lang = lang;
      document.title =
        lang === "en"
          ? "debate.be — AI Panel Debate Arena"
          : "debate.be · Siyaset Meydanı — Yapay Zeka Açık Oturumu";
    } catch {
      /* yoksay */
    }
  }, [lang]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );

  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}
