import { useState } from "react";
import type { SessionResult } from "../types";
import { ALL_BADGES } from "../lib/gamification";
import { renderShareCard, shareOrDownloadCard } from "../lib/shareCard";

interface Props {
  result: SessionResult;
  topic: string;
  guestNames: string[];
  onBack: () => void;
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}dk ${sec}sn` : `${sec}sn`;
}

const DIFF_LABELS: Record<string, string> = {
  kolay: "Kolay",
  orta: "Orta",
  zor: "Zor",
};

export function SessionResultScreen({ result, topic, guestNames, onBack }: Props) {
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
      });
      if (!blob) {
        setShareMsg("Görsel oluşturulamadı, tekrar deneyin.");
        return;
      }
      const res = await shareOrDownloadCard(
        blob,
        "siyaset-meydani-karne.png",
        `"${topic}" — Reyting ${result.averageRating}. Sen de tarihi tartıştır!`,
      );
      if (res === "downloaded") setShareMsg("📥 Görsel indirildi — paylaşabilirsin!");
      else if (res === "failed") setShareMsg("Paylaşım başarısız oldu.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="result">
      <header className="result__head">
        <h1 className="result__title">
          {result.ended === "win" ? "🏆 Oturum Başarılı!" : "📺 Oturum Sona Erdi"}
        </h1>
        <p className="result__topic">"{topic}"</p>
        <p className="result__meta">
          {guestNames.join(", ")} · {DIFF_LABELS[result.difficulty] ?? result.difficulty}
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
          <span className="result__score-label">Ortalama Reyting</span>
        </div>

        <div className="result__grid">
          <Stat label="Zirve Reyting" value={String(result.peakRating)} emoji="📈" />
          <Stat label="Dip Reyting" value={String(result.troughRating)} emoji="📉" />
          <Stat label="Toplam Süre" value={fmtSeconds(result.totalSeconds)} emoji="⏱️" />
          <Stat label="Toplam Replik" value={String(result.utteranceCount)} emoji="💬" />
          <Stat
            label="Müdahale"
            value={String(result.moderatorInterventions)}
            emoji="🎤"
          />
          <Stat
            label="En Çok Konuşan"
            value={result.mostTalkative ? `${result.mostTalkative} (${result.mostTalkativeCount})` : "-"}
            emoji="🗣️"
          />
        </div>

        {result.mostControversialMoment && (
          <div className="result__moment">
            <span className="result__moment-label">
              🔥 En Tartışmalı An (Reyting {result.mostControversialRating})
            </span>
            <p className="result__moment-text">"{result.mostControversialMoment}…"</p>
          </div>
        )}
      </div>

      <div className="result__badges">
        <h3 className="result__section-title">
          Rozetler ({result.badges.length}/{totalBadges})
        </h3>
        <div className="result__badge-grid">
          {ALL_BADGES.map((badge) => {
            const earned = result.badges.some((b) => b.id === badge.id);
            return (
              <div
                key={badge.id}
                className={`result__badge ${earned ? "result__badge--earned" : "result__badge--locked"}`}
                title={earned ? `Kazanıldı: ${badge.description}` : `Kilitli: ${badge.description}`}
              >
                <span className="result__badge-emoji">
                  {earned ? badge.emoji : "🔒"}
                </span>
                <span className="result__badge-name">{badge.name}</span>
                {earned && <span className="result__badge-check">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="result__actions">
        <button className="btn btn--primary result__share" onClick={shareKarne} disabled={sharing}>
          {sharing ? "🎨 Görsel hazırlanıyor…" : "📸 Karneyi Paylaş"}
        </button>
        <button className="btn btn--ghost" onClick={onBack}>
          Ana Ekrana Dön
        </button>
        {shareMsg && <p className="result__sharemsg">{shareMsg}</p>}
        <p className="result__hint">
          Rozetlerin tarayıcında saklanır — biriktirmeye devam et!
        </p>
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
