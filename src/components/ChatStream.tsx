import { useEffect, useRef, type ReactNode } from "react";
import type { Guest, Utterance } from "../types";
import { useT } from "../lib/i18n";

// Basit satır içi markdown: **kalın**, *italik*, _italik_.
function renderRich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={key++}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={key++}>{m[2]}</em>);
    else if (m[3]) out.push(<em key={key++}>{m[3]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface Props {
  utterances: Utterance[];
  guests: Guest[];
  thinking: number | null;
  streamingText?: string;
  // Yazı tamam, HD ses sentezleniyor — baloncukta "kayıt" ibaresi göster.
  prepping?: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ChatStream({ utterances, guests, thinking, streamingText, prepping }: Props) {
  const { t } = useT();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [utterances, thinking]);

  return (
    <div className="stream">
      {utterances.map((u) => {
        if (u.mode === "system") {
          return (
            <div key={u.id} className="turn turn--sys">
              <p>{u.text}</p>
            </div>
          );
        }
        if (u.speaker === "moderator") {
          return (
            <div key={u.id} className="turn turn--mod">
              <div className="turn--mod__badge">{t("stream.host")}</div>
              <p>{u.text}</p>
            </div>
          );
        }
        const g = guests[u.speaker as number];
        if (!g) return null;
        return (
          <div key={u.id} className={`turn ${u.mode === "redirect" || u.mode === "interrupt" ? "turn--cut" : ""}`}>
            <div className="turn__avatar" style={{ background: g.color }}>
              {g.thumbnail ? (
                <img src={g.thumbnail} alt={g.name} />
              ) : (
                <span>{initials(g.name)}</span>
              )}
            </div>
            <div className="turn__body">
              <div className="turn__name" style={{ color: g.color }}>
                {g.name}
                {u.mode === "redirect" && <span className="turn__cut">{t("stream.takesFloor")}</span>}
                {u.mode === "interrupt" && <span className="turn__cut">{t("stream.interrupts")}</span>}
              </div>
              <p className="turn__text">{renderRich(u.text)}</p>
            </div>
          </div>
        );
      })}

      {thinking !== null && guests[thinking] && (
        <div className="turn turn--thinking">
          <div className="turn__avatar" style={{ background: guests[thinking].color }}>
            {guests[thinking].thumbnail ? (
              <img src={guests[thinking].thumbnail} alt={guests[thinking].name} />
            ) : (
              <span>{initials(guests[thinking].name)}</span>
            )}
          </div>
          <div className="turn__body">
            <div className="turn__name" style={{ color: guests[thinking].color }}>
              {guests[thinking].name}
            </div>
            {streamingText ? (
              <p className="turn__text turn__text--streaming">{renderRich(streamingText)}</p>
            ) : (
              <div className="typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            {prepping && <div className="turn__prep">{t("stream.prep")}</div>}
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
