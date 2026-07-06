import { useCallback, useRef, useState } from "react";
import type { Guest } from "../types";
import { buildGuestsFromNames, resolveGuestByName } from "../lib/wikipedia";
import { suggestGuestNames, suggestTopicIdeas, fetchEksiContext } from "../lib/engine";
import { TOPIC_POOL } from "../lib/pool";

interface Props {
  onStart: (guests: Guest[], topic: string, context?: string | null) => void;
  onOpenKey: () => void;
  onError: (e: unknown) => void;
  apiKey: string | null;
  demoRemaining: number | null;
  hasKey: boolean;
  checking: boolean;
}

const MAX_GUESTS = 4;

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function isEksiUrl(s: string): boolean {
  return /^https?:\/\/(www\.)?eksisozluk\.com\//i.test(s.trim());
}

export function SetupScreen({ onStart, onOpenKey, onError, apiKey, demoRemaining, hasKey, checking }: Props) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<2 | 3>(3);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState<string>(""); // (Ekşi linki) grounding metni

  const [extraTopics, setExtraTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Daha önce önerilmiş isimler — "Yeniden"de tekrar gelmesinler (çeşitlilik).
  const shownNamesRef = useRef<string[]>([]);

  const drawForTopic = useCallback(
    async (t: string, cnt: number, ctx: string) => {
      const q = t.trim();
      if (!q) return;
      setLoading(true);
      setGuests(null);
      setAddMsg(null);
      try {
        const names = await suggestGuestNames(q, ctx || null, shownNamesRef.current, apiKey);
        shownNamesRef.current = [...shownNamesRef.current, ...names].slice(-40);
        const g = await buildGuestsFromNames(names, cnt);
        shownNamesRef.current = [...shownNamesRef.current, ...g.map((x) => x.name)].slice(-40);
        setGuests(g);
      } catch (e) {
        onError(e);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, onError],
  );

  const pickTopic = useCallback(
    (t: string) => {
      setTopic(t);
      setContext("");
      shownNamesRef.current = []; // yeni konu: geçmişi sıfırla
      void drawForTopic(t, count, "");
    },
    [drawForTopic, count],
  );

  // Kendi konunuz / Ekşi linki → (link ise entry'ler grounding olarak yüklenir)
  const fetchGuestsForInput = useCallback(async () => {
    let ctx = "";
    const t = topic.trim();
    if (isEksiUrl(t)) {
      const entries = await fetchEksiContext(t).catch(() => "");
      if (entries) ctx = entries;
    }
    setContext(ctx);
    shownNamesRef.current = [];
    void drawForTopic(t, count, ctx);
  }, [topic, count, drawForTopic]);

  const reshuffle = useCallback(() => {
    if (topic.trim()) void drawForTopic(topic, count, context);
  }, [topic, count, context, drawForTopic]);

  const changeCount = useCallback(
    (c: 2 | 3) => {
      setCount(c);
      if (topic.trim()) void drawForTopic(topic, c, context);
    },
    [topic, context, drawForTopic],
  );

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const avoid = [...TOPIC_POOL, ...extraTopics];
      const fresh = await suggestTopicIdeas(avoid, apiKey);
      if (fresh.length) setExtraTopics((prev) => [...fresh, ...prev].slice(0, 24));
    } catch (e) {
      onError(e);
    } finally {
      setLoadingTopics(false);
    }
  }, [apiKey, onError, extraTopics]);

  const addGuest = useCallback(async () => {
    const q = addName.trim();
    if (!q) return;
    setAdding(true);
    setAddMsg(null);
    try {
      const g = await resolveGuestByName(q);
      if (!g) {
        setAddMsg(`"${q}" Vikipedi'de bir kişi olarak bulunamadı. İsmi tam yazmayı ya da linkini yapıştırmayı deneyin.`);
        return;
      }
      setGuests((prev) => {
        const cur = prev ?? [];
        if (cur.some((x) => x.name.toLowerCase() === g.name.toLowerCase())) return cur;
        return [...cur, g].slice(0, MAX_GUESTS).map((x, i) => ({ ...x, color: colorAt(i) }));
      });
      shownNamesRef.current.push(g.name);
      setAddName("");
    } catch (e) {
      onError(e);
    } finally {
      setAdding(false);
    }
  }, [addName, onError]);

  const removeGuest = useCallback((name: string) => {
    setGuests((prev) =>
      (prev ?? []).filter((g) => g.name !== name).map((x, i) => ({ ...x, color: colorAt(i) })),
    );
  }, []);

  const canStart = !!guests && guests.length >= 2 && topic.trim().length > 0 && !loading;

  return (
    <div className="setup">
      <header className="setup__hero">
        <h1>Siyaset Meydanı</h1>
        <p className="setup__tag">
          Sokaktaki adamın konularını, çağlar ötesi şahsiyetlere tartıştırın. Siz spikersiniz.
        </p>
      </header>

      {/* 1) KONU */}
      <section className="setup__block">
        <div className="setup__block-head">
          <h2>1 · Bugünün Konusu</h2>
          <button className="btn btn--ghost" onClick={() => loadTopics()} disabled={loadingTopics}>
            {loadingTopics ? "Konu üretiliyor…" : "🎲 Başka konular öner"}
          </button>
        </div>

        <div className="topic-chips">
          {extraTopics.map((t) => (
            <button
              key={t}
              className={`chip chip--fresh ${topic === t ? "chip--active" : ""}`}
              onClick={() => pickTopic(t)}
            >
              {t}
            </button>
          ))}
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
            onKeyDown={(e) => e.key === "Enter" && fetchGuestsForInput()}
          />
          <button
            className="btn btn--primary"
            disabled={!topic.trim() || loading}
            onClick={() => fetchGuestsForInput()}
          >
            Konukları getir
          </button>
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
            {guests && guests.length > 0 && (
              <button className="btn btn--ghost" onClick={reshuffle} disabled={loading}>
                ↻ Başkaları
              </button>
            )}
          </div>
        </div>

        <div className="guest-cards">
          {loading &&
            Array.from({ length: count }, (_, i) => (
              <div key={i} className="guest-card guest-card--skeleton" />
            ))}
          {!loading && (!guests || guests.length === 0) && (
            <div className="guest-empty">
              Bir konu seçin ya da yazıp “Konukları getir”e basın; o konunun çağlar-ötesi isimlerini
              masaya davet edeyim. Dilerseniz aşağıdan kendi konuğunuzu da ekleyebilirsiniz.
            </div>
          )}
          {!loading &&
            guests?.map((g) => (
              <div key={g.name} className="guest-card" style={{ borderColor: g.color }}>
                <button
                  className="guest-card__remove"
                  onClick={() => removeGuest(g.name)}
                  title="Çıkar"
                >
                  ×
                </button>
                <div className="guest-card__avatar" style={{ background: g.color }}>
                  {g.thumbnail ? <img src={g.thumbnail} alt={g.name} /> : <span>{initials(g.name)}</span>}
                </div>
                <div className="guest-card__name">{g.name}</div>
                <div className="guest-card__era">{g.era}</div>
                <p className="guest-card__blurb">{g.blurb}</p>
              </div>
            ))}
        </div>

        {/* Kendi konuğunu ekle */}
        <div className="topic-row addguest-row">
          <input
            className="topic-input"
            placeholder="Kendi konuğunuzu ekleyin: bir isim yazın (ör. Sun Tzu) ya da Vikipedi linki"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGuest()}
            disabled={(guests?.length ?? 0) >= MAX_GUESTS}
          />
          <button
            className="btn btn--ghost"
            onClick={() => addGuest()}
            disabled={!addName.trim() || adding || (guests?.length ?? 0) >= MAX_GUESTS}
          >
            {adding ? "Aranıyor…" : "＋ Ekle"}
          </button>
        </div>
        {addMsg && <p className="context-hint" style={{ color: "var(--danger)" }}>{addMsg}</p>}
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

const COLORS = ["#e94b6b", "#3fb6c9", "#f2b134", "#8b7bd8"];
function colorAt(i: number): string {
  return COLORS[i % COLORS.length];
}
