import { useState } from "react";

interface Props {
  running: boolean;
  busy: boolean;
  suggestions: string[];
  loadingSuggestions: boolean;
  onSend: (text: string) => void;
  onPauseToggle: () => void;
  onSuggest: () => void;
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
