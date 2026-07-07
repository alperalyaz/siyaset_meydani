import { useCallback, useRef, useState } from "react";
import type { Guest } from "../types";
import type { SessionMeta } from "../lib/store";
import { buildGuestsFromNames, resolveGuestByName } from "../lib/wikipedia";
import { suggestGuestNames, suggestTopicIdeas } from "../lib/engine";
import { TOPIC_POOL } from "../lib/pool";

interface Props {
  onStart: (guests: Guest[], topic: string, context?: string | null) => void;
  onOpenKey: () => void;
  onError: (e: unknown) => void;
  apiKey: string | null;
  demoRemaining: number | null;
  hasKey: boolean;
  checking: boolean;
  savedSession?: { guests: Guest[]; topic: string; utterances: { id: string; speaker: string | number; text: string; mode: string }[]; rating: number; savedAt: number } | null;
  onClearSession?: () => void;
  sessions?: SessionMeta[];
  onLoadSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

const MAX_GUESTS = 4;

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SetupScreen({ onStart, onOpenKey, onError, apiKey, demoRemaining, hasKey, checking, savedSession, onClearSession, sessions, onLoadSession, onDeleteSession }: Props) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<2 | 3>(3);
  const [topic, setTopic] = useState("");
  const [extraTopics, setExtraTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  // Hazır havuzdan rastgele bir alt küme — her açılışta farklı sıralama.
  const [poolTopics] = useState<string[]>(() => shuffleArr(TOPIC_POOL).slice(0, 6));

  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // Daha önce önerilmiş isimler — "Yeniden"de tekrar gelmesinler (çeşitlilik).
  const shownNamesRef = useRef<string[]>([]);

  const drawForTopic = useCallback(
    async (t: string, cnt: number) => {
      const q = t.trim();
      if (!q) return;
      setLoading(true);
      setGuests(null);
      setAddMsg(null);
      try {
        const names = await suggestGuestNames(q, null, shownNamesRef.current, apiKey);
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
      shownNamesRef.current = []; // yeni konu: geçmişi sıfırla
      void drawForTopic(t, count);
    },
    [drawForTopic, count],
  );

  const fetchGuestsForInput = useCallback(() => {
    shownNamesRef.current = [];
    void drawForTopic(topic.trim(), count);
  }, [topic, count, drawForTopic]);

  const reshuffle = useCallback(() => {
    if (topic.trim()) void drawForTopic(topic, count);
  }, [topic, count, drawForTopic]);

  const changeCount = useCallback(
    (c: 2 | 3) => {
      setCount(c);
      if (topic.trim()) void drawForTopic(topic, c);
    },
    [topic, drawForTopic],
  );

  // Önceden gösterilmiş tüm konular (tekrar üretmemek için).
  const seenTopicsRef = useRef<string[]>([...TOPIC_POOL]);
  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const fresh = await suggestTopicIdeas(seenTopicsRef.current, apiKey);
      if (fresh.length) {
        seenTopicsRef.current = [...seenTopicsRef.current, ...fresh].slice(-60);
        setExtraTopics(fresh.slice(0, 6)); // en fazla 6 göster
      }
    } catch (e) {
      onError(e);
    } finally {
      setLoadingTopics(false);
    }
  }, [apiKey, onError]);

  const addGuest = useCallback(async () => {
    const q = addName.trim();
    if (!q) return;
    setAdding(true);
    setAddMsg(null);
    try {
      const res = await resolveGuestByName(q);
      if (res.status === "blocked") {
        setAddMsg("Bu isim konuk olarak eklenemez. Lütfen başka bir isim seçin.");
        return;
      }
      if (res.status === "notfound") {
        setAddMsg(`"${q}" Vikipedi'de bir kişi olarak bulunamadı. İsmi tam yazmayı ya da linkini yapıştırmayı deneyin.`);
        return;
      }
      const g = res.guest;
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

      {savedSession && (
        <section className="setup__block setup__block--saved">
          <div className="setup__block-head">
            <h2>💾 Kaydedilmiş Oturum</h2>
            <button className="btn btn--ghost" onClick={onClearSession}>Sil</button>
          </div>
          <p className="context-hint">
            Konu: <strong>{savedSession.topic}</strong> · {savedSession.guests.map(g => g.name).join(", ")} · {savedSession.utterances.length} replik
          </p>
          <button
            className="btn btn--primary"
            onClick={() => onStart(savedSession.guests, savedSession.topic, null)}
          >
            Kaldığın yerden devam et ▶
          </button>
        </section>
      )}

      {/* 1) KONU */}
      <section className="setup__block">
        <div className="setup__block-head">
          <h2>1 · Bugünün Konusu</h2>
          <button className="btn btn--ghost" onClick={() => loadTopics()} disabled={loadingTopics}>
            {loadingTopics ? "Konu üretiliyor…" : "Başka konular öner"}
          </button>
        </div>

        <div className="topic-chips">
          {(extraTopics.length ? extraTopics : poolTopics).map((t) => (
            <button
              key={t}
              className={`chip ${extraTopics.length ? "chip--fresh" : ""} ${topic === t ? "chip--active" : ""}`}
              onClick={() => pickTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="topic-row">
          <input
            className="topic-input"
            placeholder="…ya da kendi konunuzu yazın (futbol, aşk, uzay, tarih…)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
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
                <div className="guest-card__era">{g.era || <span className="guest-card__warn">Bilgi çekilemedi</span>}</div>
                <p className="guest-card__blurb">{g.blurb}</p>
                {g.summaryStatus === "minimal" && (
                  <div className="guest-card__badge guest-card__badge--warn">Vikipedi'ye ulaşılamadı — minimal bilgi</div>
                )}
              </div>
            ))}
        </div>

        {/* Kendi konuğunu ekle */}
        <div className="topic-row addguest-row">
          <input
            className="topic-input"
            placeholder="Kendi konuğunuzu ekleyin: bir isim yazın (ör. Sevan Nişanyan) ya da Vikipedi linki"
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
          onClick={() => onStart(guests!, topic.trim(), null)}
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

      {/* Geçmiş oturumlar */}
      {sessions && sessions.length > 0 && (
        <section className="setup__block setup__block--history">
          <div className="setup__block-head">
            <h2>📜 Geçmiş Oturumlar</h2>
          </div>
          <div className="history-list">
            {sessions.map((s) => (
              <div key={s.id} className="history-card">
                <div className="history-card__info">
                  <div className="history-card__topic">{s.topic}</div>
                  <div className="history-card__meta">
                    {s.guestNames.join(", ")} · {s.utterancesCount} replik · {formatDate(s.savedAt)}
                  </div>
                </div>
                <div className="history-card__actions">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => onLoadSession?.(s.id)}
                    title="Oturumu izle"
                  >
                    ▶ İzle
                  </button>
                  <button
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => onDeleteSession?.(s.id)}
                    title="Sil"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const COLORS = ["#e94b6b", "#3fb6c9", "#f2b134", "#8b7bd8"];
function colorAt(i: number): string {
  return COLORS[i % COLORS.length];
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
