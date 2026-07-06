import { useCallback, useState } from "react";
import type { Guest } from "../types";
import { pickCuratedGuests, buildGuestsFromNames } from "../lib/wikipedia";
import { suggestGuestNames } from "../lib/engine";
import { TOPIC_POOL } from "../lib/pool";

type Mode = "topic" | "random";

interface Props {
  onStart: (guests: Guest[], topic: string) => void;
  onOpenKey: () => void;
  onError: (e: unknown) => void;
  apiKey: string | null;
  demoRemaining: number | null;
  hasKey: boolean;
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function SetupScreen({ onStart, onOpenKey, onError, apiKey, demoRemaining, hasKey }: Props) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("topic");
  const [topic, setTopic] = useState("");

  const drawRandom = useCallback(async () => {
    setLoading(true);
    setGuests(null);
    try {
      setGuests(await pickCuratedGuests(3));
    } finally {
      setLoading(false);
    }
  }, []);

  const drawForTopic = useCallback(
    async (t: string) => {
      const q = t.trim();
      if (!q) return;
      setLoading(true);
      setGuests(null);
      try {
        const names = await suggestGuestNames(q, apiKey);
        setGuests(await buildGuestsFromNames(names, 3));
      } catch (e) {
        onError(e);
        // Konuya göre başarısızsa küratörlü havuza düş.
        try {
          setGuests(await pickCuratedGuests(3));
        } catch {
          /* yoksay */
        }
      } finally {
        setLoading(false);
      }
    },
    [apiKey, onError],
  );

  const pickTopic = useCallback(
    (t: string) => {
      setTopic(t);
      if (mode === "topic") void drawForTopic(t);
    },
    [mode, drawForTopic],
  );

  const reshuffle = useCallback(() => {
    if (mode === "random") void drawRandom();
    else void drawForTopic(topic);
  }, [mode, drawRandom, drawForTopic, topic]);

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setGuests(null);
      if (m === "random") void drawRandom();
    },
    [drawRandom],
  );

  const canStart = !!guests && guests.length === 3 && topic.trim().length > 0 && !loading;

  return (
    <div className="setup">
      <header className="setup__hero">
        <h1>Siyaset Meydanı</h1>
        <p className="setup__tag">
          Bir konu seçin; o konunun ünlülerini aynı masada tartıştıralım. Siz spikersiniz.
        </p>
      </header>

      {/* 1) KONU */}
      <section className="setup__block">
        <h2>1 · Bugünün Konusu</h2>
        <div className="topic-chips">
          {TOPIC_POOL.map((t) => (
            <button
              key={t}
              className={`chip ${topic === t ? "chip--active" : ""}`}
              onClick={() => pickTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="topic-row">
          <input
            className="topic-input"
            placeholder="…ya da kendi konunuzu yazın (futbol, uzay, felsefe…)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mode === "topic" && drawForTopic(topic)}
          />
          {mode === "topic" && (
            <button
              className="btn btn--primary"
              disabled={!topic.trim() || loading}
              onClick={() => drawForTopic(topic)}
            >
              Konukları getir
            </button>
          )}
        </div>
      </section>

      {/* 2) KONUKLAR */}
      <section className="setup__block">
        <div className="setup__block-head">
          <h2>2 · Sayın Konuklar</h2>
          <div className="setup__draw-controls">
            <div className="modetabs">
              <button
                className={`modetab ${mode === "topic" ? "modetab--on" : ""}`}
                onClick={() => switchMode("topic")}
              >
                Konuya göre
              </button>
              <button
                className={`modetab ${mode === "random" ? "modetab--on" : ""}`}
                onClick={() => switchMode("random")}
              >
                🎲 Rastgele sürpriz
              </button>
            </div>
            {guests && (
              <button className="btn btn--ghost" onClick={reshuffle} disabled={loading}>
                ↻ Yeniden
              </button>
            )}
          </div>
        </div>

        <div className="guest-cards">
          {loading &&
            [0, 1, 2].map((i) => <div key={i} className="guest-card guest-card--skeleton" />)}
          {!loading && !guests && (
            <div className="guest-empty">
              {mode === "topic"
                ? "Bir konu seçin ya da yazıp “Konukları getir”e basın; o konunun isimlerini masaya davet edeyim."
                : "“🎲 Rastgele sürpriz” ile çağlar arası üç konuk çekelim."}
            </div>
          )}
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
