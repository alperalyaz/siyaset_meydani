import { useState } from "react";
import { API_BASE } from "../lib/deepseek";
import { useT } from "../lib/i18n";

const DONE_KEY = "siyaset_meydani_waitlist_done";

// "Premium yakında" bekleme listesi kutusu. Ayarlar modalında gösterilir.
// E-postayı /api/waitlist'e yollar; kaydolan kullanıcı localStorage'da
// işaretlenir ve bir daha form değil teşekkür mesajı görür.
export function PremiumWaitlist({ source = "settings" }: { source?: string }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(() => {
    try {
      return localStorage.getItem(DONE_KEY) ? "done" : "idle";
    } catch {
      return "idle";
    }
  });

  const submit = async () => {
    const e = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setState("error");
      return;
    }
    setState("sending");
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, lang, source }),
      });
      if (!res.ok) throw new Error("fail");
      try {
        localStorage.setItem(DONE_KEY, "1");
      } catch {
        /* yoksay */
      }
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="premium premium--done">
        <span>✅ {t("premium.thanks")}</span>
      </div>
    );
  }

  return (
    <div className="premium">
      <div className="premium__head">
        <span className="premium__badge">🚀 {t("premium.badge")}</span>
        <p className="premium__pitch">{t("premium.pitch")}</p>
      </div>

      {!open ? (
        <button className="btn btn--primary premium__cta" onClick={() => setOpen(true)}>
          {t("premium.notify")}
        </button>
      ) : (
        <div className="premium__form">
          <input
            type="email"
            inputMode="email"
            placeholder={t("premium.placeholder")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
          <button
            className="btn btn--primary"
            onClick={submit}
            disabled={state === "sending"}
          >
            {state === "sending" ? "…" : t("premium.submit")}
          </button>
        </div>
      )}
      {state === "error" && <p className="premium__err">{t("premium.error")}</p>}
    </div>
  );
}
