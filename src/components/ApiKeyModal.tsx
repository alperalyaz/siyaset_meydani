import { useEffect, useState } from "react";
import type { ProviderKind } from "../lib/store";
import { useT } from "../lib/i18n";
import { PremiumWaitlist } from "./PremiumWaitlist";

interface Props {
  open: boolean;
  reason?: string;
  currentKey: string | null;
  currentProvider?: ProviderKind;
  onSave: (key: string, provider: ProviderKind) => void;
  onClear: () => void;
  onClose: () => void;
  currentElevenKey?: string | null;
  onSaveEleven?: (key: string) => void;
  onClearEleven?: () => void;
  // Hangi HD anahtarı kayıtlı (sekme içi varsayılan seçim için).
  currentVoiceEngine?: "gemini" | "eleven";
  // Modal açıldığında hangi sekme görünsün (panel ⚙️ → seslendirme).
  initialTab?: "llm" | "voice";
}

// Dil modeli sağlayıcıları. Açıklamalar i18n'de (noteKey); bağlantı cümlesi
// ortak "key.prov.get" kalıbıyla kurulur.
const PROVIDERS: { id: ProviderKind; label: string; link: string; linkText: string; placeholder: string; noteKey?: string }[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    link: "https://platform.deepseek.com/api_keys",
    linkText: "platform.deepseek.com",
    placeholder: "sk-... (DeepSeek)",
    noteKey: "key.prov.deepseekNote",
  },
  {
    id: "openai",
    label: "OpenAI",
    link: "https://platform.openai.com/api-keys",
    linkText: "platform.openai.com",
    placeholder: "sk-proj-... (OpenAI)",
  },
  {
    id: "anthropic",
    label: "Claude",
    link: "https://console.anthropic.com/settings/keys",
    linkText: "console.anthropic.com",
    placeholder: "sk-ant-... (Claude)",
  },
  {
    id: "groq",
    label: "Groq",
    link: "https://console.groq.com/keys",
    linkText: "console.groq.com",
    placeholder: "gsk_... (Groq)",
    noteKey: "key.prov.groqNote",
  },
];

// Seslendirme (HD ses) motorları. Varsayılan ve önerilen: Google Gemini.
const VOICE_ENGINES: { id: "gemini" | "eleven"; label: string; link: string; linkText: string; placeholder: string; descKey: string }[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    link: "https://aistudio.google.com/app/apikey",
    linkText: "aistudio.google.com/app/apikey",
    placeholder: "AIza… / AQ… (Gemini)",
    descKey: "key.voice.gemini.desc",
  },
  {
    id: "eleven",
    label: "ElevenLabs",
    link: "https://elevenlabs.io/app/settings/api-keys",
    linkText: "elevenlabs.io",
    placeholder: "sk_… (ElevenLabs)",
    descKey: "key.voice.eleven.desc",
  },
];

// "API anahtarınızı {0} adresinden alabilirsiniz." kalıbını linkle doldur.
function LinkedLine({ template, href, linkText }: { template: string; href: string; linkText: string }) {
  const [pre, post] = template.split("{0}");
  return (
    <p>
      {pre}
      <a href={href} target="_blank" rel="noreferrer">
        {linkText}
      </a>
      {post}
    </p>
  );
}

export function ApiKeyModal({
  open,
  reason,
  currentKey,
  currentProvider,
  onSave,
  onClear,
  onClose,
  currentElevenKey,
  onSaveEleven,
  onClearEleven,
  currentVoiceEngine,
  initialTab,
}: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<"llm" | "voice">(initialTab ?? "llm");
  const [value, setValue] = useState(currentKey ?? "");
  const [provider, setProvider] = useState<ProviderKind>(currentProvider ?? "deepseek");
  const [engine, setEngine] = useState<"gemini" | "eleven">(currentVoiceEngine ?? "gemini");
  const [elevenVal, setElevenVal] = useState(currentElevenKey ?? "");

  // Her açılışta istenen sekmeyle başla (panel ⚙️ → seslendirme).
  useEffect(() => {
    if (open) setTab(initialTab ?? "llm");
  }, [open, initialTab]);

  if (!open) return null;

  const sel = PROVIDERS.find((p) => p.id === provider)!;
  const eng = VOICE_ENGINES.find((e) => e.id === engine)!;
  const showVoice = tab === "voice" && !!onSaveEleven;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("key.title")}</h2>
        {reason && <p className="modal__reason">{reason}</p>}

        {onSaveEleven && (
          <div className="modal__tabs modal__tabs--top">
            <button
              className={`btn btn--sm ${tab === "llm" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setTab("llm")}
            >
              {t("key.tab.llm")}
            </button>
            <button
              className={`btn btn--sm ${tab === "voice" ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setTab("voice")}
            >
              {t("key.tab.voice")}
            </button>
          </div>
        )}

        {!showVoice && (
          <>
            <p className="modal__desc">{t("key.desc")}</p>

            <div className="modal__tabs">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={`btn btn--sm ${provider === p.id ? "btn--primary" : "btn--ghost"}`}
                  onClick={() => setProvider(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="modal__prov">
              {sel.noteKey && <p>{t(sel.noteKey)}</p>}
              <LinkedLine template={t("key.prov.get")} href={sel.link} linkText={sel.linkText} />
            </div>

            <input
              type="password"
              placeholder={sel.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <div className="modal__actions">
              {currentKey && (
                <button className="btn btn--ghost" onClick={onClear}>
                  {t("key.delete")}
                </button>
              )}
              <button className="btn btn--ghost" onClick={onClose}>
                {t("key.close")}
              </button>
              <button
                className="btn btn--primary"
                disabled={!value.trim()}
                onClick={() => onSave(value.trim(), provider)}
              >
                {t("key.save")}
              </button>
            </div>

            <PremiumWaitlist source="settings-llm" />
          </>
        )}

        {showVoice && (
          <>
            <p className="modal__desc">{t("key.voice.desc")}</p>

            <div className="modal__tabs">
              {VOICE_ENGINES.map((e) => (
                <button
                  key={e.id}
                  className={`btn btn--sm ${engine === e.id ? "btn--primary" : "btn--ghost"}`}
                  onClick={() => setEngine(e.id)}
                >
                  {e.label}
                </button>
              ))}
            </div>

            <div className="modal__prov">
              <p>{t(eng.descKey)}</p>
              <LinkedLine template={t("key.prov.get")} href={eng.link} linkText={eng.linkText} />
            </div>

            <input
              type="password"
              placeholder={eng.placeholder}
              value={elevenVal}
              onChange={(e) => setElevenVal(e.target.value)}
              autoFocus
            />
            <div className="modal__actions">
              {currentElevenKey && onClearEleven && (
                <button className="btn btn--ghost" onClick={() => { setElevenVal(""); onClearEleven(); }}>
                  {t("key.eleven.delete")}
                </button>
              )}
              <button className="btn btn--ghost" onClick={onClose}>
                {t("key.close")}
              </button>
              <button
                className="btn btn--primary"
                disabled={!elevenVal.trim()}
                onClick={() => onSaveEleven!(elevenVal.trim())}
              >
                {t("key.eleven.save")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
