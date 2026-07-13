import { useCallback, useEffect, useRef, useState } from "react";
import type { Guest, Utterance, SessionPhase, Difficulty, SessionResult, SessionEvent, Badge } from "./types";
import type { GuestRole } from "./lib/prompts";
import { setSessionMode } from "./lib/prompts";
import { modLines, naturalJoin } from "./lib/moderatorLines";
import { SetupScreen } from "./components/SetupScreen";
import { ChatStream } from "./components/ChatStream";
import { RatingMeter } from "./components/RatingMeter";
import { ModeratorBar } from "./components/ModeratorBar";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { SessionResultScreen } from "./components/SessionResultScreen";
import { PublicGallery } from "./components/PublicGallery";
import { publishToGallery, fetchGallerySession, removeFromGallery } from "./lib/gallery";
import {
  runOpeningStatement,
  runRatingDirector,
  runGuest,
  suggestQuestions,
  assignStances,
  moderateTopic,
  runClash,
  runModeratorBridge,
  runWalkout,
  runLastStanding,
  runHostOutrage,
} from "./lib/engine";
import { hasProfanity, maskProfanity } from "./lib/profanity";
import type { Stance } from "./types";
import { ApiError, getLastMeta } from "./lib/deepseek";
import { loadApiKey, saveApiKey, clearApiKey, loadSession, clearSession, saveSessionAndIndex, loadSessionById, deleteSessionById, listSessionMetas, loadTtsRate, saveTtsRate, loadProvider, saveProvider, type SavedSession, type SessionMeta, type ProviderKind } from "./lib/store";
import { speak, cancelSpeech, voiceForGuest, ttsSupported, setSpeechRate } from "./lib/tts";
import { elevenSpeak, prepareSpeech, ElevenError, loadHdEnabled, saveHdEnabled, markHdExhausted, isHdExhausted, resetHdExhausted, probeEleven, assignVoicesForPanel, setElevenKey, setGeminiKey } from "./lib/elevenTts";
import { loadElevenKey, saveElevenKey, clearElevenKey, loadGeminiKey, saveGeminiKey, clearGeminiKey } from "./lib/store";
import { quickTopicBlock } from "./lib/safety";
import { useT, ct, detectTopicLang } from "./lib/i18n";
import { encodeSession, decodeSession } from "./lib/share";

import {
  DIFFICULTY_CONFIGS,
  RatingTracker,
  computeSessionResult,
  evaluateBadges,
  comboEvent,
  phaseChangeEvent,
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
  const { t, lang, setLang } = useT();
  const [phase, setPhase] = useState<Phase>("setup");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [topic, setTopic] = useState("");

  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [rating, setRating] = useState(50);
  useEffect(() => {
    ratingRef.current = rating;
  }, [rating]);
  const [ratingNote, setRatingNote] = useState("");
  const [thinking, setThinking] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [running, setRunning] = useState(false);

  const [apiKey, setApiKey] = useState<string | null>(loadApiKey());
  const [provider, setProvider] = useState<ProviderKind>(loadProvider);
  const [demoRemaining, setDemoRemaining] = useState<number | null>(null);
  const [keyModal, setKeyModal] = useState(false);
  const [keyModalTab, setKeyModalTab] = useState<"llm" | "voice">("llm");
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
  const [shareToast, setShareToast] = useState(false);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sharedSession, setSharedSession] = useState<ReplayData | null>(null);
  useEffect(() => {
    return () => {
      if (savedToastTimer.current) clearTimeout(savedToastTimer.current);
      if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
    };
  }, []);

  // ── Gamification state ──
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [comboToast, setComboToast] = useState<SessionEvent | null>(null);

  const [leaveModal, setLeaveModal] = useState(false);
  // Zorunlu spiker müdahale ekranı: "idle" = 3 dk sessizlik molası,
  // "clash" = kızışma (konuklar birbirinin sözünü kesti, stüdyo karıştı).
  const [interjectModal, setInterjectModal] = useState<null | "idle" | "clash" | "solo">(null);
  // Galeriye yayın: VARSAYILAN yayınlanır (sonuç ekranında otomatik).
  // Kullanıcı tek tıkla YAYINDAN KALDIRABİLİR (opt-out). Bilgilendirme,
  // "Programı Bitir" onayında ve sonuç ekranındaki yayın notunda.
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const autoPublishRef = useRef(false); // her sonuç ekranı için tek deneme

  // Sonuç ekranına gelen oturum OTOMATİK galeriye yayınlanır (varsayılan
  // yayında; kullanıcı sonuç ekranından tek tıkla kaldırabilir).
  useEffect(() => {
    if (phase !== "result" || autoPublishRef.current) return;
    if (utterRef.current.length < 4) return; // cılız oturumları yayınlama
    autoPublishRef.current = true;
    setPublishing(true);
    // Yayın kopyasında küfürler TV usulü [bip]lenir; canlı oturum metnine
    // dokunulmaz. Sahne küfür yüzünden yayından ATILMAZ — sadece maskelenir.
    const lang = sessionLangRef.current;
    const maskedUtts = utterRef.current.map((u) =>
      hasProfanity(u.text) ? { ...u, text: maskProfanity(u.text, lang) } : u,
    );
    publishToGallery(guestsRef.current, maskProfanity(topicRef.current, lang), maskedUtts, rating, lang)
      .then(({ slug, url }) => {
        setPublishedSlug(slug);
        setPublishedUrl(url);
      })
      .catch(() => {
        /* yayın başarısızsa sessiz geç — oturum deneyimi etkilenmesin */
      })
      .finally(() => setPublishing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, rating]);
  // Oturum açılış hazırlığı göstergesi: 0 = gizli, 1 = kadrolama, 2 = ses/ilk
  // görüş hazırlığı. İlk konuk repliği ekrana düşünce kapanır.
  const [bootStage, setBootStage] = useState<0 | 1 | 2>(0);
  // Yazı üretildi, HD ses sentezleniyor (canlı yol) — baloncukta "kayıt" ibaresi.
  const [prepping, setPrepping] = useState(false);
  const [closingSequence, setClosingSequence] = useState(false);
  const [modPending, setModPending] = useState(false);

  // Gündelik ("Sohbet Meydanı") teması — App'te tutulur ki oturum ekranına da
  // taşınsın. Kurulumda SetupScreen aktif sekmeyi bildirir; oturum başlayınca
  // SetupScreen unmount olur ama değer korunur (o yüzden panelde de geçerli).
  const [gunlukTheme, setGunlukTheme] = useState(false);
  const gunlukRef = useRef(gunlukTheme);
  // Oturum (tartışma) dili = konunun dili. Spiker senaryo replikleri bu dilde.
  const sessionLangRef = useRef<"tr" | "en">("tr");
  useEffect(() => {
    gunlukRef.current = gunlukTheme;
    document.documentElement.classList.toggle("theme-gunluk", gunlukTheme);
  }, [gunlukTheme]);

  const [ttsOn, setTtsOn] = useState(ttsSupported());
  const ttsRef = useRef(ttsOn);
  useEffect(() => {
    ttsRef.current = ttsOn;
    if (!ttsOn) cancelSpeech();
  }, [ttsOn]);

  const [ttsRate, setTtsRate] = useState<number>(loadTtsRate);
  useEffect(() => {
    saveTtsRate(ttsRate);
    setSpeechRate(ttsRate); // canlı çarpan — sonraki cümleden itibaren geçerli
  }, [ttsRate]);

  // HD sesler (ElevenLabs). Açıkken önce HD denenir, kota/hata olursa tarayıcı
  // sesine düşülür. Kullanıcı tercihi kalıcı (localStorage).
  const [hdTts, setHdTts] = useState<boolean>(loadHdEnabled);
  const hdRef = useRef(hdTts);
  useEffect(() => {
    hdRef.current = hdTts;
    saveHdEnabled(hdTts);
    if (hdTts) resetHdExhausted(); // kullanıcı yeniden açtıysa bir şans daha ver
  }, [hdTts]);
  // Kullanıcının kendi ElevenLabs anahtarı (BYOK). Varsa: tüm oturum HD +
  // sınırsız. Yoksa (demo): HD yalnızca tanışma turunda, sonra normale döner.
  const [elevenKey, setElevenKeyState] = useState<string | null>(loadElevenKey);
  const [geminiKey, setGeminiKeyState] = useState<string | null>(loadGeminiKey);
  useEffect(() => {
    setElevenKey(elevenKey); // elevenTts modülüne bildir (header + limitsiz)
  }, [elevenKey]);
  useEffect(() => {
    setGeminiKey(geminiKey);
  }, [geminiKey]);

  // HD durum bildirimi (anahtar kaydedildi / kaldırıldı gibi).
  const [hdMsg, setHdMsg] = useState<string | null>(null);
  const hdMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Oturum durumu ref'lerde tutulur (kapanış tuzaklarından kaçınmak için).
  const utterRef = useRef<Utterance[]>([]);
  const guestsRef = useRef<Guest[]>([]);
  const topicRef = useRef("");
  const runningRef = useRef(false);
  const loopActiveRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const apiKeyRef = useRef<string | null>(apiKey);

  const progressRef = useRef<Progress>({ phase: "intro", i: 0 });
  // ── AKIŞ BORUSU ── Mevcut konuşma ÇALARKEN sıradaki tur (yönetmen kararı +
  // replik + ses) arkada hazırlanır; sıra gelince anında ekrana düşer. Spiker
  // araya girer ya da transkript değişirse hazırlanan tur çöpe gider (küçük
  // token bedeli — akıcılık için kabul edilebilir).
  const aheadRef = useRef<{
    forCount: number; // planlandığı andaki utterance sayısı (geçerlilik anahtarı)
    speaker: number;
    role: GuestRole;
    ctrl: AbortController;
    promise: Promise<{ dec: Awaited<ReturnType<typeof runRatingDirector>>; text: string } | null>;
  } | null>(null);
  const discardAhead = useCallback(() => {
    aheadRef.current?.ctrl.abort();
    aheadRef.current = null;
  }, []);
  // Son kızışmanın olduğu andaki utterance sayısı (soğuma süresi için).
  const lastClashRef = useRef(0);
  // Son sunucu köprüsünün olduğu andaki utterance sayısı (soğuma süresi için).
  const lastBridgeRef = useRef(0);
  // Sunucu ÖZET yaptıysa: sıradaki konuk özeti önceki konuğa mal etmesin.
  const justBridgedRef = useRef(false);
  // Masayı terk eden konukların index'leri; ve masada tek kalınca "solo"
  // (spiker-röportajı) modu — herkes gidince kalan konuk spikerin sorularını
  // bekler. walkedOutRef görsel işaretleme için de kullanılır.
  const walkedOutRef = useRef<Set<number>>(new Set());
  const [walkedOut, setWalkedOut] = useState<Set<number>>(new Set());
  const soloRef = useRef(false);
  const lastWalkoutRef = useRef(0);
  const activeRef = useRef<number[]>([]); // net fikri olan konuklar
  const threadRef = useRef<Thread | null>(null);
  const modNoteRef = useRef<string | undefined>(undefined);
  const pendingModNoteRef = useRef<string | null>(null); // kuyruğa alınmış spiker mesajı
  const stancesRef = useRef<(Stance | null)[]>([]); // yapımcının atadığı pozisyonlar
  const topicContextRef = useRef<string | null>(null); // güncel olay grounding metni
  const startTimeRef = useRef<number>(0); // oturum başlangıcı
  const ratingTracker = useRef(new RatingTracker());
  const eventQueueRef = useRef<SessionEvent[]>([]);
  const earnedBadgesRef = useRef<Badge[]>([]);
  const sessionPhaseRef = useRef<SessionPhase>("warmup");
  const difficultyRef = useRef<Difficulty>("kolay");
  const pausedRef = useRef(false); // manuel duraklatma vs oturum bitişi ayrımı
  const rate429Ref = useRef(0); // ardışık hız-limiti denemesi (sonsuz döngü koruması)
  // Bir konuğun repliği seslendirilirken (pace() içindeki TTS bitene kadar)
  // true kalır. "thinking" ise pace() başlamadan ÖNCE null'a döner; spiker
  // müdahalesinin sesin üstüne binip binmeyeceğine bununla karar verilir.
  const speakingRef = useRef(false);

  // Otomatik kayıt: aktif oturumun kalıcı id'si. Oturum boyunca aynı kayıt
  // güncellenir (yeni kopya oluşmaz). Yeni oturumda boşalır → ilk kayıtta id alır.
  const activeSessionIdRef = useRef<string>("");
  const ratingRef = useRef(50); // persistSession güncel reytingi ref'ten okusun

  // Boşta kalma (idle) takibi: kullanıcı 3 dk hiç hareket etmezse oturum
  // kendiliğinden duraklatılır (token israfını önler) ve spiker soru önerir.
  const IDLE_MS = 180_000;
  const lastActivityRef = useRef<number>(Date.now());
  const idleFiredRef = useRef(false);
  // Süre dolunca hemen kesmeyiz; bu bayrağı koyarız. Tartışma döngüsü, çalan
  // repliği BİTİRİP bir sonraki tura geçmeden (yani konuşma biter bitmez)
  // duraklar — cümle ortasında kesilmez.
  const pendingIdlePauseRef = useRef(false);
  // Molayı fiilen uygulayan işlev (duraklat+kaydet+spiker araya girsin+öneri).
  // Ref üzerinden çağrılır ki runSession tanımından önce erişilebilsin.
  const performIdlePauseRef = useRef<() => void>(() => {});
  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    idleFiredRef.current = false;
    pendingIdlePauseRef.current = false; // spiker katıldı → bekleyen molayı iptal et
  }, []);

  // Aktif oturumu kalıcı listeye yaz (otomatik kayıt). Ref'lerden EN GÜNCEL
  // hali okur; aynı oturum id'sini kullanarak var olan kaydı GÜNCELLER (kopya
  // oluşturmaz). Böylece kullanıcı "kaydet"e basmadan çıksa bile konuşma
  // "önceki oturumlar"da en son haliyle durur. İçerik yoksa (sadece açılış)
  // kayıt yapmaz. Döndürdüğü değer: kaydedildi mi.
  const persistSession = useCallback((): boolean => {
    const utts = utterRef.current;
    if (!guestsRef.current.length || utts.length <= 1) return false; // boş/anlamsız
    const session: SavedSession = {
      guests: guestsRef.current,
      topic: topicRef.current,
      utterances: utts,
      rating: ratingRef.current,
      savedAt: Date.now(),
      ended: sessionPhaseRef.current === "ended",
    };
    const id = saveSessionAndIndex(session, activeSessionIdRef.current || undefined);
    if (id) activeSessionIdRef.current = id;
    setSessionMetas(listSessionMetas());
    return Boolean(id);
  }, []);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  // URL'den paylasilan oturumu oku (?share=base64 ya da ?s=galeri-slug).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("share");
      if (encoded) {
        const payload = decodeSession(encoded);
        if (payload) {
          setSharedSession({
            guests: payload.g,
            topic: payload.t,
            utterances: payload.u,
            rating: payload.r,
          });
        }
        return;
      }
      const slug = params.get("s");
      if (slug) {
        void fetchGallerySession(slug).then((g) => {
          if (!g) return;
          setSharedSession({
            guests: g.guests as Guest[],
            topic: g.topic,
            utterances: g.utterances as Utterance[],
            rating: g.rating,
          });
        });
      }
    } catch {
      /* gecersiz URL */
    }
  }, []);

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
      setKeyModalTab("llm");
      setKeyModal(true);
    } else if (e instanceof ApiError && e.status === 429) {
      // Groq / upstream rate-limit — retry olarak handle edilecek, pause etme
      setError(ct("err.rateRetrying"));
    } else if (e instanceof ApiError) {
      setError(e.message);
    } else {
      setError(ct("err.unexpected"));
    }
  }, []);

  const pause = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    abortRef.current?.abort();
    cancelSpeech();
    setThinking(null);
    setBootStage(0);
    setPrepping(false);
    setStreamingText("");
    pausedRef.current = true;
    speakingRef.current = false; // pace() abort ile kesilirse takılı kalmasın
  }, []);

  // Tempo: ses açıksa replik seslendirilir ve bitene kadar beklenir; kapalıysa
  // okuma süresi kadar beklenir. Böylece akış okunabilir/dinlenebilir hızda.
  // Tek seslendirme noktası: HD (ElevenLabs) açık ve kullanılabilirse önce onu
  // dener; kota dolar / hata olursa TARAYICI sesine (speak) düşer. Böylece
  // "HD süresi bitince eski moda dönme" tek yerde çözülür.
  const speakVoice = useCallback(
    async (
      text: string,
      voiceIdx: number,
      gender: "male" | "female" | undefined,
      signal: AbortSignal,
    ) => {
      // Demo motoru Gemini (cömert ücretsiz katman) → HD tüm oturum boyunca açık.
      // Kota/limit dolarsa (sunucu 429/NO_KEY) otomatik tarayıcı sesine düşülür.
      const hdAllowed = hdRef.current && !isHdExhausted();
      if (hdAllowed) {
        try {
          await elevenSpeak(text, { voiceIdx, gender, signal });
          return;
        } catch (e) {
          if (signal.aborted) return;
          // Kota/anahtar sorunu → HD'yi bu oturumda kapat ve kullanıcıyı bilgilendir.
          if (e instanceof ElevenError && (e.code === "QUOTA" || e.code === "NO_KEY" || e.code === "BAD_KEY")) {
            markHdExhausted();
            setHdTts(false);
            setError(ct(e.code === "QUOTA" ? "hd.quotaFell" : e.code === "BAD_KEY" ? "hd.badKey" : "hd.noKey"));
          }
          // Diğer hatalarda sessizce tarayıcı sesine düş (aşağı devam).
        }
      }
      const vopts = voiceForGuest(voiceIdx, gender);
      // Temel hızı geç; canlı çarpanı speak() her cümlede kendisi uygular.
      await speak(text, { ...vopts, signal });
    },
    [],
  );

  const pace = useCallback(
    async (
      text: string,
      voiceIdx: number,
      gender: "male" | "female" | undefined,
      signal: AbortSignal,
    ) => {
      if (ttsRef.current && text.trim()) {
        await speakVoice(text, voiceIdx, gender, signal);
      } else {
        await delay(readingDelay(text), signal);
      }
    },
    [speakVoice],
  );

  // LLM cevabı gelir gelmez sesin İLK parçasını hazırlat; çağıran, bu bekleme
  // bitince yazıyı ekrana basar. Böylece yazı ve ses BİRLİKTE başlar ("yazı
  // bitti, ses hâlâ yok" gecikmesi kalmaz). Tarayıcı sesi zaten anında
  // başladığı için yalnızca HD aktifken beklenir.
  const prepareVoice = useCallback(
    async (text: string, voiceIdx: number, gender: "male" | "female" | undefined, signal: AbortSignal) => {
      if (!ttsRef.current || !text.trim()) return;
      if (!hdRef.current || isHdExhausted()) return;
      await prepareSpeech(text, { voiceIdx, gender, signal });
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

    // Spiker yön verdiyse: SORUNUN yöneldiği konuk cevaplar. Sunucu çoğu
    // zaman önce birini özetleyip SONRA başkasına döner ("Fresco'yu dinledik…
    // peki ya siz Sayın Marx?"); bu yüzden "ilk geçen isim" yanlış olur.
    // Doğrusu: hitap/soru işaretlerine (peki ya, siz, sizce, ?, what about…)
    // en YAKIN olan isim. İşaret yoksa soru genelde sonda yönelir → son isim.
    if (modNoteRef.current) {
      const note = modNoteRef.current.toLocaleLowerCase("tr");
      const mentions: { i: number; pos: number }[] = [];
      active.forEach((i) => {
        guestsRef.current[i].name
          .toLocaleLowerCase("tr")
          .split(/\s+/)
          .forEach((tok) => {
            if (tok.length > 3) {
              let from = 0;
              let pos = note.indexOf(tok, from);
              while (pos >= 0) {
                mentions.push({ i, pos });
                from = pos + tok.length;
                pos = note.indexOf(tok, from);
              }
            }
          });
      });

      let named: number | undefined;
      if (mentions.length) {
        // 1) PIVOT: "peki ya (siz) X" / "ya sizin sayın X" / "what about X"
        //    yeni muhataba açık dönüş; işaretten SONRAKİ ilk isim cevaplar.
        const pivot = /(?:peki\s+)?\bya\s+(?:siz(?:in)?\s+)?(?:sayın\s+)?|what about\s+/i.exec(note);
        if (pivot) {
          const after = pivot.index;
          let bestP = Infinity;
          for (const men of mentions) {
            if (men.pos >= after && men.pos < bestP) { bestP = men.pos; named = men.i; }
          }
        }
        // 2) BAŞTA HİTAP: ilk isim metnin başındaysa (~ilk 30 karakter) odur
        //    ("Fresco, Marx'ı dinlediniz…" → Fresco; "Sayın Marx, …" → Marx).
        if (named === undefined) {
          const first = mentions.reduce((a, b) => (b.pos < a.pos ? b : a));
          if (first.pos <= 30) named = first.i;
        }
        // 3) YEDEK: en son anılan isim (soru genelde sonda yönelir).
        if (named === undefined) {
          named = mentions.reduce((a, b) => (b.pos > a.pos ? b : a)).i;
        }
      }

      let speaker = named ?? leastRecentActive();
      // "Az önce konuşanı atla" kuralı yalnızca İSİMSİZ hitapta geçerli:
      // spiker birini İSMİYLE çağırdıysa, az önce konuşmuş olsa bile CEVAP
      // VERMESİ gereken odur (ithamı yiyen susup sözü başkasına vermez).
      if (named === undefined && speaker === last && active.length > 1) {
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
        setBootStage(1); // "oturum yükleniyor" göstergesi
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
        // Tartışma üslubunu LLM'den doldur (havuz-dışı Wikipedia konuklarında
        // yoktu): kızışma, ses tonu ve "programı terk" bu üsluba göre işler.
        cast.styles.forEach((st, idx) => {
          if (st && g[idx] && !g[idx].debateStyle) g[idx].debateStyle = st;
        });
        // HD sesleri: cinsiyet + dönem + üsluba göre her konuğa AYRI, kişiliğine
        // uygun ElevenLabs sesi ata (panelde tekrar yok). Konuşmadan ÖNCE olmalı.
        assignVoicesForPanel(g, gunlukRef.current);
        syncMeta();
      }

      // ── AKIŞ BORUSU (görüş turu) ── Görüş replikleri birbirinden bağımsız
      // (transkripte bakmazlar); sıradaki konuğun repliği + sesi, mevcut
      // konuşma çalarken arkada hazırlanır. İlki, hoş geldin konuşması
      // çalarken hazırlanır — açılıştaki uzun bekleme böyle kapanır.
      type OpenAhead = {
        i: number;
        ctrl: AbortController;
        promise: Promise<Awaited<ReturnType<typeof runOpeningStatement>> | null>;
      };
      let openAhead: OpenAhead | null = null;
      const takeOpenAhead = (): OpenAhead | null => {
        const v = openAhead;
        openAhead = null;
        return v;
      };
      const startOpeningAhead = (idx: number) => {
        if (idx >= g.length || progressRef.current.phase !== "opening") return;
        const ctrl = new AbortController();
        const promise = (async () => {
          try {
            const r = await runOpeningStatement(
              g[idx], g, t,
              stancesRef.current[idx] ?? null,
              topicContextRef.current,
              idx, apiKeyRef.current, ctrl.signal,
            );
            if (r.text.trim()) await prepareVoice(r.text, idx, g[idx].gender, ctrl.signal);
            return r;
          } catch {
            return null; // hata/iptal → tüketici canlı yoldan üretir
          }
        })();
        openAhead = { i: idx, ctrl, promise };
      };

      // Spiker welcome mesajını seslendir (sadece ilk başlangıçta) — bu
      // sırada ilk konuğun görüşü arkada hazırlanır.
      if (utterRef.current.length <= 1) {
        setBootStage(2); // sesler + ilk görüş hazırlanıyor
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const w = utterRef.current[0];
        startOpeningAhead(progressRef.current.i);
        if (w) await pace(w.text, 9, undefined, ctrl.signal);
      }

      // (Ayrı TANIŞMA turu kaldırıldı — spiker açılışta konukları isimle tanıtır,
      //  konuklar da görüş turunda kısaca kendini konumlandırır. Doğrudan görüşler.)

      // --- GÖRÜŞ TURU ---
      while (runningRef.current && progressRef.current.phase === "opening") {
        if (pendingIdlePauseRef.current) { pendingIdlePauseRef.current = false; performIdlePauseRef.current(); return; }
        const i = progressRef.current.i;
        if (i >= g.length) {
            if (activeRef.current.length === 0) {
            append({
              id: uid(),
              speaker: "moderator",
              text: modLines(gunlukRef.current, sessionLangRef.current).noStance,
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
          eventQueueRef.current.push(phaseChangeEvent("debate", Date.now()));
          flushEvent();
          continue;
        }
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(i);
        setStreamingText("");
        // Önceden hazırlanmış görüş varsa kullan; yoksa canlı üret.
        let pre: Awaited<ReturnType<typeof runOpeningStatement>> | null = null;
        {
          const ahead = takeOpenAhead();
          if (ahead) {
            if (ahead.i === i) pre = await ahead.promise;
            else ahead.ctrl.abort();
          }
        }
        const { text, hasStance } =
          pre ??
          (await runOpeningStatement(
            g[i],
            g,
            t,
            stancesRef.current[i] ?? null,
            topicContextRef.current,
            i,
            apiKeyRef.current,
            ctrl.signal,
          ));
        syncMeta();
        if (!runningRef.current) return;
        // Yazı, ses hazır olunca düşer (önceden hazırlandıysa anında).
        if (!pre) setPrepping(true);
        await prepareVoice(text, i, g[i].gender, ctrl.signal);
        setPrepping(false);
        // Doğal nefes: görüşler arasında kısa, rastgele bir duraksama.
        if (i > 0) await delay(500 + Math.random() * 900, ctrl.signal);
        // Sıradaki konuğun görüşü, bu konuk konuşurken hazırlansın.
        startOpeningAhead(i + 1);
        setThinking(null);
        setStreamingText("");
        setBootStage(0); // ilk replik geldi → yükleme göstergesini kapat
        if (!runningRef.current) return;
        append({ id: uid(), speaker: i, text, mode: "normal" });
        if (hasStance && !activeRef.current.includes(i)) activeRef.current.push(i);
        progressRef.current = { phase: "opening", i: i + 1 };
        speakingRef.current = true;
        await pace(text, i, g[i].gender, ctrl.signal);
        speakingRef.current = false;
        // ── SUNUCU AÇILIŞTA HEP SAHNEDE ── Görüş turunda her konuğun ardından
        // sunucu DETERMİNİSTİK olarak köprü kurar: uzun görüşü tek cümlede
        // özetleyip sözü sıradaki konuğa verir; kısa görüşte nötr canlandırır.
        // (Sıradaki görüş arkada hazırlandığı için bu köprü akışı geciktirmez;
        // görüş replikleri transkripte bakmadığı için hazır tur geçerli kalır.)
        if (runningRef.current && i + 1 < g.length) {
          const oLead = text.length < 160;
          const bridge = await runModeratorBridge(
            g[i].name, text, g[i + 1].name, t, gunlukRef.current, apiKeyRef.current, ctrl.signal, oLead,
          ).catch(() => "");
          if (bridge.trim() && runningRef.current) {
            lastBridgeRef.current = utterRef.current.length;
            append({ id: uid(), speaker: "moderator", text: bridge, mode: "normal" });
            speakingRef.current = true;
            await pace(bridge, 9, undefined, ctrl.signal); // 9 = sunucu sesi
            speakingRef.current = false;
            if (!runningRef.current) return;
            await delay(300 + Math.random() * 500, ctrl.signal);
          }
        }
      }

      // --- SERBEST TARTIŞMA ---
      while (runningRef.current && progressRef.current.phase === "debate") {
        try {
        // Boşta molası bekliyorsa: bir önceki replik/seslendirme TAM bittiği
        // için tur ortasında kesmeden burada, nazikçe duraklat.
        if (pendingIdlePauseRef.current) {
          pendingIdlePauseRef.current = false;
          performIdlePauseRef.current();
          return;
        }
        // SOLO (spiker-röportajı) modu: herkes gitti, tek konuk kaldı. Kullanıcı
        // soru sorana kadar bekle — modal ile spikeri davet et. Soru gelince
        // (modNote) aşağıdaki akış konuğun cevabını üretir.
        if (soloRef.current && !pendingModNoteRef.current && !modNoteRef.current) {
          pause();
          persistSession();
          setInterjectModal("solo");
          void doSuggest();
          return;
        }
        // Bekleyen spiker mesajını devreye sok
        if (pendingModNoteRef.current) {
          const modText = pendingModNoteRef.current;
          pendingModNoteRef.current = null;
          setModPending(false);
          append({ id: uid(), speaker: "moderator", text: modText, mode: "normal" });
          modNoteRef.current = modText;
          if (ttsRef.current && modText.trim()) {
            const mctrl = new AbortController();
            void speakVoice(modText, 9, undefined, mctrl.signal);
          }
        }

        // ── KÜFÜR SKANDALI ── Spiker (kullanıcı) canlı yayında küfür ederse
        // sansürlemeyiz — ama bedeli var: TÜM konuklar (lehte/aleyhte fark
        // etmez) sırayla söz alıp "bu rezil ortamda bulunamam" diyerek stüdyoyu
        // terk eder; masada kimse kalmayınca yayın rejiden kesilir ve oturum
        // otomatik sonlanır. (Galeriye yayında küfürler [bip]lenir.)
        if (modNoteRef.current && hasProfanity(modNoteRef.current)) {
          const hostText = modNoteRef.current;
          modNoteRef.current = undefined;
          discardAhead();
          const sctrl = new AbortController();
          abortRef.current = sctrl;
          const leavers = g.map((_, i) => i).filter((i) => !walkedOutRef.current.has(i));
          for (const idx of leavers) {
            if (!runningRef.current) return;
            setThinking(idx);
            const fallback =
              sessionLangRef.current === "en"
                ? "That language, on live air... I will not spend one more minute in this disgraceful setting. I'm leaving!"
                : "Yayında bu sözler... Ben bu rezil ortamda bir dakika daha bulunamam. Gidiyorum!";
            const bye =
              (await runHostOutrage(
                g[idx], g, t, hostText, stancesRef.current[idx] ?? null, apiKeyRef.current, sctrl.signal,
              ).catch(() => "")) || fallback;
            setThinking(null);
            if (!runningRef.current) return;
            append({ id: uid(), speaker: idx, text: bye, mode: "walkout" });
            speakingRef.current = true;
            await prepareVoice(bye, idx, g[idx].gender, sctrl.signal);
            await pace(bye, idx, g[idx].gender, sctrl.signal);
            speakingRef.current = false;
            walkedOutRef.current.add(idx);
            setWalkedOut(new Set(walkedOutRef.current));
            append({
              id: uid(), speaker: "moderator", mode: "system",
              text: modLines(gunlukRef.current, sessionLangRef.current).walkoutNote(g[idx].name),
            });
            await delay(400 + Math.random() * 400, sctrl.signal);
          }
          activeRef.current = [];
          append({
            id: uid(), speaker: "moderator", mode: "system",
            text: modLines(gunlukRef.current, sessionLangRef.current).scandalNote,
          });
          runningRef.current = false;
          setRunning(false);
          setThinking(null);
          sessionPhaseRef.current = "ended";
          const result = computeSessionResult(
            utterRef.current,
            g,
            ratingTracker.current.allSnapshots(),
            startTimeRef.current,
            difficultyRef.current,
            earnedBadgesRef.current,
            false,
          );
          result.badges = evaluateBadges(result, utterRef.current, g, ratingTracker.current.allSnapshots());
          setSessionResult(result);
          setPhase("result");
          return;
        }

        const { speaker, role } = nextSpeaker();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setThinking(speaker);
        setStreamingText("");

        // ── AKIŞ BORUSU: önceki konuşma çalarken hazırlanan tur geçerliyse
        // kullan. Geçerlilik: transkript değişmemiş, spiker notu yok ve plan
        // aynı konuşmacı/rol için yapılmış.
        let pre: { dec: Awaited<ReturnType<typeof runRatingDirector>>; text: string } | null = null;
        {
          const ahead = aheadRef.current;
          if (ahead) {
            aheadRef.current = null;
            const valid =
              ahead.forCount === utterRef.current.length &&
              !modNoteRef.current &&
              ahead.speaker === speaker &&
              ahead.role === role;
            if (valid) pre = await ahead.promise;
            else ahead.ctrl.abort(); // yön değişti → hazırlanan tur çöpe
          }
        }

        const dec =
          pre?.dec ??
          (await runRatingDirector(
            g,
            t,
            utterRef.current,
            g[speaker].name,
            role,
            modNoteRef.current,
            apiKeyRef.current,
            ctrl.signal,
          ));
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
            eventQueueRef.current.push(phaseChangeEvent("final", now));
            flushEvent();
            // Hedefe ulaşıldı— konuklara sürpriz final repliği fırsatı ver
            append({
              id: uid(),
              speaker: "moderator",
              text: modLines(gunlukRef.current, sessionLangRef.current).final(goal, cfg.holdSeconds, cfg.finalGoal),
              mode: "system",
            });
            await pace(utterRef.current[utterRef.current.length - 1]?.text ?? "", 9, undefined, ctrl.signal);
            continue;
          }

          // FİNALDE BAŞARI → OTURUM BİTER
          sessionPhaseRef.current = "ended";
          append({
            id: uid(),
            speaker: "moderator",
            text: modLines(gunlukRef.current, sessionLangRef.current).win(cfg.finalGoal),
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

        // ── SUNUCU KÖPRÜSÜ ── Söz bir konuktan diğerine geçerken sunucu ara
        // sıra araya girip önceki (uzun) konuşmayı tek cümlede özetler ve
        // sıradaki konuğa fikrini sorar — akışı gerçek bir açık oturum gibi
        // yumuşatır. ÖNEMLİ: bu SPİKER MÜDAHALESİ SAYILMAZ; boşta sayacını
        // (lastActivityRef) SIFIRLAMAZ, yani 3 dk sessizlik molası yine işler.
        // Sunucu, bir ORKESTRA ŞEFİ gibi: konuklar KIZIŞIP birbirine laf
        // yetiştirirken (yüksek reyting) SUSAR, kendi hallerine bırakır;
        // ortam DURGUNKEN / BAŞLANGIÇTA çok aktif olur — canlandırır, yönlendirir.
        // Sıklık reytingle TERS orantılı; başlangıçta ekstra aktif.
        {
          const prevSp = lastGuestSpeaker();
          const prevText =
            prevSp !== null ? utterRef.current.filter((u) => u.speaker === prevSp).slice(-1)[0]?.text ?? "" : "";
          // Reytinge göre taban olasılık: 72+ neredeyse sus, düşükte çok aktif.
          const base =
            dec.rating >= 72 ? 0.05 : dec.rating >= 58 ? 0.25 : dec.rating >= 44 ? 0.5 : 0.8;
          // Açılış civarı (ilk ~14 mesaj) sunucu GARANTİ devrede — adamları
          // boş bırakmaz, her söz devrinde köprü kurar (cooldown yine işler).
          const prob = utterRef.current.length < 14 ? 1.0 : base;
          const bridgeOk =
            role === "continue" &&
            !modNoteRef.current &&
            prevSp !== null &&
            prevSp !== speaker &&
            prevText.length > 120 &&
            utterRef.current.length - lastBridgeRef.current >= 3 &&
            Math.random() < prob;
          if (bridgeOk) {
            // Düşük reyting/başta daha çok NÖTR "canlandır" üslubu; yüksekte özet.
            const lead = Math.random() < (dec.rating < 52 ? 0.55 : 0.25);
            setThinking(null);
            const bridge = await runModeratorBridge(
              g[prevSp!].name, prevText, g[speaker].name, t, gunlukRef.current, apiKeyRef.current, ctrl.signal, lead,
            ).catch(() => "");
            if (bridge.trim() && runningRef.current) {
              lastBridgeRef.current = utterRef.current.length;
              append({ id: uid(), speaker: "moderator", text: bridge, mode: "normal" });
              // Konuk sunucuyu YOK SAYMASIN: her iki üslupta da cevap sunucuya
              // dönen bir cümleyle başlamalı. Arkada hazırlanan tur (pre) bu
              // köprüyü görmeden üretildi — çöpe at ki cevap canlı üretilsin.
              justBridgedRef.current = true;
              pre = null;
              speakingRef.current = true;
              await pace(bridge, 9, undefined, ctrl.signal); // 9 = sunucu sesi
              speakingRef.current = false;
              if (!runningRef.current) return;
              await delay(300 + Math.random() * 500, ctrl.signal);
            }
            setThinking(speaker);
          }
        }

        const postBridge = justBridgedRef.current;
        justBridgedRef.current = false;
        const text =
          pre?.text ??
          (await runGuest(
            g[speaker],
            g,
            t,
            utterRef.current,
            dec.cue,
            role,
            stancesRef.current[speaker] ?? null,
            topicContextRef.current,
            speaker,
            apiKeyRef.current,
            ctrl.signal,
            (token) => setStreamingText((p) => p + token),
            postBridge,
          ));
        rate429Ref.current = 0; // tur başarılı — limit sayacını sıfırla
        syncMeta();
        if (!runningRef.current) return;

        // Akış baloncuğu ekranda kalır; ses hazır olunca yazı mesaja dönüşür
        // ve ses HEMEN başlar (uzun "sessiz okuma" gecikmesi yok).
        if (text.trim()) {
          if (!pre) setPrepping(true);
          await prepareVoice(text, speaker, g[speaker].gender, ctrl.signal);
          setPrepping(false);
          // Doğal nefes: gerçek oturumda cevap ANINDA gelmez — önceki sözü
          // tarttığını hissettiren kısa, rastgele bir duraksama.
          await delay(600 + Math.random() * 1100, ctrl.signal);
        }
        setThinking(null);
        setStreamingText("");
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

        // ── KIZIŞMA ── Tansiyon tavan yapınca (yüksek reyting) ara sıra rakip
        // konuk konuşmacının SÖZÜNÜ ORTASINDAN KESER: ses gerçekten yarıda
        // kesilir, kesilen tersler, stüdyo karışır ve spikerin zorunlu
        // müdahale ekranı açılır. Gündelik modda kapalı; soğuma süresi var.
        const clashNow =
          !gunlukRef.current &&
          text.trim().length > 80 &&
          role === "continue" &&
          dec.rating >= 75 &&
          activeRef.current.length >= 2 &&
          utterRef.current.length - lastClashRef.current >= 8 &&
          Math.random() < 0.5;
        if (clashNow) {
          const rival = opponentOf(speaker, activeRef.current);
          if (rival !== speaker) {
            lastClashRef.current = utterRef.current.length;
            discardAhead(); // hazırlanan normal tur geçersiz — akış değişiyor
            // Kesme replikleri, konuşmacı konuşurken arkada yazılır.
            const clashPromise = runClash(g[rival], g[speaker], t, text, apiKeyRef.current, ctrl.signal).catch(() => null);
            // Konuşmacının sesi sözünün ~%60'ında kesilir (gerçek söz kesme).
            speakingRef.current = true;
            const cutCtrl = new AbortController();
            const onAbort = () => cutCtrl.abort();
            ctrl.signal.addEventListener("abort", onAbort);
            const cutTimer = setTimeout(() => cutCtrl.abort(), Math.max(3500, Math.min(16000, text.length * 62 * 0.6)));
            await pace(text, speaker, g[speaker].gender, cutCtrl.signal);
            clearTimeout(cutTimer);
            ctrl.signal.removeEventListener("abort", onAbort);
            const clash = runningRef.current && !ctrl.signal.aborted ? await clashPromise : null;
            if (clash?.interrupt) {
              append({ id: uid(), speaker: rival, text: clash.interrupt, mode: "interrupt" });
              await prepareVoice(clash.interrupt, rival, g[rival].gender, ctrl.signal);
              await pace(clash.interrupt, rival, g[rival].gender, ctrl.signal);
              if (clash.retort && runningRef.current) {
                append({ id: uid(), speaker, text: clash.retort, mode: "interrupt" });
                await prepareVoice(clash.retort, speaker, g[speaker].gender, ctrl.signal);
                await pace(clash.retort, speaker, g[speaker].gender, ctrl.signal);
              }
              speakingRef.current = false;
              if (!runningRef.current) return;
              // Duraklat ve KARARI kullanıcıya bırak — sunucu HENÜZ konuşmaz.
              // Modal karar noktasıdır: bir soruyla el koyarsa sunucu o soruyu
              // sorar; "bırakın kapışsınlar" derse sunucu hiç araya girmez,
              // kavga kaldığı yerden sürer. (Önceden sunucu "sükûnet lütfen"
              // deyip müdahaleyi kullanıcı seçmeden yapıyordu — çelişkiydi.)
              pause();
              persistSession();
              setInterjectModal("clash");
              void doSuggest();
              return;
            }
            // Kesme üretilemedi → sessizce normal akışa dön (konuşma zaten çaldı).
            speakingRef.current = false;
            continue;
          }
        }

        // ── PROGRAMI TERK ── Ciddi fikir ayrılığı + yüksek tansiyon + AYKIRI
        // karakterli konuk → öfkeyle masayı terk eder. Tek kişi kalınca meydan
        // okuyan bir kapanış + spiker-röportajı (solo) moduna geçilir.
        // Nadir ve dramatik; gündelik modda kapalı, soğuma süreli.
        {
          const DRAMATIC = new Set(["provokatör", "agresif", "otoriter", "alaycı", "pasif-agresif"]);
          const cands = activeRef.current.filter((i) => DRAMATIC.has(g[i].debateStyle ?? ""));
          const walkoutNow =
            !gunlukRef.current &&
            dec.rating >= 80 &&
            activeRef.current.length >= 2 &&
            cands.length > 0 &&
            utterRef.current.length - lastWalkoutRef.current >= 10 &&
            Math.random() < 0.22;
          if (walkoutNow) {
            const walker = DRAMATIC.has(g[speaker].debateStyle ?? "") ? speaker : cands[0];
            lastWalkoutRef.current = utterRef.current.length;
            discardAhead();
            const bye = await runWalkout(
              g[walker], g, t, stancesRef.current[walker] ?? null, apiKeyRef.current, ctrl.signal,
            ).catch(() => "");
            if (bye.trim() && runningRef.current) {
              append({ id: uid(), speaker: walker, text: bye, mode: "walkout" });
              speakingRef.current = true;
              await prepareVoice(bye, walker, g[walker].gender, ctrl.signal);
              await pace(bye, walker, g[walker].gender, ctrl.signal);
              speakingRef.current = false;
            }
            if (!runningRef.current) return;
            // Masadan çıkar + görsel işaretle + sahne notu.
            walkedOutRef.current.add(walker);
            setWalkedOut(new Set(walkedOutRef.current));
            activeRef.current = activeRef.current.filter((i) => i !== walker);
            append({
              id: uid(), speaker: "moderator", mode: "system",
              text: modLines(gunlukRef.current, sessionLangRef.current).walkoutNote(g[walker].name),
            });

            if (activeRef.current.length >= 2) {
              threadRef.current = mostOpposedPair(activeRef.current); // kalanlar sürsün
            } else if (activeRef.current.length === 1) {
              // TEK KALDI → meydan okuyan kapanış + solo (spiker-röportajı) modu.
              const sole = activeRef.current[0];
              const leftNames = naturalJoin(
                [...walkedOutRef.current].map((i) => g[i].name),
                sessionLangRef.current,
              );
              const stand = await runLastStanding(
                g[sole], g, t, leftNames, stancesRef.current[sole] ?? null, apiKeyRef.current, ctrl.signal,
              ).catch(() => "");
              if (stand.trim() && runningRef.current) {
                append({ id: uid(), speaker: sole, text: stand, mode: "normal" });
                speakingRef.current = true;
                await prepareVoice(stand, sole, g[sole].gender, ctrl.signal);
                await pace(stand, sole, g[sole].gender, ctrl.signal);
                speakingRef.current = false;
              }
              soloRef.current = true;
              threadRef.current = { a: sole, b: sole, turns: 0 };
            } else {
              pause(); // teorik: 0 kaldı
              return;
            }
            continue;
          }
        }

        // ── AKIŞ BORUSU (üretici): sıradaki tur, bu konuşma çalarken arkada
        // hazırlanır (yönetmen kararı + replik + ses). Spiker notu beklemede
        // değilse plan deterministiktir; araya girilirse geçerlilik anahtarı
        // (forCount/modNote) turun çöpe gitmesini sağlar.
        if (text.trim() && runningRef.current && !pendingModNoteRef.current && !pendingIdlePauseRef.current) {
          const plan = nextSpeaker();
          const actrl = new AbortController();
          const forCount = utterRef.current.length;
          const transcript = utterRef.current;
          const promise = (async () => {
            try {
              const d = await runRatingDirector(
                g, t, transcript, g[plan.speaker].name, plan.role,
                undefined, apiKeyRef.current, actrl.signal,
              );
              const tx = await runGuest(
                g[plan.speaker], g, t, transcript, d.cue, plan.role,
                stancesRef.current[plan.speaker] ?? null,
                topicContextRef.current, plan.speaker,
                apiKeyRef.current, actrl.signal,
              );
              if (tx.trim()) await prepareVoice(tx, plan.speaker, g[plan.speaker].gender, actrl.signal);
              return { dec: d, text: tx };
            } catch {
              return null; // hata/iptal → sıra gelince canlı üretilir
            }
          })();
          aheadRef.current?.ctrl.abort();
          aheadRef.current = { forCount, speaker: plan.speaker, role: plan.role, ctrl: actrl, promise };
        }

        if (text.trim()) {
          speakingRef.current = true;
          await pace(text, speaker, g[speaker].gender, ctrl.signal);
          speakingRef.current = false;
        } else {
          await delay(500, ctrl.signal);
        }

        } catch (e) {
          if (e instanceof ApiError && e.status === 429 && runningRef.current) {
            rate429Ref.current += 1;
            // Kota gerçekten bittiyse sonsuza dek "deneniyor..." göstermek
            // kullanıcıya "uygulama bozuk" hissi verir; 3 denemede dürüstçe dur.
            if (rate429Ref.current >= 3) {
              rate429Ref.current = 0;
              setError(
                ct("err.providerLimit"),
              );
              pause();
              return;
            }
            setError(ct("err.rateRetrying"));
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
    markActivity(); // devam = etkileşim; boşta sayacı sıfırla
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

  // Spiker müdahalesi: mevcut konuşmayı KESMEDEN kuyruğa al, konuk bitirince devreye gir.
  const moderate = useCallback(
    (text: string) => {
      markActivity(); // spiker söz aldı = etkileşim
      setError(null);
      setSuggestions([]);
      // Konuşma yoksa direkt ekle, yoksa kuyruğa al. "thinking === null" tek
      // başına yeterli değil: TTS, thinking null'a dönüp pace() başladıktan
      // SONRA çalar; speakingRef bu boşluğu kapatıp iki sesin üst üste
      // binmesini (spiker + konuk aynı anda) engeller.
      if (!runningRef.current || (thinking === null && !speakingRef.current)) {
        append({ id: uid(), speaker: "moderator", text, mode: "normal" });
        if (ttsRef.current && text.trim()) {
          const ctrl = new AbortController();
          void speakVoice(text, 9, undefined, ctrl.signal);
        }
        modNoteRef.current = text;
        if (!runningRef.current && phase === "panel") drive();
        return;
      }
      // Konuşma sürüyor: kuyruğa al (son mesaj geçerli, öncekini override)
      pendingModNoteRef.current = text;
      setModPending(true);
    },
    [append, drive, thinking, phase],
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
    setSessionResult(null);
    setComboToast(null);

    // Oturum boyu personaların ve yönetmenin tonunu belirler (gündelik = gevşek).
    setSessionMode(gunlukRef.current);

    activeSessionIdRef.current = ""; // yeni oturum → ilk otomatik kayıtta id alır
    sessionLangRef.current = detectTopicLang(t); // spiker replikleri konu dilinde
    markActivity();

    // Tek-nefes açılış: spiker konukları isimle tanıtır + konu + doğrudan
    // görüşlere geçer. Ayrı tanışma turu YOK (tekrarı önler, hızlı başlar).
    const names = naturalJoin(g.map((x) => x.name), sessionLangRef.current);
    const welcome: Utterance = {
      id: uid(),
      speaker: "moderator",
      text: modLines(gunlukRef.current, sessionLangRef.current).welcomeOpen(names, t),
      mode: "normal",
    };
    utterRef.current = [welcome];
    setUtterances([welcome]);

    progressRef.current = { phase: "opening", i: 0 };
    activeRef.current = [];
    threadRef.current = null;
    modNoteRef.current = undefined;
    stancesRef.current = [];
    walkedOutRef.current = new Set();
    setWalkedOut(new Set());
    soloRef.current = false;
    lastWalkoutRef.current = 0;
    // Soğuma sayaçlarını da sıfırla — yoksa aynı sekmede açılan sonraki
    // oturumlarda (utterance sayısı sıfırlanır ama sayaç birikmiş kalırdı)
    // köprü/kızışma çok geç tetikleniyordu.
    lastBridgeRef.current = 0;
    lastClashRef.current = 0;
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
      // Deterministik ön-filtre (sıfır token): bariz karalama → LLM'e gitme.
      if (quickTopicBlock(t).blocked) {
        setBlockedMsg(ct("block.hate"));
        return;
      }
      setChecking(true);
      try {
        const verdict = await moderateTopic(t, apiKeyRef.current);
        syncMeta();
        if (!verdict.allowed) {
          setBlockedMsg(ct("block.generic"));
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
    discardAhead();
    persistSession(); // kaydetmeden çıksa bile konuşma "önceki oturumlar"da kalsın
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
  }, [pause, persistSession, discardAhead]);

  const endSession = useCallback(() => {
    setLeaveModal(false);
    if (closingSequence) return;
    setClosingSequence(true);
    discardAhead();

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
      text: modLines(gunlukRef.current, sessionLangRef.current).closing,
      mode: "system",
    });

    // Kapanış mesajını seslendir
    if (ttsRef.current && utterRef.current.length > 0) {
      const last = utterRef.current[utterRef.current.length - 1];
      const ctrl = new AbortController();
      // fire-and-forget: sonuç ekranı görünmeden seslendir
      void speakVoice(last.text, 9, undefined, ctrl.signal);
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
    sessionPhaseRef.current = "ended";
    persistSession(); // biten oturumu "önceki oturumlar"a (ended işaretiyle) yaz
    setPhase("result");
    setClosingSequence(false);
  }, [closingSequence, leave, pause, append, persistSession, discardAhead]);

  // Geri (‹ ya da tarayıcı/telefon geri tuşu): oturumu BİTİRMEZ, sadece ana
  // menüye döner. Konuşma "önceki oturumlar"a yazılır ve oradan devam edilir.
  // Panel'e girerken history'ye bir kayıt itilir ki telefonun geri tuşu
  // sayfadan çıkarmak yerine ana menüye dönsün.
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);
  const panelHistRef = useRef(false);
  useEffect(() => {
    if (phase !== "panel") return;
    window.history.pushState({ smPanel: true }, "");
    panelHistRef.current = true;
    const onPop = () => {
      panelHistRef.current = false;
      leaveRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      panelHistRef.current = false;
    };
  }, [phase]);
  const goBack = useCallback(() => {
    // history kaydımız varsa geri gidip popstate'e bırak (history dengede
    // kalsın); yoksa doğrudan ayrıl.
    if (panelHistRef.current) window.history.back();
    else leave();
  }, [leave]);

  const doSave = useCallback(() => {
    if (!persistSession()) return;
    setSavedToast(true);
    if (savedToastTimer.current) clearTimeout(savedToastTimer.current);
    savedToastTimer.current = setTimeout(() => setSavedToast(false), 2000);
  }, [persistSession]);

  const handleShare = useCallback(async () => {
    const encoded = encodeSession(guests, topic, utterances, rating);
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Siyaset Meydani — ${topic}`, text: topic, url });
      } catch {
        /* kullanici iptal etti veya hata */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard erisilemedi */
      }
    }

    setShareToast(true);
    if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
    shareToastTimer.current = setTimeout(() => setShareToast(false), 2500);
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

    activeSessionIdRef.current = id; // devam eden oturum aynı kaydı günceller
    sessionLangRef.current = detectTopicLang(s.topic);
    markActivity();
    assignVoicesForPanel(s.guests, gunlukRef.current); // kayıtlı konuklar için de HD ses ataması

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

  // ── Otomatik kayıt ── Oturum ekranındayken konuşma her değiştiğinde (yeni
  // replik) kısa bir gecikmeyle kalıcıya yazılır. Böylece kullanıcı "kaydet"e
  // basmasa da "önceki oturumlar" listesi hep en güncel hali tutar.
  useEffect(() => {
    if (phase !== "panel" || utterances.length <= 1) return;
    const t = setTimeout(() => persistSession(), 1500);
    return () => clearTimeout(t);
  }, [phase, utterances, persistSession]);

  // Sekme/pencere kapanırken son hali senkron yaz (debounce'ı bekleyemeyiz).
  useEffect(() => {
    const onLeaveTab = () => {
      if (phase === "panel") persistSession();
    };
    window.addEventListener("beforeunload", onLeaveTab);
    window.addEventListener("pagehide", onLeaveTab);
    return () => {
      window.removeEventListener("beforeunload", onLeaveTab);
      window.removeEventListener("pagehide", onLeaveTab);
    };
  }, [phase, persistSession]);

  // Süre dolunca yapılacak "nazik mola": konuşma bittiği an döngü çağırır.
  // Duraklar, güncel hali kaydeder, spiker araya girer ve EKRANIN ÖNÜNE soru
  // önerileriyle bir modal çıkar (kullanıcının dikkatini kaçırmasın diye).
  const performIdlePause = useCallback(() => {
    pause();
    persistSession();
    append({
      id: uid(),
      speaker: "moderator",
      text: modLines(gunlukRef.current, sessionLangRef.current).idlePause,
      mode: "system",
    });
    setInterjectModal("idle");
    void doSuggest();
  }, [pause, persistSession, append, doSuggest]);
  useEffect(() => {
    performIdlePauseRef.current = performIdlePause;
  }, [performIdlePause]);

  // ── Spiker katılımı koruması ── Ölçtüğümüz şey SPİKERİN (kullanıcının)
  // tartışmaya müdahalesidir; sayfada gezinmek/kaydırmak değil. Spiker 3 dk
  // boyunca hiç söz almazsa (moderate) mola BAYRAĞI konur — ama TAK diye
  // kesilmez: tartışma döngüsü çalan repliği bitirince duraklar (aşağıda).
  // Sayaç yalnızca gerçek müdahale (moderate) ve ▶ Devam (drive) ile sıfırlanır.
  useEffect(() => {
    if (phase !== "panel") return;
    const iv = setInterval(() => {
      if (!runningRef.current || idleFiredRef.current) return;
      // Oturum kendi kendine ilerliyor ve spiker 3 dk'dır katılmadıysa araya gir
      // (tanışma/görüş turu dahil — HD seslerle bunlar uzun sürebiliyor).
      if (Date.now() - lastActivityRef.current < IDLE_MS) return;
      idleFiredRef.current = true;
      pendingIdlePauseRef.current = true; // döngü, sıradaki tur başında uygular
    }, 10_000);

    return () => clearInterval(iv);
  }, [phase]);

  const saveKey = useCallback((k: string, p: ProviderKind) => {
    saveApiKey(k);
    saveProvider(p);
    setApiKey(k);
    setProvider(p);
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
  const showHd = useCallback((m: string, ms = 8000) => {
    setHdMsg(m);
    if (hdMsgTimer.current) clearTimeout(hdMsgTimer.current);
    hdMsgTimer.current = setTimeout(() => setHdMsg(null), ms);
  }, []);
  // HD anahtarı kaydet — türü ön-eke göre yönlendir: yalnızca "sk_..." →
  // ElevenLabs; geri kalan her şey → Google Gemini. (Google anahtarları eski
  // "AIza..." VEYA yeni "AQ...." biçiminde olabilir; varsayılan motorumuz
  // Gemini olduğu için bilinmeyen biçimler de Gemini'ye gider.) Diğer slotu
  // temizler (tek anahtar aktif). Kaydettikten sonra anahtar HEMEN sınanır ve
  // sonuç açıkça bildirilir ("girdim ama çalışmıyor" belirsizliği kalmasın).
  const saveHdKeyCb = useCallback((k: string) => {
    const key = k.trim();
    if (/^sk_/i.test(key)) {
      saveElevenKey(key); setElevenKeyState(key); setElevenKey(key);
      clearGeminiKey(); setGeminiKeyState(null); setGeminiKey(null);
    } else {
      saveGeminiKey(key); setGeminiKeyState(key); setGeminiKey(key);
      clearElevenKey(); setElevenKeyState(null); setElevenKey(null);
    }
    resetHdExhausted(); // yeni anahtar → HD'ye tekrar şans ver
    setHdTts(true);
    showHd(ct("hd.probing"));
    void probeEleven().then((p) => {
      if (p.ok) showHd(ct("hd.keyWorks"));
      else if (p.code === "BAD_KEY" || p.code === "NO_KEY") showHd(ct("hd.badKey"), 12000);
      else if (p.code === "QUOTA") showHd(ct("hd.keyQuota"), 12000);
      else showHd(ct("hd.unreachable"));
    });
  }, [showHd]);
  const clearHdKeyCb = useCallback(() => {
    clearElevenKey(); setElevenKeyState(null); setElevenKey(null);
    clearGeminiKey(); setGeminiKeyState(null); setGeminiKey(null);
    showHd(ct("hd.keyCleared"));
  }, [showHd]);

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
          onBack={() => { setPublishedUrl(null); setPublishedSlug(null); autoPublishRef.current = false; leave(); }}
          publishedUrl={publishedUrl}
          publishing={publishing}
          onUnpublish={async () => {
            if (!publishedSlug) return;
            const ok = await removeFromGallery(publishedSlug);
            if (ok) {
              setPublishedUrl(null);
              setPublishedSlug(null);
            }
          }}
        />
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <>
        <button
          className="lang-toggle"
          onClick={() => setLang(lang === "tr" ? "en" : "tr")}
          title={t("lang.title")}
        >
          🌐 {t("lang.toggle")}
        </button>
        {error && (
          <div className="error-toast" role="alert">
            <span>⚠️ {error}</span>
            <button className="error-toast__close" onClick={() => setError(null)} title={t("key.close")}>
              ×
            </button>
          </div>
        )}
        <SetupScreen
          onStart={beginSession}
          onOpenKey={() => { setKeyModalTab("llm"); setKeyModal(true); }}
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
          sharedSession={sharedSession}
          onClearSharedSession={() => setSharedSession(null)}
          onModeChange={setGunlukTheme}
        />
        <ApiKeyModal
          open={keyModal}
          reason={keyReason}
          currentKey={apiKey}
          currentProvider={provider}
          onSave={saveKey}
          onClear={removeKey}
          onClose={() => setKeyModal(false)}
          currentElevenKey={geminiKey ?? elevenKey}
          onSaveEleven={saveHdKeyCb}
          onClearEleven={clearHdKeyCb}
          currentVoiceEngine={geminiKey ? "gemini" : elevenKey ? "eleven" : undefined}
          initialTab={keyModalTab}
        />
        <PublicGallery />
        {blockedMsg && (
          <div className="modal__backdrop" onClick={() => setBlockedMsg(null)}>
            <div className="modal modal--block" onClick={(e) => e.stopPropagation()}>
              <div className="modal--block__icon">🕊️</div>
              <h2>{t("block.title")}</h2>
              <p>{blockedMsg}</p>
              <div className="modal__actions">
                <button className="btn btn--primary" onClick={() => setBlockedMsg(null)}>
                  {t("block.ok")}
                </button>
              </div>
            </div>
          </div>
        )}
        <footer className="credits">
          <p className="credits__disclaimer">
            <strong>{t("footer.disclaimerLabel")}</strong>{t("footer.disclaimer")}
          </p>
           <p className="credits__by">
            <a href="https://github.com/alperalyaz/siyaset_meydani" target="_blank" rel="noopener">Alper Alyaz</a>{t("footer.by")}
          </p>
        </footer>
      </>
    );
  }

  return (
    <div className="panel">
      <header className="panel__head">
        <button className="btn btn--ghost btn--icon" onClick={goBack} title={t("panel.back")}>
          ‹
        </button>
        <div className="panel__topic">
          <span className="panel__live">
             {t("panel.live")}
          </span>
          <h1>{topic}</h1>
        </div>
        <div className="panel__guests">
          {guests.map((g, i) => (
            <div
              key={i}
              className={`panel__chip ${thinking === i ? "panel__chip--active" : ""} ${walkedOut.has(i) ? "panel__chip--left" : ""}`}
              style={{ borderColor: g.color }}
              title={walkedOut.has(i) ? `${g.name} — ${t("stream.walksOff")}` : g.era}
            >
              <span style={{ background: g.color }} />
              {walkedOut.has(i) ? "🚪 " : ""}{g.name}
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
          {modPending && <div className="banner" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{t("mod.pending")}</div>}
          <ChatStream utterances={utterances} guests={guests} thinking={thinking} streamingText={streamingText} prepping={prepping} />
          {bootStage > 0 && (
            <div className="boot-loading">
              <div className="boot-loading__title">{t("boot.title")}</div>
              <div className="boot-loading__bar">
                <div
                  className="boot-loading__fill"
                  style={{ width: bootStage === 1 ? "35%" : "75%" }}
                />
              </div>
              <div className="boot-loading__stage">
                {t(bootStage === 1 ? "boot.stage1" : "boot.stage2")}
              </div>
            </div>
          )}
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
        onShare={handleShare}
        onEndSession={() => setLeaveModal(true)}
        hasUtterances={utterances.length > 0}
        ttsOn={ttsOn}
        ttsSupported={ttsSupported()}
        onToggleTts={() => setTtsOn((v) => !v)}
        ttsRate={ttsRate}
        onTtsRateChange={setTtsRate}
        onOpenKey={() => { setKeyModalTab("voice"); setKeyModal(true); }}
      />

      {hdMsg && (
        <div className="save-toast" style={{ background: "linear-gradient(135deg, #7c4dff, #b06bff)" }}>
          {hdMsg}
        </div>
      )}
      {savedToast && <div className="save-toast">{t("toast.saved")}</div>}
      {shareToast && <div className="save-toast" style={{ background: "linear-gradient(135deg, #3fb6c9, #268fa8)" }}>{t("toast.shared")}</div>}

      {leaveModal && (
        <div className="modal__backdrop" onClick={() => setLeaveModal(false)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{t("leave.title")}</h2>
            <p>{t("leave.body")}</p>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setLeaveModal(false)}>{t("leave.cancel")}</button>
              <button className="btn btn--primary" onClick={endSession}>{t("leave.confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {interjectModal && (
        <div className="modal__backdrop" onClick={() => setInterjectModal(null)}>
          <div
            className={`modal modal--idle${interjectModal === "idle" ? " modal--reji" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {interjectModal === "idle" && (
              <div className="reji-tag">{t("idle.tag")} · {t("panel.live")}</div>
            )}
            <h2>{t(interjectModal === "clash" ? "clash.title" : interjectModal === "solo" ? "solo.title" : "idle.title")}</h2>
            <p className="modal__desc">
              {t(
                interjectModal === "clash"
                  ? "clash.body"
                  : interjectModal === "solo"
                    ? "solo.body"
                    : gunlukTheme
                      ? "idle.bodyGunluk"
                      : "idle.body",
              )}
            </p>

            {loadingSuggestions ? (
              <p className="idle-loading">{t("idle.loading")}</p>
            ) : (
              <div className="idle-qs">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="idle-q"
                    onClick={() => {
                      setInterjectModal(null);
                      moderate(s);
                    }}
                  >
                    🎤 {s}
                  </button>
                ))}
              </div>
            )}

            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setInterjectModal(null)}>
                {t("idle.stay")}
              </button>
              {interjectModal === "solo" ? (
                <button
                  className="btn btn--final"
                  onClick={() => {
                    setInterjectModal(null);
                    setLeaveModal(true);
                  }}
                >
                  🏁 {t("mod.finish")}
                </button>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setInterjectModal(null);
                    setSuggestions([]);
                    drive();
                  }}
                >
                  {t(interjectModal === "clash" ? "clash.silent" : "idle.silent")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ApiKeyModal
        open={keyModal}
        reason={keyReason}
        currentKey={apiKey}
        currentProvider={provider}
        onSave={saveKey}
        onClear={removeKey}
        onClose={() => setKeyModal(false)}
        currentElevenKey={geminiKey ?? elevenKey}
        onSaveEleven={saveHdKeyCb}
        onClearEleven={clearHdKeyCb}
        currentVoiceEngine={geminiKey ? "gemini" : elevenKey ? "eleven" : undefined}
        initialTab={keyModalTab}
      />
    </div>
  );
}
