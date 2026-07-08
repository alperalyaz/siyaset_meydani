import { useCallback, useEffect, useRef, useState } from "react";
import type { Guest, Utterance, SessionPhase, Difficulty, SessionResult, SessionEvent, Badge } from "./types";
import type { GuestRole } from "./lib/prompts";
import { SetupScreen } from "./components/SetupScreen";
import { ChatStream } from "./components/ChatStream";
import { RatingMeter } from "./components/RatingMeter";
import { ModeratorBar } from "./components/ModeratorBar";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { SessionResultScreen } from "./components/SessionResultScreen";
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
import { loadApiKey, saveApiKey, clearApiKey, loadSession, clearSession, saveSessionAndIndex, loadSessionById, deleteSessionById, listSessionMetas, loadTtsRate, saveTtsRate, type SavedSession, type SessionMeta } from "./lib/store";
import { speak, cancelSpeech, voiceForGuest, ttsSupported, setActiveRate } from "./lib/tts";
import {
  DIFFICULTY_CONFIGS,
  RatingTracker,
  computeSessionResult,
  evaluateBadges,
  comboEvent,
  phaseChangeEvent,
  phaseLabel,
} from "./lib/gamification";

type Phase = "setup" | "panel" | "replay" | "result";
type ProgressPhase = "intro" | "opening" | "debate";
interface Progress {
  phase: ProgressPhase;
  i: number;
}
interface Thread {
  a: number;
  b: number;
  turns: number;
}

interface ReplayData {
  guests: Guest[];
  topic: string;
  utterances: Utterance[];
  rating: number;
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

// Replik uzunluğuna göre okuma süresi — akışı sakinleştirir (ses kapalıyken).
function readingDelay(text: string): number {
  return Math.min(11000, Math.max(3200, 1800 + text.length * 26));
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
  const [streamingText, setStreamingText] = useState<string>("");
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
  const [savedSession, setSavedSession] = useState<SavedSession | null>(loadSession);
  const [sessionMetas, setSessionMetas] = useState<SessionMeta[]>(listSessionMetas);

  const [replayData, setReplayData] = useState<ReplayData | null>(null);

  const [savedToast, setSavedToast] = useState(false);
  const savedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (savedToastTimer.current) clearTimeout(savedToastTimer.current);
    };
  }, []);

  // ── Gamification state ──
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("warmup");
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [comboToast, setComboToast] = useState<SessionEvent | null>(null);

  const [leaveModal, setLeaveModal] = useState(false);
  const [closingSequence, setClosingSequence] = useState(false);

  const [ttsOn, setTtsOn] = useState(ttsSupported());
  const ttsRef = useRef(ttsOn);
  useEffect(() => {
    ttsRef.current = ttsOn;
    if (!ttsOn) cancelSpeech();
  }, [ttsOn]);

  const [ttsRate, setTtsRate] = useState<number>(loadTtsRate);
  const ttsRateRef = useRef(ttsRate);
  useEffect(() => {
    ttsRateRef.current = ttsRate;
    saveTtsRate(ttsRate);
    setActiveRate(ttsRate);
  }, [ttsRate]);

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
  const startTimeRef = useRef<number>(0); // oturum başlangıcı
  const ratingTracker = useRef(new RatingTracker());
  const eventQueueRef = useRef<SessionEvent[]>([]);
  const earnedBadgesRef = useRef<Badge[]>([]);
  const sessionPhaseRef = useRef<SessionPhase>("warmup");
  const difficultyRef = useRef<Difficulty>("kolay");
  const pausedRef = useRef(false); // manuel duraklatma vs oturum bitişi ayrımı

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
    } else if (e instanceof ApiError && e.status === 429) {
      // Groq / upstream rate-limit — retry olarak handle edilecek, pause etme
      setError("⏳ Groq limiti doldu, birkaç saniye sonra tekrar deneniyor...");
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
    cancelSpeech();
    setThinking(null);
    setStreamingText("");
    pausedRef.current = true;
  }, []);

  // Tempo: ses açıksa replik seslendirilir ve bitene kadar beklenir; kapalıysa
  // okuma süresi kadar beklenir. Böylece akış okunabilir/dinlenebilir hızda.
  const pace = useCallback(
    async (
      text: string,
      voiceIdx: number,
      gender: "male" | "female" | undefined,
      signal: AbortSignal,
    ) => {
      if (ttsRef.current && text.trim()) {
        const vopts = voiceForGuest(voiceIdx, gender);
        await speak(text, { ...vopts, rate: vopts.rate * ttsRateRef.current, signal });
      } else {
        await delay(readingDelay(text), signal);
      }
    },
    [],
  );

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
  // Aynı konuğun üst üste konuşması engellenir; tekrar eden konuşmacı tespit edilir.
  const nextSpeaker = useCallback((): { speaker: number; role: GuestRole } => {
    const active = activeRef.current;
    const th = threadRef.current!;
    const last = lastGuestSpeaker();

    // Tıkanma tespiti: son 5 konuk repliğinin hepsi aynı kişi mi?
    const recentGuests = utterRef.current
      .filter((u) => typeof u.speaker === "number")
      .slice(-5);
    if (recentGuests.length >= 3 && recentGuests.every((u) => u.speaker === recentGuests[0].speaker)) {
      const stalledAt = recentGuests[0].speaker as number;
      const alt = active.find((i) => i !== stalledAt) ?? stalledAt;
      return { speaker: alt, role: "redirect" };
    }

    // Spiker yön verdiyse: adı geçen konuk (herhangi bir isim parçası eşleşirse),
    // yoksa en uzun susan aktif konuk. Ama az önce konuşanı atla.
    if (modNoteRef.current) {
      const note = modNoteRef.current.toLocaleLowerCase("tr");
      const named = active.find((i) =>
        guestsRef.current[i].name
          .toLocaleLowerCase("tr")
          .split(/\s+/)
          .some((tok) => tok.length > 3 && note.includes(tok)),
      );
      let speaker = named ?? leastRecentActive();
      if (speaker === last && active.length > 1) {
        speaker = active.find((i) => i !== last) ?? speaker;
      }
      return { speaker, role: "answerHost" };
    }

    const third = active.find((i) => i !== th.a && i !== th.b);
    if (third !== undefined && th.turns >= 3) {
      // Üçüncü konuk: az önce konuşan değilse direkt, değilse en uzun susan diğer
      const candidate = third === last && active.length > 2
        ? active.filter((i) => i !== th.a && i !== th.b && i !== last)[0] ?? third
        : third;
      return { speaker: candidate, role: "redirect" };
    }

    let speaker = last === th.a ? th.b : th.a;
    // Aynı konuğun üst üste konuşmasını engelle
    if (speaker === last && active.length > 1) {
      speaker = active.find((i) => i !== last) ?? speaker;
    }
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

  // ── Combo / event işleyici ──
  const flushEvent = useCallback(() => {
    const q = eventQueueRef.current;
    if (q.length === 0) return;
    const ev = q.shift()!;
    setComboToast(ev);
    setTimeout(() => setComboToast(null), 3500);
  }, []);

  // Üç fazlı, duraklatılıp devam edebilen oturum sürücüsü.
  const runSession = useCallback(async () => {
    const g = guestsRef.current;
    const t = topicRef.current;

    try {
      // --- KADROLAMA (karşıt pozisyonlar) ---
      if (stancesRef.current.length === 0) {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const cast = await assignStances(
          g,
          t,
          topicContextRef.current,
          apiKeyRef.current,
          ctrl.signal,
        );
        stancesRef.current = cast.stances;
        // Cinsiyeti LLM'den doldur (Wikidata boş/rate-limitliyse seslendirme için).
        cast.genders.forEach((gd, idx) => {
          if (gd && g[idx] && !g[idx].gender) g[idx].gender = gd;
        });
        syncMeta();
      }

      // Spiker welcome mesajını seslendir (sadece ilk başlangıçta)
      if (utterRef.current.length <= 1) {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const w = utterRef.current[0];
        if (w) await pace(w.text, 9, undefined, ctrl.signal);
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
          await pace(utterRef.current[utterRef.current.length - 1]?.text ?? "", 9, undefined, ctrl.signal);
          continue;
        }
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(i);
        setStreamingText("");
        const text = await runIntro(g[i], g, t, apiKeyRef.current, ctrl.signal, (token) => setStreamingText((p) => p + token));
        setThinking(null);
        setStreamingText("");
        syncMeta();
        if (!runningRef.current) return;
        append({ id: uid(), speaker: i, text, mode: "normal" });
        progressRef.current = { phase: "intro", i: i + 1 };
        await pace(text, i, g[i].gender, ctrl.signal);
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
            {
              const ctrl = new AbortController();
              abortRef.current = ctrl;
              await pace(utterRef.current[utterRef.current.length - 1]?.text ?? "", 9, undefined, ctrl.signal);
            }
            pause();
            return;
          }
          const act = activeRef.current;
          threadRef.current =
            act.length >= 2 ? mostOpposedPair(act) : { a: act[0], b: act[0], turns: 0 };
          progressRef.current = { phase: "debate", i: 0 };
          // Gamification: warming up is done, enter debate phase
          sessionPhaseRef.current = "debate";
          setSessionPhase("debate");
          eventQueueRef.current.push(phaseChangeEvent("debate", Date.now()));
          flushEvent();
          continue;
        }
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(i);
        setStreamingText("");
        const { text, hasStance } = await runOpeningStatement(
          g[i],
          g,
          t,
          stancesRef.current[i] ?? null,
          topicContextRef.current,
          apiKeyRef.current,
          ctrl.signal,
          (token) => setStreamingText((p) => p + token),
        );
        setThinking(null);
        setStreamingText("");
        syncMeta();
        if (!runningRef.current) return;
        append({ id: uid(), speaker: i, text, mode: "normal" });
        if (hasStance && !activeRef.current.includes(i)) activeRef.current.push(i);
        progressRef.current = { phase: "opening", i: i + 1 };
        await pace(text, i, g[i].gender, ctrl.signal);
      }

      // --- SERBEST TARTIŞMA ---
      while (runningRef.current && progressRef.current.phase === "debate") {
        try {
        const { speaker, role } = nextSpeaker();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(speaker);
        setStreamingText("");

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

        // ── Gamification: rating tracking & combo ──
        const now = Date.now();
        ratingTracker.current.push(dec.rating, now);
        const combos = ratingTracker.current.checkCombos(now);
        if (combos.hot) eventQueueRef.current.push(comboEvent("crowd_hot", now));
        if (combos.cold) eventQueueRef.current.push(comboEvent("crowd_cold", now));
        flushEvent();

        // ── Win condition ──
        const cfg = DIFFICULTY_CONFIGS[difficultyRef.current];
        const isFinal = sessionPhaseRef.current === "final";
        const goal = isFinal ? cfg.finalGoal : cfg.goalRating;

        if (ratingTracker.current.aboveFor(goal, cfg.holdSeconds, now)) {
          // FİNAL BÖLÜMÜNE GEÇİŞ
          if (!isFinal) {
            sessionPhaseRef.current = "final";
            setSessionPhase("final");
            eventQueueRef.current.push(phaseChangeEvent("final", now));
            flushEvent();
            // Hedefe ulaşıldı— konuklara sürpriz final repliği fırsatı ver
            append({
              id: uid(),
              speaker: "moderator",
              text: `🎉 Tebrikler! Reytingler ${goal} üzerinde ${cfg.holdSeconds} saniyedir seyrediyor! Şimdi FİNAL bölümüne girdik — reytingi ${cfg.finalGoal} üzerine çıkarın, oturum şampiyon bitsin!`,
              mode: "system",
            });
            await pace(utterRef.current[utterRef.current.length - 1]?.text ?? "", 9, undefined, ctrl.signal);
            continue;
          }

          // FİNALDE BAŞARI → OTURUM BİTER
          sessionPhaseRef.current = "ended";
          setSessionPhase("ended");
          append({
            id: uid(),
            speaker: "moderator",
            text: `Harika bir oturum oldu! Reytinglerimiz final hedefi olan ${cfg.finalGoal}'i aştı ve seyircimiz coştu. Değerli konuklarımıza ve siz sevgili spikerimize teşekkür ediyorum. Yayınımız burada sona eriyor — bir sonraki oturumda görüşmek üzere! 👋🎬`,
            mode: "system",
          });
          await pace(utterRef.current[utterRef.current.length - 1]?.text ?? "", 9, undefined, ctrl.signal);
          runningRef.current = false;
          setRunning(false);
          setThinking(null);
          // Compute result
          const result = computeSessionResult(
            utterRef.current,
            g,
            ratingTracker.current.allSnapshots(),
            startTimeRef.current,
            difficultyRef.current,
            earnedBadgesRef.current,
            true,
          );
          const newBadges = evaluateBadges(result, utterRef.current, g, ratingTracker.current.allSnapshots());
          result.badges = newBadges;
          setSessionResult(result);
          setPhase("result");
          return;
        }

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
          (token) => setStreamingText((p) => p + token),
        );
        setThinking(null);
        setStreamingText("");
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
        if (text.trim()) await pace(text, speaker, g[speaker].gender, ctrl.signal);
        else await delay(500, ctrl.signal);

        } catch (e) {
          if (e instanceof ApiError && e.status === 429 && runningRef.current) {
            setError(`⏳ Groq limiti doldu, ${6 * (1)} saniye sonra tekrar deneniyor...`);
            syncMeta();
            await delay(6000, new AbortController().signal);
            setError(null);
            continue;
          }
          throw e;
        }
      }

      // ── Oturum durdurulduysa sonuçları hesapla (ama manuel pause değilse) ──
      if (!pausedRef.current && sessionPhaseRef.current !== "ended" && utterRef.current.length > 1) {
        sessionPhaseRef.current = "ended";
        setSessionPhase("ended");
        const result = computeSessionResult(
          utterRef.current,
          g,
          ratingTracker.current.allSnapshots(),
          startTimeRef.current,
          difficultyRef.current,
          earnedBadgesRef.current,
          false,
        );
        const newBadges = evaluateBadges(result, utterRef.current, g, ratingTracker.current.allSnapshots());
        result.badges = newBadges;
        setSessionResult(result);
        setPhase("result");
      }
    } catch (e) {
      setThinking(null);
      if (isAbort(e)) return; // duraklatma/müdahale: durum korunur, sonra devam
      handleError(e);
      pause();
    }
  }, [append, syncMeta, nextSpeaker, advanceThread, mostOpposedPair, handleError, pause, pace, flushEvent]);

  // Oturumu sürdür (boot / devam / müdahale sonrası tek giriş noktası).
  const drive = useCallback(() => {
    pausedRef.current = false;
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
      // Spiker sözünü seslendir (fire-and-forget: drive hemen çalışsın)
      if (text.trim()) {
        const ctrl = new AbortController();
        speak(text, { ...voiceForGuest(9, undefined), signal: ctrl.signal });
      }
      // Görüş turu bitmemişse spiker sözü akışı bozmasın; tartışmadaysa yönlendirsin.
      drive();
    },
    [append, drive],
  );

  const startSession = useCallback((g: Guest[], t: string, diff: Difficulty, context?: string | null) => {
    setGuests(g);
    setTopic(t);
    setPhase("panel");
    guestsRef.current = g;
    topicRef.current = t;
    topicContextRef.current = context ?? null;
    difficultyRef.current = diff;

    ratingTracker.current = new RatingTracker();
    eventQueueRef.current = [];
    earnedBadgesRef.current = [];
    startTimeRef.current = Date.now();
    sessionPhaseRef.current = "warmup";
    setSessionPhase("warmup");
    setSessionResult(null);
    setComboToast(null);

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
    async (g: Guest[], t: string, diff: Difficulty, context?: string | null) => {
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
        startSession(g, t, diff, context);
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
      const qs = await suggestQuestions(topicRef.current, guestsRef.current, utterRef.current, apiKeyRef.current);
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
    cancelSpeech();
    setPhase("setup");
    setUtterances([]);
    utterRef.current = [];
    setSuggestions([]);
    setError(null);
    setReplayData(null);
    setSessionResult(null);
    setComboToast(null);
    setLeaveModal(false);
  }, [pause]);

  const endSession = useCallback(() => {
    setLeaveModal(false);
    if (closingSequence) return;
    setClosingSequence(true);

    // Oturum boşsa direkt ayrıl
    if (utterRef.current.length <= 1) {
      leave();
      setClosingSequence(false);
      return;
    }

    pause();

    append({
      id: uid(),
      speaker: "moderator",
      text: "Sayın konuklar, programımızın sonuna geldik. Hepinize katılımınız ve değerli katkılarınız için çok teşekkür ederiz. Bir sonraki programda görüşmek üzere, hoşçakalın.",
      mode: "system",
    });

    // Kapanış mesajını seslendir
    if (utterRef.current.length > 0) {
      const last = utterRef.current[utterRef.current.length - 1];
      const ctrl = new AbortController();
      // fire-and-forget: sonuç ekranı görünmeden seslendir
      speak(last.text, { ...voiceForGuest(9, undefined), signal: ctrl.signal });
    }

    // Sezon sonucu hesapla
    const g = guestsRef.current;
    const result = computeSessionResult(
      utterRef.current,
      g,
      ratingTracker.current.allSnapshots(),
      startTimeRef.current,
      difficultyRef.current,
      earnedBadgesRef.current,
      false,
    );
    const newBadges = evaluateBadges(result, utterRef.current, g, ratingTracker.current.allSnapshots());
    result.badges = newBadges;
    setSessionResult(result);
    setPhase("result");
    setClosingSequence(false);
  }, [closingSequence, leave, pause, append]);

  const doSave = useCallback(() => {
    const session: SavedSession = {
      guests,
      topic,
      utterances,
      rating,
      savedAt: Date.now(),
      ended: sessionPhaseRef.current === "ended",
    };
    saveSessionAndIndex(session);
    setSessionMetas(listSessionMetas());
    setSavedToast(true);
    if (savedToastTimer.current) clearTimeout(savedToastTimer.current);
    savedToastTimer.current = setTimeout(() => setSavedToast(false), 2000);
  }, [guests, topic, utterances, rating]);

  const handleLoadSession = useCallback((id: string) => {
    const s = loadSessionById(id);
    if (!s) return;
    setReplayData({
      guests: s.guests,
      topic: s.topic,
      utterances: s.utterances,
      rating: s.rating,
    });
    setPhase("replay");
  }, []);

  const handleContinueSession = useCallback((id: string) => {
    const s = loadSessionById(id);
    if (!s) return;

    setGuests(s.guests);
    setTopic(s.topic);
    guestsRef.current = s.guests;
    topicRef.current = s.topic;
    topicContextRef.current = null;

    // Last utterance check: if last was a closing system message, remove it
    const utts = [...s.utterances];
    if (utts.length > 0) {
      const last = utts[utts.length - 1];
      if (last.mode === "system" && last.speaker === "moderator") {
        utts.pop();
      }
    }

    utterRef.current = utts;
    setUtterances(utts);

    // Try to reconstruct stances
    stancesRef.current = [];
    activeRef.current = [];
    const seenNames = new Set<string>();
    for (const u of utts) {
      if (typeof u.speaker === "number" && !seenNames.has(s.guests[u.speaker]?.name ?? "")) {
        seenNames.add(s.guests[u.speaker]?.name ?? "");
        activeRef.current.push(u.speaker);
      }
    }
    if (activeRef.current.length >= 2) {
      threadRef.current = mostOpposedPair(activeRef.current);
    } else if (activeRef.current.length === 1) {
      threadRef.current = { a: activeRef.current[0], b: activeRef.current[0], turns: 0 };
    } else {
      threadRef.current = null;
    }

    progressRef.current = { phase: "debate", i: 0 };
    modNoteRef.current = undefined;
    setRating(s.rating);
    setRatingNote("");
    setSuggestions([]);
    setError(null);
    setReplayData(null);
    setSessionResult(null);
    setComboToast(null);

    startTimeRef.current = Date.now();
    ratingTracker.current = new RatingTracker();
    sessionPhaseRef.current = "debate";
    setSessionPhase("debate");
    difficultyRef.current = "kolay";

    setPhase("panel");
  }, [mostOpposedPair]);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSessionById(id);
    setSessionMetas(listSessionMetas());
  }, []);

  const closeReplay = useCallback(() => {
    setReplayData(null);
    setPhase("setup");
  }, []);

  const saveKey = useCallback((k: string) => {
    saveApiKey(k);
    setApiKey(k);
    setKeyModal(false);
    setKeyReason(undefined);
    // Panel'de API hatasıyla durduysa otomatik devam et
    if (phase === "panel" && !runningRef.current) {
      drive();
    }
  }, [phase, drive]);
  const removeKey = useCallback(() => {
    clearApiKey();
    setApiKey(null);
    setKeyModal(false);
  }, []);

  if (phase === "replay" && replayData) {
    return (
      <div className="panel">
        <header className="panel__head">
          <button className="btn btn--ghost btn--icon" onClick={closeReplay} title="Ana ekran">
            ‹
          </button>
          <div className="panel__topic">
            <span className="panel__live" style={{ color: "var(--muted)" }}>KAYITTAN</span>
            <h1>{replayData.topic}</h1>
          </div>
          <div className="panel__guests">
            {replayData.guests.map((g, i) => (
              <div
                key={i}
                className="panel__chip"
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
            <ChatStream utterances={replayData.utterances} guests={replayData.guests} thinking={null} />
          </main>
          <aside className="panel__side">
            <RatingMeter rating={replayData.rating} note="" />
          </aside>
        </div>
      </div>
    );
  }

  if (phase === "result" && sessionResult) {
    return (
      <div className="panel">
        <SessionResultScreen
          result={sessionResult}
          topic={topic}
          guestNames={guests.map((g) => g.name)}
          onBack={() => { leave(); }}
        />
      </div>
    );
  }

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
          savedSession={savedSession}
          onClearSession={() => { clearSession(); setSavedSession(null); }}
          sessions={sessionMetas}
          onLoadSession={handleLoadSession}
          onContinueSession={handleContinueSession}
          onDeleteSession={handleDeleteSession}
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
            Alper Alyaz'ın kişisel projesidir · DeepSeek / Groq ile çalışır · Vikipedi verileriyle
            beslenir
          </p>
        </footer>
      </>
    );
  }

  return (
    <div className="panel">
      <header className="panel__head">
        <button className="btn btn--ghost btn--icon" onClick={() => setLeaveModal(true)} title="Oturumu bitir">
          ‹
        </button>
        <div className="panel__topic">
          <span className="panel__live">
            ● CANLI · <span className="panel__phase-badge">{phaseLabel(sessionPhase)}</span>
          </span>
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

      {comboToast && (
        <div className={`combo-toast ${comboToast.type === "crowd_hot" ? "combo-toast--hot" : comboToast.type === "crowd_cold" ? "combo-toast--cold" : "combo-toast--info"}`}>
          {comboToast.text}
        </div>
      )}

      <div className="panel__body">
        <main className="panel__stage">
          {error && <div className="banner banner--error">{error}</div>}
          <ChatStream utterances={utterances} guests={guests} thinking={thinking} streamingText={streamingText} />
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
        onSave={doSave}
        onEndSession={() => setLeaveModal(true)}
        hasUtterances={utterances.length > 0}
        ttsOn={ttsOn}
        ttsSupported={ttsSupported()}
        onToggleTts={() => setTtsOn((v) => !v)}
        ttsRate={ttsRate}
        onTtsRateChange={setTtsRate}
      />

      {savedToast && <div className="save-toast">✅ Oturum kaydedildi</div>}

      {leaveModal && (
        <div className="modal__backdrop" onClick={() => setLeaveModal(false)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <h2>Oturumu sonlandır</h2>
            <p>Oturumu sonlandırmak istediğinize emin misiniz? Spiker bir kapanış konuşması yapacak ve sonuçlar gösterilecektir.</p>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setLeaveModal(false)}>İptal</button>
              <button className="btn btn--primary" onClick={endSession}>Oturumu Bitir</button>
            </div>
          </div>
        </div>
      )}

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
