import type { CSSProperties } from "react";
import { useT } from "../lib/i18n";

interface Props {
  rating: number;
  note: string;
}

// Sağdaki (mobilde üstteki) reytingmetre. Konu ısındıkça yükselir,
// biri uzattıkça / herkes uzlaştıkça düşer.
export function RatingMeter({ rating, note }: Props) {
  const { t } = useT();
  const low = rating < 30;
  const high = rating >= 75;
  const color = low ? "#e94b6b" : high ? "#4caf7d" : "#f2b134";

  return (
    <div className={`meter ${low ? "meter--low" : ""}`}>
      <div className="meter__head">
        <span className="meter__label">{t("meter.label")}</span>
        <span className="meter__value" style={{ color }}>
          {Math.round(rating)}
        </span>
      </div>

      <div className="meter__bar" role="meter" aria-valuenow={Math.round(rating)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="meter__fill"
          style={{ ["--rating"]: rating, background: color } as CSSProperties}
        />
        <div className="meter__ticks">
          {[75, 50, 25].map((t) => (
            <span key={t} className="meter__tick" style={{ bottom: `${t}%` }} />
          ))}
        </div>
      </div>

      {note && <p className="meter__note">{note}</p>}

      {low && (
        <div className="meter__alert">
          {t("meter.low")}<br />
          <span>{t("meter.lowSub")}</span>
        </div>
      )}
      {high && !low && <div className="meter__hype">{t("meter.hype")}</div>}
    </div>
  );
}
