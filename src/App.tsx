import { useCallback, useEffect, useRef, useState } from "react";
import type { Guest, Utterance } from "./types";
import type { GuestRole } from "./lib/prompts";
import { SetupScreen } from "./components/SetupScreen";
import { ChatStream } from "./components/ChatStream";
import { RatingMeter } from "./components/RatingMeter";
import { ModeratorBar } from "./components/ModeratorBar";
import { ApiKeyModal } from "./components/ApiKeyModal";
import {
  runIntro,
  runOpeningStatement,
  runRatingDirector,
  runGuest,
  suggestQuestions,
  assignStances,
  moderateTopic,
} from "./lib/engine";
import type { Stance } from "./types";
import { ApiError, getLastMeta } from "./lib/deepseek";
import { loadApiKey, saveApiKey, clearApiKey } from "./lib/store";

type Phase = "setup" | "panel";
type SessionPhase = "intro" | "opening" | "debate";
interface Progress {
  phase: SessionPhase;
  i: number;
}
interface Thread {
  a: number;
  b: number;
  turns: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

// Replik uzunluğuna göre okuma süresi — akışı sakinleştirir.
function readingDelay(text: string): number {
  return Math.min(6000, Math.max(2200, 1400 + text.length * 18));
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export function App() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [topic, setTopic] = useState("");

  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [rating, setRating] = useState(50);
  const [ratingNote, setRatingNote] = useState("");
  const [thinking, setThinking] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const [apiKey, setApiKey] = useState<string | null>(loadApiKey());
  const [demoRemaining, setDemoRemaining] = useState<number | null>(null);
  const [keyModal, setKeyModal] = useState(false);
  const [keyReason, setKeyReason] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [checking, setChecking] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  // Oturum durumu ref'lerde tutulur (kapanış tuzaklarından kaçınmak için).
  const utterRef = useRef<Utterance[]>([]);
  const guestsRef = useRef<Guest[]>([]);
  const topicRef = useRef("");
  const runningRef = useRef(false);
  const loopActiveRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const apiKeyRef = useRef<string | null>(apiKey);

  const progressRef = useRef<Progress>({ phase: "intro", i: 0 });
  const activeRef = useRef<number[]>([]); // net fikri olan konuklar
  const threadRef = useRef<Thread | null>(null);
  const modNoteRef = useRef<string | undefined>(undefined);
  const stancesRef = useRef<(Stance | null)[]>([]); // yapımcının atadığı pozisyonlar
  const topicContextRef = useRef<string | null>(null); // güncel olay grounding metni

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  const commit = useCallback((next: Utterance[]) => {
    utterRef.current = next;
    setUtterances(next);
  }, []);
  const append = useCallback(
    (u: Utterance) => commit([...utterRef.current, u]),
    [commit],
  );
  const syncMeta = useCallback(() => setDemoRemaining(getLastMeta().remaining), []);

  const handleError = useCallback((e: unknown) => {
    if (isAbort(e)) return;
    if (e instanceof ApiError && (e.code === "RATE_LIMITED" || e.code === "NO_DEMO_KEY")) {
      setKeyReason(e.message);
      setKeyModal(true);
    } else if (e instanceof ApiError) {
      setError(e.message);
    } else {
      setError("Beklenmedik bir hata oluştu. Tekrar deneyin.");
    }
  }, []);

  const pause = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    abortRef.current?.abort();
    setThinking(null);
  }, []);

  const lastGuestSpeaker = useCallback((): number | null => {
    for (let i = utterRef.current.length - 1; i >= 0; i--) {
      const s = utterRef.current[i].speaker;
      if (typeof s === "number") return s;
    }
    return null;
  }, []);

  const leastRecentActive = useCallback((): number => {
    const active = activeRef.current;
    const lastSeen = new Map<number, number>();
    utterRef.current.forEach((u, idx) => {
      if (typeof u.speaker === "number") lastSeen.set(u.speaker, idx);
    });
    return [...active].sort((x, y) => (lastSeen.get(x) ?? -1) - (lastSeen.get(y) ?? -1))[0];
  }, []);

  // Pozisyon kutbu: Lehte=+1, Aleyhte=-1, Kısmen/yok=0.
  const polarity = useCallback((i: number): number => {
    const p = stancesRef.current[i]?.position?.toLocaleLowerCase("tr") ?? "";
    if (p.includes("lehte")) return 1;
    if (p.includes("aleyhte")) return -1;
    return 0;
  }, []);

  // Bir konuğa en zıt görüşteki aktif konuk (didişme için doğru rakip).
  const opponentOf = useCallback(
    (i: number, pool: number[]): number => {
      let best = pool.find((j) => j !== i) ?? i;
      let bestDiff = -1;
      for (const j of pool) {
        if (j === i) continue;
        const d = Math.abs(polarity(i) - polarity(j));
        if (d > bestDiff) {
          bestDiff = d;
          best = j;
        }
      }
      return best;
    },
    [polarity],
  );

  // En zıt görüşteki iki aktif konuk — tartışmanın ana eksenini kurar.
  const mostOpposedPair = useCallback(
    (pool: number[]): Thread => {
      let a = pool[0];
      let b = pool[1] ?? pool[0];
      let diff = -1;
      for (let x = 0; x < pool.length; x++) {
        for (let y = x + 1; y < pool.length; y++) {
          const d = Math.abs(polarity(pool[x]) - polarity(pool[y]));
          if (d > diff) {
            diff = d;
            a = pool[x];
            b = pool[y];
          }
        }
      }
      return { a, b, turns: 0 };
    },
    [polarity],
  );

  // Kod-tabanlı ritim: ikili atışma sürer, tıkanınca üçüncü girip yönlendirir.
  const nextSpeaker = useCallback((): { speaker: number; role: GuestRole } => {
    const active = activeRef.current;
    const th = threadRef.current!;

    // Spiker yön verdiyse: adı geçen konuk (herhangi bir isim parçası eşleşirse),
    // yoksa en uzun susan aktif konuk.
    if (modNoteRef.current) {
      const note = modNoteRef.current.toLocaleLowerCase("tr");
      const named = active.find((i) =>
        guestsRef.current[i].name
          .toLocaleLowerCase("tr")
          .split(/\s+/)
          .some((tok) => tok.length > 3 && note.includes(tok)),
      );
      return { speaker: named ?? leastRecentActive(), role: "answerHost" };
    }

    const third = active.find((i) => i !== th.a && i !== th.b);
    if (third !== undefined && th.turns >= 3) {
      return { speaker: third, role: "redirect" };
    }

    const last = lastGuestSpeaker();
    const speaker = last === th.a ? th.b : th.a;
    return { speaker, role: "continue" };
  }, [lastGuestSpeaker, leastRecentActive]);

  const advanceThread = useCallback((speaker: number, role: GuestRole) => {
    const th = threadRef.current!;
    if (role === "redirect") {
      // Üçüncü söz aldı: onu en zıt görüşteki aktif konukla eşleştir.
      threadRef.current = { a: speaker, b: opponentOf(speaker, activeRef.current), turns: 0 };
    } else if (role === "answerHost") {
      const other = activeRef.current.find((i) => i !== speaker) ?? speaker;
      threadRef.current = { a: speaker, b: other, turns: 0 };
    } else {
      th.turns += 1;
    }
  }, [opponentOf]);

  // Üç fazlı, duraklatılıp devam edebilen oturum sürücüsü.
  const runSession = useCallback(async () => {
    const g = guestsRef.current;
    const t = topicRef.current;

    try {
      // --- KADROLAMA (karşıt pozisyonlar) ---
      if (stancesRef.current.length === 0) {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        stancesRef.current = await assignStances(
          g,
          t,
          topicContextRef.current,
          apiKeyRef.current,
          ctrl.signal,
        );
        syncMeta();
      }

      // --- TANIŞMA TURU ---
      while (runningRef.current && progressRef.current.phase === "intro") {
        const i = progressRef.current.i;
        if (i >= g.length) {
          append({
            id: uid(),
            speaker: "moderator",
            text: `Teşekkür ederim. Şimdi asıl meselemize gelelim: ${t} Bu konudaki görüşlerinizi sırayla alalım, buyurun.`,
            mode: "normal",
          });
          progressRef.current = { phase: "opening", i: 0 };
          const ctrl = new AbortController();
          abortRef.current = ctrl;
          await delay(1600, ctrl.signal);
          continue;
        }
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(i);
        const text = await runIntro(g[i], g, t, apiKeyRef.current, ctrl.signal);
        setThinking(null);
        syncMeta();
        if (!runningRef.current) return;
        append({ id: uid(), speaker: i, text, mode: "normal" });
        progressRef.current = { phase: "intro", i: i + 1 };
        await delay(readingDelay(text), ctrl.signal);
      }

      // --- GÖRÜŞ TURU ---
      while (runningRef.current && progressRef.current.phase === "opening") {
        const i = progressRef.current.i;
        if (i >= g.length) {
          if (activeRef.current.length === 0) {
            append({
              id: uid(),
              speaker: "moderator",
              text: "Konuklar bu konuda net bir fikir beyan etmedi; oturum burada duruyor.",
              mode: "system",
            });
            pause();
            return;
          }
          const act = activeRef.current;
          threadRef.current =
            act.length >= 2 ? mostOpposedPair(act) : { a: act[0], b: act[0], turns: 0 };
          progressRef.current = { phase: "debate", i: 0 };
          continue;
        }
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(i);
        const { text, hasStance } = await runOpeningStatement(
          g[i],
          g,
          t,
          stancesRef.current[i] ?? null,
          topicContextRef.current,
          apiKeyRef.current,
          ctrl.signal,
        );
        setThinking(null);
        syncMeta();
        if (!runningRef.current) return;
        append({ id: uid(), speaker: i, text, mode: "normal" });
        if (hasStance && !activeRef.current.includes(i)) activeRef.current.push(i);
        progressRef.current = { phase: "opening", i: i + 1 };
        await delay(readingDelay(text), ctrl.signal);
      }

      // --- SERBEST TARTIŞMA ---
      while (runningRef.current && progressRef.current.phase === "debate") {
        const { speaker, role } = nextSpeaker();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(speaker);

        const dec = await runRatingDirector(
          g,
          t,
          utterRef.current,
          g[speaker].name,
          role,
          modNoteRef.current,
          apiKeyRef.current,
          ctrl.signal,
        );
        syncMeta();
        setRating(dec.rating);
        setRatingNote(dec.note);
        if (!runningRef.current) return;

        const text = await runGuest(
          g[speaker],
          g,
          t,
          utterRef.current,
          dec.cue,
          role,
          stancesRef.current[speaker] ?? null,
          topicContextRef.current,
          apiKeyRef.current,
          ctrl.signal,
        );
        setThinking(null);
        syncMeta();
        if (!runningRef.current) return;

        modNoteRef.current = undefined; // tüket ki döngü kilitlenmesin
        if (text.trim()) {
          append({
            id: uid(),
            speaker,
            text,
            mode: role === "redirect" ? "redirect" : "normal",
          });
        }
        advanceThread(speaker, role);
        await delay(text.trim() ? readingDelay(text) : 500, ctrl.signal);
      }
    } catch (e) {
      setThinking(null);
      if (isAbort(e)) return; // duraklatma/müdahale: durum korunur, sonra devam
      handleError(e);
      pause();
    }
  }, [append, syncMeta, nextSpeaker, advanceThread, mostOpposedPair, handleError, pause]);

  // Oturumu sürdür (boot / devam / müdahale sonrası tek giriş noktası).
  const drive = useCallback(() => {
    runningRef.current = true;
    setRunning(true);
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;
    void runSession().finally(() => {
      loopActiveRef.current = false;
    });
  }, [runSession]);

  const pauseToggle = useCallback(() => {
    if (runningRef.current) pause();
    else drive();
  }, [pause, drive]);

  // Spiker müdahalesi: sürmekte olan repliği kes, mesajı ekle, akış şekillensin.
  const moderate = useCallback(
    (text: string) => {
      setError(null);
      abortRef.current?.abort();
      setThinking(null);
      append({ id: uid(), speaker: "moderator", text, mode: "normal" });
      modNoteRef.current = text;
      setSuggestions([]);
      // Görüş turu bitmemişse spiker sözü akışı bozmasın; tartışmadaysa yönlendirsin.
      drive();
    },
    [append, drive],
  );

  const startSession = useCallback((g: Guest[], t: string, context?: string | null) => {
    setGuests(g);
    setTopic(t);
    setPhase("panel");
    guestsRef.current = g;
    topicRef.current = t;
    topicContextRef.current = context ?? null;

    const welcome: Utterance = {
      id: uid(),
      speaker: "moderator",
      text: "Merhaba, oturumumuza hoş geldiniz. Öncelikle sizleri tanıyalım — buyurun, sırayla kısaca kendinizi tanıtın.",
      mode: "normal",
    };
    utterRef.current = [welcome];
    setUtterances([welcome]);

    progressRef.current = { phase: "intro", i: 0 };
    activeRef.current = [];
    threadRef.current = null;
    modNoteRef.current = undefined;
    stancesRef.current = [];
    setRating(50);
    setRatingNote("");
    setSuggestions([]);
    setError(null);

    runningRef.current = true;
    setRunning(true);
    loopActiveRef.current = false;
  }, []);

  // Oturum başlamadan önce içerik güvenliği kapısı: hassas konularda durdur.
  const beginSession = useCallback(
    async (g: Guest[], t: string, context?: string | null) => {
      setBlockedMsg(null);
      setChecking(true);
      try {
        const verdict = await moderateTopic(t, apiKeyRef.current);
        syncMeta();
        if (!verdict.allowed) {
          setBlockedMsg(
            "Bu konuyla ilgili açık oturum düzenlenemiyor 🌱 Lütfen farklı bir konu seçin.",
          );
          return;
        }
        startSession(g, t, context);
      } catch (e) {
        handleError(e);
      } finally {
        setChecking(false);
      }
    },
    [startSession, syncMeta, handleError],
  );

  // Panel'e geçince oturumu başlat (guests/topic state'i güncellendikten sonra).
  useEffect(() => {
    if (phase === "panel" && runningRef.current && !loopActiveRef.current) {
      loopActiveRef.current = true;
      void runSession().finally(() => {
        loopActiveRef.current = false;
      });
    }
  }, [phase, runSession]);

  const doSuggest = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const qs = await suggestQuestions(topicRef.current, guestsRef.current, apiKeyRef.current);
      syncMeta();
      setSuggestions(qs);
    } catch (e) {
      handleError(e);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [syncMeta, handleError]);

  const leave = useCallback(() => {
    pause();
    setPhase("setup");
    setUtterances([]);
    utterRef.current = [];
    setSuggestions([]);
    setError(null);
  }, [pause]);

  const saveKey = useCallback((k: string) => {
    saveApiKey(k);
    setApiKey(k);
    setKeyModal(false);
    setKeyReason(undefined);
  }, []);
  const removeKey = useCallback(() => {
    clearApiKey();
    setApiKey(null);
    setKeyModal(false);
  }, []);

  if (phase === "setup") {
    return (
      <>
        <SetupScreen
          onStart={beginSession}
          onOpenKey={() => setKeyModal(true)}
          onError={handleError}
          apiKey={apiKey}
          demoRemaining={demoRemaining}
          hasKey={!!apiKey}
          checking={checking}
        />
        <ApiKeyModal
          open={keyModal}
          reason={keyReason}
          currentKey={apiKey}
          onSave={saveKey}
          onClear={removeKey}
          onClose={() => setKeyModal(false)}
        />
        {blockedMsg && (
          <div className="modal__backdrop" onClick={() => setBlockedMsg(null)}>
            <div className="modal modal--block" onClick={(e) => e.stopPropagation()}>
              <div className="modal--block__icon">🕊️</div>
              <h2>Bu konu uygun değil</h2>
              <p>{blockedMsg}</p>
              <div className="modal__actions">
                <button className="btn btn--primary" onClick={() => setBlockedMsg(null)}>
                  Tamam, başka konu seçeyim
                </button>
              </div>
            </div>
          </div>
        )}
        <footer className="credits">
          <p className="credits__disclaimer">
            <strong>Sorumluluk reddi:</strong> Bu deneysel bir eğlence ve mizah projesidir.
            Oturumdaki konuşmalar yapay zeka tarafından üretilir; kurgusaldır ve adı geçen gerçek
            ya da tarihî kişilerin gerçek görüşlerini, sözlerini veya kişiliğini yansıtmaz.
            İçerik hatalı, eksik ya da yanıltıcı olabilir; kaynak veya danışmanlık niteliği taşımaz.
          </p>
          <p className="credits__by">
            Alper Alyaz'ın kişisel projesidir · DeepSeek / Groq ile çalışır · Vikipedi ve Google
            Trends verileriyle beslenir
          </p>
        </footer>
      </>
    );
  }

  return (
    <div className="panel">
      <header className="panel__head">
        <button className="btn btn--ghost btn--icon" onClick={leave} title="Ana ekran">
          ‹
        </button>
        <div className="panel__topic">
          <span className="panel__live">● CANLI</span>
          <h1>{topic}</h1>
        </div>
        <div className="panel__guests">
          {guests.map((g, i) => (
            <div
              key={i}
              className={`panel__chip ${thinking === i ? "panel__chip--active" : ""}`}
              style={{ borderColor: g.color }}
              title={g.era}
            >
              <span style={{ background: g.color }} />
              {g.name}
            </div>
          ))}
        </div>
      </header>

      <div className="panel__body">
        <main className="panel__stage">
          {error && <div className="banner banner--error">{error}</div>}
          <ChatStream utterances={utterances} guests={guests} thinking={thinking} />
        </main>
        <aside className="panel__side">
          <RatingMeter rating={rating} note={ratingNote} />
        </aside>
      </div>

      <ModeratorBar
        running={running}
        busy={thinking !== null}
        suggestions={suggestions}
        loadingSuggestions={loadingSuggestions}
        onSend={moderate}
        onPauseToggle={pauseToggle}
        onSuggest={doSuggest}
      />

      <ApiKeyModal
        open={keyModal}
        reason={keyReason}
        currentKey={apiKey}
        onSave={saveKey}
        onClear={removeKey}
        onClose={() => setKeyModal(false)}
      />
    </div>
  );
}
