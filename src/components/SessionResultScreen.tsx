import { useState } from "react";
import type { SessionResult } from "../types";
import { ALL_BADGES } from "../lib/gamification";
import { renderShareCard, shareOrDownloadCard } from "../lib/shareCard";
import { useT } from "../lib/i18n";

interface Props {
  result: SessionResult;
  topic: string;
  guestNames: string[];
  onBack: () => void;
  // Rızayla herkese açık galeriye yayınlama (onay penceresini App açar).
  onPublish?: () => void;
  publishedUrl?: string | null;
}

export function SessionResultScreen({ result, topic, guestNames, onBack, onPublish, publishedUrl }: Props) {
  const { t, lang } = useT();
  const fmtSeconds = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const mu = lang === "tr" ? "dk" : "m";
    const su = lang === "tr" ? "sn" : "s";
    return m > 0 ? `${m}${mu} ${sec}${su}` : `${sec}${su}`;
  };
  const totalBadges = ALL_BADGES.length;
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const shareKarne = async () => {
    setSharing(true);
    setShareMsg(null);
    try {
      const blob = await renderShareCard({
        kind: "karne",
        topic,
        guests: guestNames.join(", "),
        averageRating: result.averageRating,
        peak: result.peakRating,
        trough: result.troughRating,
        badges: result.badges.length,
        totalBadges,
        moment: result.mostControversialMoment ?? undefined,
        won: result.ended === "win",
        lang,
      });
      if (!blob) {
        setShareMsg(t("res.imgFail"));
        return;
      }
      const res = await shareOrDownloadCard(
        blob,
        "siyaset-meydani-karne.png",
        t("res.shareCaption", { topic, n: result.averageRating }),
      );
      if (res === "downloaded") setShareMsg(t("res.downloaded"));
      else if (res === "failed") setShareMsg(t("res.shareFail"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="result">
      <header className="result__head">
        <h1 className="result__title">
          {result.ended === "win" ? t("res.win") : t("res.end")}
        </h1>
        <p className="result__topic">"{topic}"</p>
        <p className="result__meta">
          {guestNames.join(", ")} · {t(`diff.${result.difficulty}`)}
        </p>
      </header>

      <div className="result__scorecard">
        <div className="result__score-big">
          <span
            className="result__score-num"
            style={{
              color:
                result.averageRating >= 75
                  ? "#4caf7d"
                  : result.averageRating >= 50
                    ? "#f2b134"
                    : "#e94b6b",
            }}
          >
            {result.averageRating}
          </span>
          <span className="result__score-label">{t("res.avg")}</span>
        </div>

        <div className="result__grid">
          <Stat label={t("res.peak")} value={String(result.peakRating)} emoji="📈" />
          <Stat label={t("res.trough")} value={String(result.troughRating)} emoji="📉" />
          <Stat label={t("res.duration")} value={fmtSeconds(result.totalSeconds)} emoji="⏱️" />
          <Stat label={t("res.replies")} value={String(result.utteranceCount)} emoji="💬" />
          <Stat
            label={t("res.interventions")}
            value={String(result.moderatorInterventions)}
            emoji="🎤"
          />
          <Stat
            label={t("res.mostTalkative")}
            value={result.mostTalkative ? `${result.mostTalkative} (${result.mostTalkativeCount})` : "-"}
            emoji="🗣️"
          />
        </div>

        {result.mostControversialMoment && (
          <div className="result__moment">
            <span className="result__moment-label">
              {t("res.moment", { n: result.mostControversialRating })}
            </span>
            <p className="result__moment-text">"{result.mostControversialMoment}"</p>
          </div>
        )}
      </div>

      <div className="result__badges">
        <h3 className="result__section-title">
          {t("res.badges", { n: result.badges.length, total: totalBadges })}
        </h3>
        <div className="result__badge-grid">
          {ALL_BADGES.map((badge) => {
            const earned = result.badges.some((b) => b.id === badge.id);
            const desc = t(`badge.${badge.id}.desc`);
            return (
              <div
                key={badge.id}
                className={`result__badge ${earned ? "result__badge--earned" : "result__badge--locked"}`}
                title={earned ? t("res.earned", { d: desc }) : t("res.locked", { d: desc })}
              >
                <span className="result__badge-emoji">
                  {earned ? badge.emoji : "🔒"}
                </span>
                <span className="result__badge-name">{t(`badge.${badge.id}.name`)}</span>
                {earned && <span className="result__badge-check">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="result__actions">
        <button className="btn btn--primary result__share" onClick={shareKarne} disabled={sharing}>
          {sharing ? t("res.sharePrep") : t("res.share")}
        </button>
        {onPublish && !publishedUrl && (
          <button className="btn btn--ghost" onClick={onPublish}>
            {t("publish.button")}
          </button>
        )}
        {publishedUrl && (
          <a className="btn btn--ghost" href={publishedUrl} target="_blank" rel="noopener">
            {t("publish.view")}
          </a>
        )}
        <button className="btn btn--ghost" onClick={onBack}>
          {t("res.back")}
        </button>
        {shareMsg && <p className="result__sharemsg">{shareMsg}</p>}
        <p className="result__hint">{t("res.hint")}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="result__stat">
      <span className="result__stat-emoji">{emoji}</span>
      <span className="result__stat-value">{value}</span>
      <span className="result__stat-label">{label}</span>
    </div>
  );
}
