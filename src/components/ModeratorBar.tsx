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
  hdOn?: boolean;
  onToggleHd?: () => void;
}

// Spiker kontrol çubuğu: müdahale, duraklat/devam, hazır soru önerileri.
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
  hdOn,
  onToggleHd,
}: Props) {
  const { t } = useT();
  const [text, setText] = useState("");

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
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

      <div className="modbar__row">
        <button
          className={`btn btn--pause ${running ? "" : "btn--resume"}`}
          onClick={onPauseToggle}
          title={running ? t("mod.pauseTitle") : t("mod.resumeTitle")}
        >
          {running ? t("mod.pause") : t("mod.resume")}
        </button>

        <input
          className="modbar__input"
          placeholder={t("mod.input")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />

        {ttsSupported && (
          <button
            className={`btn btn--ghost btn--icon ${ttsOn ? "btn--on" : ""}`}
            onClick={onToggleTts}
            title={ttsOn ? t("mod.ttsOn") : t("mod.ttsOff")}
          >
            {ttsOn ? "🔊" : "🔇"}
          </button>
        )}

        {ttsSupported && ttsOn && onToggleHd && (
          <button
            className={`btn btn--ghost btn--icon ${hdOn ? "btn--on" : ""}`}
            onClick={onToggleHd}
            title={hdOn ? t("mod.hdOn") : t("mod.hdOff")}
          >
            🎧
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

        {onEndSession && hasUtterances && (
          <button className="btn btn--ghost btn--icon" onClick={onEndSession} title={t("mod.end")}>
            🔚
          </button>
        )}

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
      {busy && <div className="modbar__hint">{t("mod.busy")}</div>}
    </div>
  );
}
