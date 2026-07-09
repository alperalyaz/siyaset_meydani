import { useState } from "react";

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
          title={running ? "Sayın konuklar, lütfen durun" : "Devam edin"}
        >
          {running ? "⏸ Durun" : "▶ Devam"}
        </button>

        <input
          className="modbar__input"
          placeholder="Spiker olarak söz alın… (soru sorun, yönlendirin)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />

        {ttsSupported && (
          <button
            className={`btn btn--ghost btn--icon ${ttsOn ? "btn--on" : ""}`}
            onClick={onToggleTts}
            title={ttsOn ? "Seslendirme açık" : "Seslendirme kapalı"}
          >
            {ttsOn ? "🔊" : "🔇"}
          </button>
        )}

        {ttsSupported && ttsOn && onToggleHd && (
          <button
            className={`btn btn--ghost btn--icon ${hdOn ? "btn--on" : ""}`}
            onClick={onToggleHd}
            title={hdOn ? "HD sesler açık (ElevenLabs)" : "HD sesler kapalı — açmak için dokunun"}
          >
            🎧
          </button>
        )}

        {ttsSupported && ttsOn && ttsRate !== undefined && onTtsRateChange && (
          <div className="tts-rate">
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => onTtsRateChange(Math.max(0.5, ttsRate - 0.25))}
              title="Yavaşlat"
              disabled={ttsRate <= 0.5}
            >
              🐢
            </button>
            <span className="tts-rate__val">{ttsRate.toFixed(2)}x</span>
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => onTtsRateChange(Math.min(2.0, ttsRate + 0.25))}
              title="Hızlandır"
              disabled={ttsRate >= 2.0}
            >
              🐇
            </button>
          </div>
        )}

        {onSave && hasUtterances && (
          <button className="btn btn--ghost btn--icon" onClick={onSave} title="Oturumu kaydet">
            💾
          </button>
        )}

        {onShare && hasUtterances && (
          <button className="btn btn--ghost btn--icon" onClick={onShare} title="Paylaş">
            📤
          </button>
        )}

        {onEndSession && hasUtterances && (
          <button className="btn btn--ghost btn--icon" onClick={onEndSession} title="Oturumu bitir">
            🔚
          </button>
        )}

        <button
          className="btn btn--ghost btn--icon"
          onClick={onSuggest}
          disabled={loadingSuggestions}
          title="Soru öner"
        >
          {loadingSuggestions ? "…" : "💡"}
        </button>

        <button className="btn btn--primary" onClick={send} disabled={!text.trim()}>
          Söz Ver
        </button>
      </div>
      {busy && <div className="modbar__hint">Konuklar hararetle tartışıyor…</div>}
    </div>
  );
}
