import { useCallback, useState } from "react";
import type { Guest } from "../types";
import { pickCuratedGuests, buildGuestsFromNames } from "../lib/wikipedia";
import {
  suggestGuestNames,
  fetchTrends,
  curateTrendTopics,
  fetchEksiContext,
  type TrendTopic,
} from "../lib/engine";
import { TOPIC_POOL } from "../lib/pool";

type Mode = "topic" | "random";

interface Props {
  onStart: (guests: Guest[], topic: string, context?: string | null) => void;
  onOpenKey: () => void;
  onError: (e: unknown) => void;
  apiKey: string | null;
  demoRemaining: number | null;
  hasKey: boolean;
  checking: boolean;
}

function isEksiUrl(s: string): boolean {
  return /^https?:\/\/(www\.)?eksisozluk\.com\//i.test(s.trim());
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function SetupScreen({ onStart, onOpenKey, onError, apiKey, demoRemaining, hasKey, checking }: Props) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("topic");
  const [count, setCount] = useState<2 | 3>(2);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState<string>(""); // güncel olay grounding metni
  const [trends, setTrends] = useState<TrendTopic[] | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);

  const drawRandom = useCallback(async (cnt: number) => {
    setLoading(true);
    setGuests(null);
    try {
      setGuests(await pickCuratedGuests(cnt));
    } finally {
      setLoading(false);
    }
  }, []);

  const drawForTopic = useCallback(
    async (t: string, cnt: number, ctx: string) => {
      const q = t.trim();
      if (!q) return;
      setLoading(true);
      setGuests(null);
      try {
        const names = await suggestGuestNames(q, ctx || null, apiKey);
        setGuests(await buildGuestsFromNames(names, cnt));
      } catch (e) {
        onError(e);
        // Konuya göre başarısızsa küratörlü havuza düş.
        try {
          setGuests(await pickCuratedGuests(cnt));
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
      setContext(""); // hazır/küratörlü konu: grounding yok
      if (mode === "topic") void drawForTopic(t, count, "");
    },
    [mode, drawForTopic, count],
  );

  const loadTrends = useCallback(async () => {
    setLoadingTrends(true);
    try {
      const raw = await fetchTrends();
      // Ham arama terimlerini tartışmaya hazır konulara çevir (haber bağlamıyla).
      const curated = await curateTrendTopics(raw, apiKey);
      setTrends(curated);
    } catch (e) {
      onError(e);
      setTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  }, [apiKey, onError]);

  // Gündemden hazır bir konu seçildi: konu cümlesi + haber snippet'leri grounding.
  const pickTrend = useCallback(
    (tt: TrendTopic) => {
      setTopic(tt.topic);
      setContext(tt.context);
      setMode("topic");
      void drawForTopic(tt.topic, count, tt.context);
    },
    [drawForTopic, count],
  );

  // "Konukları getir": Ekşi linki ise entry'leri grounding olarak çeker.
  const fetchGuestsForInput = useCallback(async () => {
    let ctx = context;
    let t = topic.trim();
    if (isEksiUrl(t)) {
      const entries = await fetchEksiContext(t).catch(() => "");
      if (entries) {
        ctx = entries;
        setContext(entries);
      }
    }
    void drawForTopic(t, count, ctx);
  }, [context, topic, count, drawForTopic]);

  const reshuffle = useCallback(() => {
    if (mode === "random") void drawRandom(count);
    else void drawForTopic(topic, count, context);
  }, [mode, drawRandom, drawForTopic, topic, count, context]);

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setGuests(null);
      if (m === "random") void drawRandom(count);
    },
    [drawRandom, count],
  );

  const changeCount = useCallback(
    (c: 2 | 3) => {
      setCount(c);
      setGuests(null);
      if (mode === "random") void drawRandom(c);
      else if (topic.trim()) void drawForTopic(topic, c, context);
    },
    [mode, topic, drawRandom, drawForTopic, context],
  );

  const canStart = !!guests && guests.length >= 2 && topic.trim().length > 0 && !loading;

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
        <div className="setup__block-head">
          <h2>1 · Bugünün Konusu</h2>
          <button
            className="btn btn--ghost"
            onClick={() => {
              if (!trends) void loadTrends();
              else setTrends(null);
            }}
            disabled={loadingTrends}
          >
            {loadingTrends ? "…" : trends ? "Gündemi gizle" : "🔥 Bugünün gündemi"}
          </button>
        </div>

        {trends && (
          <div className="topic-chips trend-chips">
            {trends.length === 0 && (
              <span className="guest-empty" style={{ padding: "0.5rem" }}>
                Bugünün gündeminden tartışmalık bir konu çıkmadı, birazdan tekrar deneyin.
              </span>
            )}
            {trends.map((tt) => (
              <button
                key={tt.topic}
                className={`chip chip--trend ${topic === tt.topic ? "chip--active" : ""}`}
                onClick={() => pickTrend(tt)}
                title={`Gündem: ${tt.source}`}
              >
                🔥 {tt.topic}
              </button>
            ))}
          </div>
        )}

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
            placeholder="…kendi konunuz ya da bir Ekşi başlık linki yapıştırın"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setContext("");
            }}
            onKeyDown={(e) => e.key === "Enter" && mode === "topic" && fetchGuestsForInput()}
          />
          {mode === "topic" && (
            <button
              className="btn btn--primary"
              disabled={!topic.trim() || loading}
              onClick={() => fetchGuestsForInput()}
            >
              Konukları getir
            </button>
          )}
        </div>
        {context && (
          <p className="context-hint">🧭 Güncel bağlam yüklendi — konuklar bu olaya göre konuşacak.</p>
        )}
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
            <div className="modetabs" title="Konuk sayısı">
              <button
                className={`modetab ${count === 2 ? "modetab--on" : ""}`}
                onClick={() => changeCount(2)}
              >
                2 konuk
              </button>
              <button
                className={`modetab ${count === 3 ? "modetab--on" : ""}`}
                onClick={() => changeCount(3)}
              >
                3 konuk
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
            Array.from({ length: count }, (_, i) => (
              <div key={i} className="guest-card guest-card--skeleton" />
            ))}
          {!loading && !guests && (
            <div className="guest-empty">
              {mode === "topic"
                ? "Bir konu seçin ya da yazıp “Konukları getir”e basın; o konunun isimlerini masaya davet edeyim."
                : "“🎲 Rastgele sürpriz” ile çağlar arası konukları çekelim."}
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
        <button
          className="btn btn--primary btn--big"
          disabled={!canStart || checking}
          onClick={() => onStart(guests!, topic.trim(), context || null)}
        >
          {checking ? "Konu kontrol ediliyor…" : "Oturumu Aç ▶"}
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
