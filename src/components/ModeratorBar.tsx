import { useState } from "react";
import { useT } from "../lib/i18n";

interface Props {
  running: boolean;
  busy: boolean;
  suggestions: string[];
  loadingSuggestions: boolean;
  onSend: (text: string) => void;
  onPauseToggle: () => void;
  onSuggest: () => void;
  onSave?: () => void;
  onEndSession?: () => void;
  onShare?: () => void;
  hasUtterances?: boolean;
  ttsOn: boolean;
  ttsSupported: boolean;
  onToggleTts: () => void;
  ttsRate?: number;
  onTtsRateChange?: (rate: number) => void;
  onOpenKey?: () => void;
}

// Spiker kontrol çubuğu — İKİ satır:
//   1) ana akış: duraklat/devam + söz alma girişi + soru öner + Söz Ver
//   2) araçlar: solda ses (aç/kapa + hız), sağda kaydet/paylaş/ayarlar ve
//      BELİRGİN "Programı Bitir" düğmesi (kapanış + karne).
export function ModeratorBar({
  running,
  busy,
  suggestions,
  loadingSuggestions,
  onSend,
  onPauseToggle,
  onSuggest,
  onSave,
  onEndSession,
  onShare,
  hasUtterances,
  ttsOn,
  ttsSupported,
  onToggleTts,
  ttsRate,
  onTtsRateChange,
  onOpenKey,
}: Props) {
  const { t } = useT();
  const [text, setText] = useState("");

  const send = () => {
    const s = text.trim();
    if (!s) return;
    onSend(s);
    setText("");
  };

  return (
    <div className="modbar">
      {suggestions.length > 0 && (
        <div className="modbar__suggestions">
          {suggestions.map((s, i) => (
            <button key={i} className="chip chip--sm" onClick={() => onSend(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="modbar__row modbar__row--main">
        <button
          className={`btn btn--pause ${running ? "" : "btn--resume"}`}
          onClick={onPauseToggle}
          title={running ? t("mod.pauseTitle") : t("mod.resumeTitle")}
        >
          {running ? t("mod.pause") : t("mod.resume")}
        </button>

        <textarea
          className="modbar__input"
          placeholder={t("mod.input")}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter → satır atla; Ctrl/Cmd+Enter → gönder.
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
        />

        <button
          className="btn btn--ghost btn--icon"
          onClick={onSuggest}
          disabled={loadingSuggestions}
          title={t("mod.suggest")}
        >
          {loadingSuggestions ? "…" : "💡"}
        </button>

        <button className="btn btn--primary" onClick={send} disabled={!text.trim()}>
          {t("mod.give")}
        </button>
      </div>

      <div className="modbar__row modbar__row--tools">
        <div className="modbar__group">
          {ttsSupported && (
            <button
              className={`btn btn--ghost btn--icon ${ttsOn ? "btn--on" : ""}`}
              onClick={onToggleTts}
              title={ttsOn ? t("mod.ttsOn") : t("mod.ttsOff")}
            >
              {ttsOn ? "🔊" : "🔇"}
            </button>
          )}
          {ttsSupported && ttsOn && ttsRate !== undefined && onTtsRateChange && (
            <div className="tts-rate">
              <button
                className="btn btn--ghost btn--icon btn--sm"
                onClick={() => onTtsRateChange(Math.max(0.5, ttsRate - 0.25))}
                title={t("mod.slower")}
                disabled={ttsRate <= 0.5}
              >
                🐢
              </button>
              <span className="tts-rate__val">{ttsRate.toFixed(2)}x</span>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                onClick={() => onTtsRateChange(Math.min(2.0, ttsRate + 0.25))}
                title={t("mod.faster")}
                disabled={ttsRate >= 2.0}
              >
                🐇
              </button>
            </div>
          )}
        </div>

        <div className="modbar__group">
          {onSave && hasUtterances && (
            <button className="btn btn--ghost btn--icon" onClick={onSave} title={t("mod.save")}>
              💾
            </button>
          )}
          {onShare && hasUtterances && (
            <button className="btn btn--ghost btn--icon" onClick={onShare} title={t("mod.share")}>
              📤
            </button>
          )}
          {onOpenKey && (
            <button className="btn btn--ghost btn--icon" onClick={onOpenKey} title={t("mod.settings")}>
              ⚙️
            </button>
          )}
          {onEndSession && hasUtterances && (
            <button className="btn btn--final" onClick={onEndSession} title={t("mod.end")}>
              🏁 {t("mod.finish")}
            </button>
          )}
        </div>
      </div>

      {busy && <div className="modbar__hint">{t("mod.busy")}</div>}
    </div>
  );
}
