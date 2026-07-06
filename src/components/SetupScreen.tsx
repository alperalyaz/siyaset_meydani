import { useCallback, useEffect, useState } from "react";
import type { Guest } from "../types";
import { pickCuratedGuests, pickLivePopularGuests } from "../lib/wikipedia";
import { TOPIC_POOL } from "../lib/pool";

interface Props {
  onStart: (guests: Guest[], topic: string) => void;
  onOpenKey: () => void;
  demoRemaining: number | null;
  hasKey: boolean;
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function SetupScreen({ onStart, onOpenKey, demoRemaining, hasKey }: Props) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [topic, setTopic] = useState("");

  const draw = useCallback(async (useLive: boolean) => {
    setLoading(true);
    setGuests(null);
    try {
      const g = useLive ? await pickLivePopularGuests(3) : await pickCuratedGuests(3);
      setGuests(g);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    draw(false);
  }, [draw]);

  const canStart = !!guests && guests.length === 3 && topic.trim().length > 0;

  return (
    <div className="setup">
      <header className="setup__hero">
        <h1>Siyaset Meydanı</h1>
        <p className="setup__tag">
          Vikipedi'den rastgele seçilmiş üç konuk, tek masada. Siz spikersiniz.
        </p>
      </header>

      <section className="setup__block">
        <div className="setup__block-head">
          <h2>Sayın Konuklar</h2>
          <div className="setup__draw-controls">
            <label className="switch">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => {
                  setLive(e.target.checked);
                  draw(e.target.checked);
                }}
              />
              <span>Vikipedi'de popüler olanlardan çek</span>
            </label>
            <button className="btn btn--ghost" onClick={() => draw(live)} disabled={loading}>
              🎲 Yeniden seç
            </button>
          </div>
        </div>

        <div className="guest-cards">
          {loading &&
            [0, 1, 2].map((i) => <div key={i} className="guest-card guest-card--skeleton" />)}
          {!loading &&
            guests?.map((g) => (
              <div key={g.name} className="guest-card" style={{ borderColor: g.color }}>
                <div className="guest-card__avatar" style={{ background: g.color }}>
                  {g.thumbnail ? <img src={g.thumbnail} alt={g.name} /> : <span>{initials(g.name)}</span>}
                </div>
                <div className="guest-card__name">{g.name}</div>
                <div className="guest-card__era">{g.era}</div>
                <p className="guest-card__blurb">{g.blurb}</p>
              </div>
            ))}
        </div>
      </section>

      <section className="setup__block">
        <h2>Bugünün Konusu</h2>
        <div className="topic-chips">
          {TOPIC_POOL.map((t) => (
            <button
              key={t}
              className={`chip ${topic === t ? "chip--active" : ""}`}
              onClick={() => setTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          className="topic-input"
          placeholder="…ya da kendi konunuzu yazın"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </section>

      <div className="setup__footer">
        <button className="btn btn--primary btn--big" disabled={!canStart} onClick={() => onStart(guests!, topic.trim())}>
          Oturumu Aç ▶
        </button>
        <div className="setup__meta">
          {hasKey ? (
            <button className="linklike" onClick={onOpenKey}>
              🔑 Kendi anahtarınız kullanılıyor
            </button>
          ) : (
            <>
              <span>
                {demoRemaining !== null
                  ? `Demo hakkı: ~${demoRemaining} istek`
                  : "Kısa demo · sonra kendi anahtarınız"}
              </span>
              <button className="linklike" onClick={onOpenKey}>
                🔑 Ücretsiz anahtar (Groq) / API gir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
