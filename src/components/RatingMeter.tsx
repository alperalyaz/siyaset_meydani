import type { CSSProperties } from "react";

interface Props {
  rating: number;
  note: string;
}

// Sağdaki (mobilde üstteki) reytingmetre. Konu ısındıkça yükselir,
// biri uzattıkça / herkes uzlaştıkça düşer.
export function RatingMeter({ rating, note }: Props) {
  const low = rating < 30;
  const high = rating >= 75;
  const color = low ? "#e94b6b" : high ? "#4caf7d" : "#f2b134";

  return (
    <div className={`meter ${low ? "meter--low" : ""}`}>
      <div className="meter__head">
        <span className="meter__label">REYTİNGMETRE</span>
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
          ⚠️ REYTİNGLER DİPTE<br />
          <span>Spiker, müdahale edin!</span>
        </div>
      )}
      {high && !low && <div className="meter__hype">🔥 Ortam kızıştı!</div>}
    </div>
  );
}
