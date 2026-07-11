import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Guest, Difficulty } from "../types";
import type { SessionMeta, QuickGuest, QuickTab } from "../lib/store";
import { loadQuickGuests, saveQuickGuests, MAX_QUICK_GUESTS } from "../lib/store";
import { buildGuestsFromNames, resolveGuestByName } from "../lib/wikipedia";
import { suggestGuestNames, suggestTopicIdeas, moderateTopic } from "../lib/engine";
import { quickTopicBlock } from "../lib/safety";
import { TOPIC_POOL, DEEP_TOPIC_POOL, casualPool, deepPool } from "../lib/pool";
import { useT } from "../lib/i18n";

type TopicTab = "gunluk" | "derin";

interface Props {
  onStart: (guests: Guest[], topic: string, difficulty: Difficulty, context?: string | null) => void;
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
  onContinueSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  sharedSession?: { guests: Guest[]; topic: string; utterances: { id: string; speaker: string | number; text: string; mode: string }[]; rating: number } | null;
  onClearSharedSession?: () => void;
  /** Aktif sekme gündelik mi — App tema sınıfını yönetsin (oturuma da taşınsın). */
  onModeChange?: (gunluk: boolean) => void;
}

const MAX_GUESTS = 50;
const DEFAULT_COUNT = 3;

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SetupScreen({ onStart, onOpenKey, onError, apiKey, demoRemaining, hasKey, checking, savedSession, onClearSession, sessions, onLoadSession, onContinueSession, onDeleteSession, sharedSession, onClearSharedSession, onModeChange }: Props) {
  const { t, lang } = useT();
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [extraTopics, setExtraTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  // Derin/felsefi sohbet varsayılan; gündelik/magazinel bonus bir seçenek.
  const [topicTab, setTopicTab] = useState<TopicTab>("derin");
  const topicTabRef = useRef<TopicTab>("derin");
  topicTabRef.current = topicTab;
  // Her sekme için hazır havuzdan rastgele bir alt küme — dil değişince yenilenir.
  const gunlukTopics = useMemo(() => shuffleArr(casualPool(lang)).slice(0, 6), [lang]);
  const derinTopics = useMemo(() => shuffleArr(deepPool(lang)).slice(0, 6), [lang]);
  const poolTopics = topicTab === "derin" ? derinTopics : gunlukTopics;

  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  // Sessiz hata olmasın: boş sonuç/yedek havuz gibi durumlar kullanıcıya söylenir.
  const [notice, setNotice] = useState<string | null>(null);

  // Hazır konuk rafı — her sekmenin kendi listesi, ARAYÜZ DİLİNE göre (TR/EN).
  // Fotoğraflar Vikipedi'den lazy. Kayıt anahtarı dile göre ayrık.
  const langRef = useRef(lang);
  langRef.current = lang;
  const [quickDerin, setQuickDerin] = useState<QuickGuest[]>(() => loadQuickGuests("derin", lang));
  const [quickGunluk, setQuickGunluk] = useState<QuickGuest[]>(() => loadQuickGuests("gunluk", lang));
  useEffect(() => saveQuickGuests("derin", quickDerin, langRef.current), [quickDerin]);
  useEffect(() => saveQuickGuests("gunluk", quickGunluk, langRef.current), [quickGunluk]);
  // Dil değişince rafları o dilin listesiyle yeniden yükle (ilk mount atlanır).
  const firstLangRef = useRef(true);
  useEffect(() => {
    if (firstLangRef.current) { firstLangRef.current = false; return; }
    setQuickDerin(loadQuickGuests("derin", lang));
    setQuickGunluk(loadQuickGuests("gunluk", lang));
    // Eski dilde üretilmiş taze konu çipleri ekranda kalmasın.
    setExtraTopics([]);
  }, [lang]);

  const quickGuests = topicTab === "gunluk" ? quickGunluk : quickDerin;
  // Aktif sekmenin setter'ını ÇAĞRI ANINDA seç (ref üzerinden), yoksa
  // [] bağımlılıklı callback'ler hep ilk sekmenin (derin) rafını değiştirir.
  const setActiveQuick = useCallback(
    (updater: (prev: QuickGuest[]) => QuickGuest[]) => {
      (topicTabRef.current === "gunluk" ? setQuickGunluk : setQuickDerin)(updater);
    },
    [],
  );

  // İlk açılışta iki rafın da zenginleştirilmemiş üyelerinin foto/etiketini çek.
  // PARALEL: biri yavaş/takılırsa diğerlerinin fotoğrafı yine gelir.
  useEffect(() => {
    let cancelled = false;
    const jobs: { tab: QuickTab; q: QuickGuest }[] = [];
    for (const q of loadQuickGuests("derin", lang)) if (!q.resolved) jobs.push({ tab: "derin", q });
    for (const q of loadQuickGuests("gunluk", lang)) if (!q.resolved) jobs.push({ tab: "gunluk", q });
    jobs.forEach(async ({ tab, q }) => {
      try {
        const res = await resolveGuestByName(q.name, lang);
        if (cancelled) return;
        const setter = tab === "gunluk" ? setQuickGunluk : setQuickDerin;
        setter((prev) =>
          prev.map((x) =>
            x.name === q.name
              ? {
                  ...x,
                  resolved: true,
                  // Kanonik adı sakla ki tıklayınca mükerrer chip oluşmasın.
                  resolvedName: res.status === "ok" ? res.guest.name : x.resolvedName,
                  thumbnail: res.status === "ok" ? res.guest.thumbnail : x.thumbnail,
                  era: res.status === "ok" ? res.guest.era : x.era,
                }
              : x,
          ),
        );
      } catch {
        /* ağ hatası — sessizce baş harflerle kalır */
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Gündelik teması App'te yönetilir ki oturum (panel) ekranına da taşınsın.
  // SetupScreen sadece aktif sekmeyi App'e bildirir; sınıfı App <html>'e koyar.
  useEffect(() => {
    onModeChange?.(topicTab === "gunluk");
  }, [topicTab, onModeChange]);

  // Daha önce önerilmiş isimler — "Yeniden"de tekrar gelmesinler (çeşitlilik).
  const shownNamesRef = useRef<string[]>([]);

  const drawForTopic = useCallback(
    async (topicText: string) => {
      const q = topicText.trim();
      if (!q) return;
      // İçerik güvenliği kapısı — konuk GETİRMEDEN önce. Hakaret/karalama
      // (ör. Atatürk'e iftira, nefret söylemi) içeren konularda ne konuk ne
      // token harcanır; masa hiç kurulmaz.
      // 1) Deterministik ön-filtre: bariz karalama → SIFIR token, LLM'e bile gitme.
      const quick = quickTopicBlock(q);
      if (quick.blocked) {
        setGuests(null);
        setNotice(t("notice.blockHate"));
        return;
      }

      setLoading(true);
      setGuests(null);
      setAddMsg(null);
      setNotice(null);
      try {
        // 2) Yapay zekâ moderasyonu (daha ince durumlar) — yine konuk getirmeden.
        const verdict = await moderateTopic(q, apiKey);
        if (!verdict.allowed) {
          setGuests(null);
          setNotice(t("notice.blockHate2"));
          setLoading(false);
          return;
        }
        // Anlamsız girdi (klavye yığını "sdkfj" vb.): boşuna konuk/token harcama.
        if (!verdict.meaningful) {
          setGuests(null);
          setNotice(t("notice.gibberish"));
          setLoading(false);
          return;
        }
        // Tartışmaya kapalı (tek doğrusu olan) konu: engellemeyiz ama uyarırız —
        // konuklar boş yere karşıt uydurmaz, dürüstçe hemfikir olur.
        if (!verdict.debatable) {
          setNotice(t("notice.notDebatable"));
        }

        // Gündelik sekmesindeyken kadro TAMAMEN güncel/magazinel isimlerden
        // kurulur (tarihî figür karışmaz); Derin sekmesinde eski çağlar-arası
        // çeşitlilik kuralı geçerli.
        const popularMode = topicTabRef.current === "gunluk";
        const names = await suggestGuestNames(
          q,
          null,
          shownNamesRef.current,
          apiKey,
          undefined,
          popularMode,
        );
        if (names.length === 0) {
          setNotice(t("notice.noGuests"));
        }
        shownNamesRef.current = [...shownNamesRef.current, ...names].slice(-40);
        const g = await buildGuestsFromNames(names, DEFAULT_COUNT, lang);
        shownNamesRef.current = [...shownNamesRef.current, ...g.map((x) => x.name)].slice(-40);
        setGuests(g);
      } catch (e) {
        onError(e);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, onError, t, lang],
  );

  const pickTopic = useCallback(
    (t: string) => {
      setTopic(t);
      shownNamesRef.current = []; // yeni konu: geçmişi sıfırla
      void drawForTopic(t);
    },
    [drawForTopic],
  );

  const fetchGuestsForInput = useCallback(() => {
    shownNamesRef.current = [];
    void drawForTopic(topic.trim());
  }, [topic, drawForTopic]);

  const reshuffle = useCallback(() => {
    if (topic.trim()) void drawForTopic(topic);
  }, [topic, drawForTopic]);

  // Önceden gösterilmiş tüm konular (tekrar üretmemek için) — iki havuz da.
  const seenTopicsRef = useRef<string[]>([...TOPIC_POOL, ...DEEP_TOPIC_POOL]);
  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    setNotice(null);
    try {
      const fresh = await suggestTopicIdeas(seenTopicsRef.current, apiKey, undefined, topicTab === "derin", lang);
      if (fresh.length) {
        seenTopicsRef.current = [...seenTopicsRef.current, ...fresh].slice(-80);
        setExtraTopics(fresh.slice(0, 6)); // en fazla 6 göster
      } else {
        setNotice(t("notice.topicFail"));
      }
    } catch (e) {
      onError(e);
    } finally {
      setLoadingTopics(false);
    }
    // DİKKAT: lang bağımlılıkta olmalı — yoksa dil değiştirilince eski dilin
    // closure'ı kalır ve konular yanlış dilde üretilir.
  }, [apiKey, onError, topicTab, lang, t]);

  // Sekme değişince üretilmiş (diğer sekmeye ait) taze konuları temizle.
  const switchTab = useCallback((tab: TopicTab) => {
    setTopicTab((cur) => {
      if (cur !== tab) setExtraTopics([]);
      return tab;
    });
  }, []);

  // Çözülmüş bir konuğu masaya ekler ve rafa kaydeder (yoksa, 10 sınırıyla).
  // sourceName: eğer bu ekleme bir "hazır konuk" chip'ine tıklamayla geldiyse,
  // o chip'in RAFTAKİ görünen adı. Kanonik ad farklı çıksa bile (ör. "Machiavelli"
  // → "Niccolò Machiavelli") yeni bir chip yaratmayıp mevcut chip'i günceller.
  const addResolvedGuest = useCallback((g: Guest, sourceName?: string) => {
    setGuests((prev) => {
      const cur = prev ?? [];
      if (cur.some((x) => x.name.toLowerCase() === g.name.toLowerCase())) return cur;
      return [...cur, g].slice(0, MAX_GUESTS).map((x, i) => ({ ...x, color: colorAt(i) }));
    });
    shownNamesRef.current.push(g.name);
    setActiveQuick((prev) => {
      const low = (s: string) => s.toLocaleLowerCase("tr").trim();
      const gl = low(g.name);
      const src = sourceName ? low(sourceName) : null;
      // Mevcut chip'i bul: tıklanan chip ya da adı/kanonik adı bu kişiyle eşleşen.
      const idx = prev.findIndex(
        (x) => (src && low(x.name) === src) || low(x.name) === gl || (x.resolvedName && low(x.resolvedName) === gl),
      );
      if (idx >= 0) {
        // Var olanı YERİNDE güncelle (kanonik ad + foto), yeni chip EKLEME.
        const next = [...prev];
        next[idx] = { ...next[idx], resolved: true, resolvedName: g.name, thumbnail: g.thumbnail ?? next[idx].thumbnail, era: g.era ?? next[idx].era };
        return next;
      }
      if (prev.length >= MAX_QUICK_GUESTS) return prev;
      return [...prev, { name: g.name, resolvedName: g.name, thumbnail: g.thumbnail, era: g.era, resolved: true }];
    });
  }, [setActiveQuick]);

  const addGuestByName = useCallback(
    async (name: string, sourceName?: string) => {
      const q = name.trim();
      if (!q) return;
      setAdding(true);
      setAddMsg(null);
      try {
        const res = await resolveGuestByName(q, lang);
        if (res.status === "blocked") {
          setAddMsg(t("notice.blockedName"));
          return;
        }
        if (res.status === "notfound") {
          setAddMsg(t("notice.notFound", { q }));
          return;
        }
        addResolvedGuest(res.guest, sourceName);
        setAddName("");
      } catch (e) {
        onError(e);
      } finally {
        setAdding(false);
      }
    },
    [addResolvedGuest, onError, lang],
  );

  const addGuest = useCallback(() => void addGuestByName(addName), [addGuestByName, addName]);

  const removeQuickGuest = useCallback(
    (name: string) => {
      setActiveQuick((prev) => prev.filter((x) => x.name !== name));
    },
    [setActiveQuick],
  );

  const removeGuest = useCallback((name: string) => {
    setGuests((prev) =>
      (prev ?? []).filter((g) => g.name !== name).map((x, i) => ({ ...x, color: colorAt(i) })),
    );
  }, []);

  const canStart = !!guests && guests.length >= 2 && topic.trim().length > 0 && !loading;

  return (
    <div className={`setup ${topicTab === "gunluk" ? "setup--gunluk" : ""}`}>
      <header className="setup__hero">
        <h1>{topicTab === "gunluk" ? t("setup.title.gunluk") : t("setup.title.derin")}</h1>
        <p className="setup__tag">
          {topicTab === "gunluk" ? t("setup.tag.gunluk") : t("setup.tag.derin")}
        </p>
      </header>

      {savedSession && (
        <section className="setup__block setup__block--saved">
          <div className="setup__block-head">
            <h2>{t("setup.saved.title")}</h2>
            <button className="btn btn--ghost" onClick={onClearSession}>{t("setup.saved.delete")}</button>
          </div>
          <p className="context-hint">
            {t("setup.topicWord")} <strong>{savedSession.topic}</strong> · {savedSession.guests.map(g => g.name).join(", ")} · {savedSession.utterances.length} {t("setup.repliesWord")}
          </p>
          <button
            className="btn btn--primary"
            onClick={() => onStart(savedSession.guests, savedSession.topic, "kolay", null)}
          >
            {t("setup.saved.continue")}
          </button>
        </section>
      )}

      {sharedSession && (
        <section className="setup__block setup__block--saved">
          <div className="setup__block-head">
            <h2>{t("setup.shared.title")}</h2>
            <button className="btn btn--ghost" onClick={onClearSharedSession}>{t("setup.shared.close")}</button>
          </div>
          <p className="context-hint">
            {t("setup.topicWord")} <strong>{sharedSession.topic}</strong> · {sharedSession.guests.map(g => g.name).join(", ")} · {sharedSession.utterances.length} {t("setup.repliesWord")}
          </p>
          <button
            className="btn btn--primary"
            onClick={() => onStart(sharedSession.guests, sharedSession.topic, "kolay", null)}
          >
            {t("setup.shared.watch")}
          </button>
        </section>
      )}

      {/* 1) KONU */}
      <section className="setup__block">
        <div className="setup__block-head">
          <h2>{t("setup.block1")}</h2>
          <div className="topic-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={topicTab === "derin"}
              className={`topic-tab ${topicTab === "derin" ? "topic-tab--active" : ""}`}
              onClick={() => switchTab("derin")}
            >
              {t("setup.tab.derin")}
            </button>
            <button
              role="tab"
              aria-selected={topicTab === "gunluk"}
              className={`topic-tab ${topicTab === "gunluk" ? "topic-tab--active" : ""}`}
              onClick={() => switchTab("gunluk")}
            >
              {t("setup.tab.gunluk")} <span className="topic-tab__bonus">{t("setup.tab.bonus")}</span>
            </button>
          </div>
        </div>

        <div className="topic-board">
          <div className="topic-chips">
            {(extraTopics.length
              ? interleaveTopics(poolTopics.slice(0, 3), extraTopics.slice(0, 3))
              : poolTopics
            )
              .slice(0, 6)
              .map((t) => (
              <button
                key={t}
                className={`chip ${extraTopics.length && extraTopics.includes(t) ? "chip--fresh" : ""} ${topic === t ? "chip--active" : ""}`}
                onClick={() => pickTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            className="topic-more"
            onClick={() => loadTopics()}
            disabled={loadingTopics}
          >
            {loadingTopics ? t("setup.topicsLoading") : t("setup.topicsMore")}
          </button>
        </div>
        {notice && <p className="setup-notice">{notice}</p>}
        <div className="topic-row">
          <input
            className="topic-input"
            placeholder={t("setup.topicPlaceholder")}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchGuestsForInput()}
          />
          <button
            className="btn btn--primary"
            disabled={!topic.trim() || loading}
            onClick={() => fetchGuestsForInput()}
          >
            {t("setup.fetchGuests")}
          </button>
        </div>
      </section>

      {/* 2) KONUKLAR */}
      <section className="setup__block">
        <div className="setup__block-head">
          <h2>{t("setup.block2")}</h2>
          <div className="setup__draw-controls">
            {guests && guests.length > 0 && (
              <button className="btn btn--ghost" onClick={reshuffle} disabled={loading}>
                {t("setup.reshuffle")}
              </button>
            )}
          </div>
        </div>

        <div className="guest-cards">
          {loading &&
            Array.from({ length: DEFAULT_COUNT }, (_, i) => (
              <div key={i} className="guest-card guest-card--skeleton" />
            ))}
          {!loading && (!guests || guests.length === 0) && (
            <div className="guest-empty">{t("setup.guestEmpty")}</div>
          )}
              {!loading &&
            guests?.map((g) => (
              <div key={g.name} className="guest-card" style={{ borderColor: g.color }}>
                <button
                  className="guest-card__remove"
                  onClick={() => removeGuest(g.name)}
                  title={t("setup.guestRemove")}
                >
                  ×
                </button>
                <div className="guest-card__avatar" style={{ background: g.color }}>
                  {g.thumbnail ? <img src={g.thumbnail} alt={g.name} /> : <span>{initials(g.name)}</span>}
                </div>
                <div className="guest-card__name">{g.name}</div>
                {g.era && <div className="guest-card__era">{g.era}</div>}
                {g.blurb !== g.name && <p className="guest-card__blurb">{g.blurb}</p>}
                {g.summaryStatus === "en_wiki" && (
                  <div className="guest-card__badge guest-card__badge--en">{t("setup.badge.enWiki")}</div>
                )}
                {g.summaryStatus === "minimal" && (
                  <div className="guest-card__badge guest-card__badge--warn">{t("setup.badge.minimal")}</div>
                )}
              </div>
            ))}
        </div>

        {/* Hazır konuk rafı — dokun, masaya gelsin. × ile kaldırılır. */}
        {quickGuests.length > 0 && (
          <div className="quickguests">
            <div className="quickguests__label">{t("setup.quickLabel")}</div>
            <div className="quickguests__strip">
              {quickGuests.map((q) => {
                // Masada mı: chip'in görünen adı VEYA kanonik adı kadrodaysa.
                const already = !!guests?.some((g) => {
                  const gl = g.name.toLowerCase();
                  return gl === q.name.toLowerCase() || (!!q.resolvedName && gl === q.resolvedName.toLowerCase());
                });
                return (
                  <div key={q.name} className={`qg ${already ? "qg--on" : ""}`}>
                    <button
                      className="qg__pick"
                      onClick={() => void addGuestByName(q.name, q.name)}
                      disabled={adding || already || (guests?.length ?? 0) >= MAX_GUESTS}
                      title={already ? t("setup.quick.onTable") : t("setup.quick.add", { name: q.name })}
                    >
                      <span className="qg__avatar">
                        {q.thumbnail ? <img src={q.thumbnail} alt={q.name} /> : <span>{initials(q.name)}</span>}
                        {already && <span className="qg__check">✓</span>}
                      </span>
                      <span className="qg__name">{q.name}</span>
                    </button>
                    <button
                      className="qg__remove"
                      onClick={() => removeQuickGuest(q.name)}
                      title={t("setup.quick.removeShelf")}
                      aria-label={t("setup.quick.removeShelfAria", { name: q.name })}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kendi konuğunu ekle */}
        <div className="topic-row addguest-row">
          <input
            className="topic-input"
            placeholder={t("setup.addPlaceholder", {
              ex: topicTab === "gunluk" ? t("setup.addExample.gunluk") : t("setup.addExample.derin"),
            })}
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
            {adding ? t("setup.searching") : t("setup.add")}
          </button>
        </div>
        {addMsg && <p className="context-hint" style={{ color: "var(--danger)" }}>{addMsg}</p>}
      </section>

      <div className="setup__footer">
        <button
          className="btn btn--primary btn--big"
          disabled={!canStart || checking}
          onClick={() => onStart(guests!, topic.trim(), "kolay", null)}
        >
          {checking ? t("setup.checking") : t("setup.open")}
        </button>
        <div className="setup__meta">
          {hasKey ? (
            <button className="linklike" onClick={onOpenKey}>
              {t("setup.ownKey")}
            </button>
          ) : (
            <>
              <span>
                {demoRemaining !== null
                  ? t("setup.demoLeft", { n: demoRemaining })
                  : t("setup.demoShort")}
              </span>
              <button className="linklike" onClick={onOpenKey}>
                {t("setup.enterKey")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Geçmiş oturumlar */}
      {sessions && sessions.length > 0 && (
        <section className="setup__block setup__block--history">
          <div className="setup__block-head">
            <h2>{t("setup.history")}</h2>
          </div>
          <div className="history-list">
            {sessions.map((s) => (
              <div key={s.id} className="history-card">
                <div className="history-card__info">
                  <div className="history-card__topic">{s.topic}</div>
                  <div className="history-card__meta">
                    {s.guestNames.join(", ")} · {s.utterancesCount} {t("setup.repliesWord")} · {formatDate(s.savedAt)}
                  </div>
                </div>
                <div className="history-card__actions">
                  {s.ended ? (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => onLoadSession?.(s.id)}
                      title={t("setup.history.watch")}
                    >
                      {t("setup.history.watch")}
                    </button>
                  ) : (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => onContinueSession?.(s.id)}
                      title={t("setup.history.continue")}
                    >
                      {t("setup.history.continue")}
                    </button>
                  )}
                  <button
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => onDeleteSession?.(s.id)}
                    title={t("setup.history.delete")}
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

// Havuz + LLM konularını karıştırır: her iki kaynaktan dönüşümlü gösterir.
function interleaveTopics(pool: string[], llm: string[]): string[] {
  const result: string[] = [];
  const max = Math.max(pool.length, llm.length);
  for (let i = 0; i < max; i++) {
    if (i < llm.length) result.push(llm[i]);
    if (i < pool.length) result.push(pool[i]);
  }
  return result;
}
