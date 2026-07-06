import { useCallback, useEffect, useRef, useState } from "react";
import type { Guest, Utterance } from "./types";
import { SetupScreen } from "./components/SetupScreen";
import { ChatStream } from "./components/ChatStream";
import { RatingMeter } from "./components/RatingMeter";
import { ModeratorBar } from "./components/ModeratorBar";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { runDirector, runGuest, suggestQuestions } from "./lib/engine";
import { ApiError, getLastMeta } from "./lib/deepseek";
import { loadApiKey, saveApiKey, clearApiKey } from "./lib/store";

type Phase = "setup" | "panel";

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

  // Döngü, kapanışlardan kaçınmak için ref'ler üzerinden yürür.
  const utterRef = useRef<Utterance[]>([]);
  const runningRef = useRef(false);
  const loopActiveRef = useRef(false);
  const modNoteRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const apiKeyRef = useRef<string | null>(apiKey);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  const commit = useCallback((next: Utterance[]) => {
    utterRef.current = next;
    setUtterances(next);
  }, []);

  const syncMeta = useCallback(() => {
    const m = getLastMeta();
    setDemoRemaining(m.remaining);
  }, []);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (e instanceof ApiError) {
      if (e.code === "RATE_LIMITED" || e.code === "NO_DEMO_KEY") {
        setKeyReason(e.message);
        setKeyModal(true);
      } else {
        setError(e.message);
      }
    } else {
      setError("Beklenmedik bir hata oluştu. Tekrar deneyin.");
    }
  }, []);

  // Ana tur döngüsü: yönetmen → reyting → konuk repliği → tekrar.
  const turnLoop = useCallback(async () => {
    while (runningRef.current) {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const decision = await runDirector(
          guests,
          topic,
          utterRef.current,
          modNoteRef.current,
          apiKeyRef.current,
          controller.signal,
        );
        modNoteRef.current = undefined;
        syncMeta();
        setRating(decision.rating);
        setRatingNote(decision.note);

        if (!runningRef.current) break;

        const gi = decision.next;
        setThinking(gi);
        const text = await runGuest(
          guests[gi],
          guests,
          topic,
          utterRef.current,
          decision.cue,
          decision.mode,
          apiKeyRef.current,
          controller.signal,
        );
        setThinking(null);
        syncMeta();

        if (!runningRef.current) break;
        commit([...utterRef.current, { id: uid(), speaker: gi, text, mode: decision.mode }]);

        await delay(1300, controller.signal);
      } catch (e) {
        setThinking(null);
        if (e instanceof DOMException && e.name === "AbortError") {
          // Duraklatma ya da müdahale: sessizce çık.
          if (!runningRef.current) break;
          continue;
        }
        handleError(e);
        runningRef.current = false;
        setRunning(false);
        break;
      }
    }
    loopActiveRef.current = false;
  }, [guests, topic, commit, syncMeta, handleError]);

  const ensureLoop = useCallback(() => {
    runningRef.current = true;
    setRunning(true);
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;
    void turnLoop();
  }, [turnLoop]);

  const pause = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    abortRef.current?.abort();
    setThinking(null);
  }, []);

  const pauseToggle = useCallback(() => {
    if (runningRef.current) pause();
    else ensureLoop();
  }, [pause, ensureLoop]);

  // Spiker müdahalesi: sözü kes, mesajı ekle, konuklar buna göre şekillensin.
  const moderate = useCallback(
    (text: string) => {
      setError(null);
      abortRef.current?.abort(); // sürmekte olan repliği düşür
      setThinking(null);
      commit([...utterRef.current, { id: uid(), speaker: "moderator", text, mode: "normal" }]);
      modNoteRef.current = text;
      setSuggestions([]);
      ensureLoop();
    },
    [commit, ensureLoop],
  );

  const startSession = useCallback(
    (g: Guest[], t: string) => {
      setGuests(g);
      setTopic(t);
      setPhase("panel");
      const opening: Utterance = {
        id: uid(),
        speaker: "moderator",
        text: `Sayın konuklar, hoş geldiniz. Bugünkü konumuz: ${t}. Buyurun.`,
        mode: "normal",
      };
      utterRef.current = [opening];
      setUtterances([opening]);
      modNoteRef.current = t;
      setRating(50);
      setRatingNote("");
      // guests/topic state güncellemesinin ardından döngüyü başlat.
      runningRef.current = true;
      setRunning(true);
      loopActiveRef.current = false;
    },
    [],
  );

  // guests/topic güncellendikten sonra panel açıldıysa döngüyü tetikle.
  useEffect(() => {
    if (phase === "panel" && runningRef.current && !loopActiveRef.current) {
      loopActiveRef.current = true;
      void turnLoop();
    }
  }, [phase, turnLoop]);

  const doSuggest = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const qs = await suggestQuestions(topic, guests, apiKeyRef.current);
      syncMeta();
      setSuggestions(qs);
    } catch (e) {
      handleError(e);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [topic, guests, syncMeta, handleError]);

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
          onStart={startSession}
          onOpenKey={() => setKeyModal(true)}
          demoRemaining={demoRemaining}
          hasKey={!!apiKey}
        />
        <ApiKeyModal
          open={keyModal}
          reason={keyReason}
          currentKey={apiKey}
          onSave={saveKey}
          onClear={removeKey}
          onClose={() => setKeyModal(false)}
        />
        <footer className="credits">DeepSeek ile çalışır · Vikipedi verileriyle beslenir</footer>
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
