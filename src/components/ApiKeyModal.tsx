import { useState } from "react";
import type { ProviderKind } from "../lib/store";
import { useT } from "../lib/i18n";

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
}

const PROVIDERS: { id: ProviderKind; label: string; prefix: string; desc: string; link: string; linkText: string; placeholder: string }[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    prefix: "sk-",
    desc: "DeepSeek API anahtarınızı platform.deepseek.com adresinden alabilirsiniz.",
    link: "https://platform.deepseek.com/api_keys",
    linkText: "platform.deepseek.com",
    placeholder: "sk-... (DeepSeek)",
  },
  {
    id: "openai",
    label: "OpenAI",
    prefix: "sk-proj-",
    desc: "OpenAI API anahtarınızı platform.openai.com adresinden alabilirsiniz.",
    link: "https://platform.openai.com/api-keys",
    linkText: "platform.openai.com",
    placeholder: "sk-proj-... (OpenAI)",
  },
  {
    id: "anthropic",
    label: "Claude",
    prefix: "sk-ant-",
    desc: "Anthropic API anahtarınızı console.anthropic.com adresinden alabilirsiniz.",
    link: "https://console.anthropic.com/settings/keys",
    linkText: "console.anthropic.com",
    placeholder: "sk-ant-... (Claude)",
  },
  {
    id: "groq",
    label: "Groq",
    prefix: "gsk_",
    desc: "Groq anahtarı da çalışır; ancak ücretsiz kotası çok hızlı dolar ve dolunca oturum hata verir. Kesintisiz deneyim için DeepSeek önerilir.",
    link: "https://console.groq.com/keys",
    linkText: "console.groq.com",
    placeholder: "gsk_... (Groq)",
  },
];

export function ApiKeyModal({ open, reason, currentKey, currentProvider, onSave, onClear, onClose, currentElevenKey, onSaveEleven, onClearEleven }: Props) {
  const { t } = useT();
  const [value, setValue] = useState(currentKey ?? "");
  const [provider, setProvider] = useState<ProviderKind>(currentProvider ?? "deepseek");
  const [elevenVal, setElevenVal] = useState(currentElevenKey ?? "");

  if (!open) return null;

  const sel = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("key.title")}</h2>
        {reason && <p className="modal__reason">{reason}</p>}
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
          <p>
            {sel.desc}{" "}
            <a href={sel.link} target="_blank" rel="noreferrer">
              {sel.linkText}
            </a>{" "}
            adresinden alabilirsiniz.
          </p>
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

        {onSaveEleven && (
          <div className="modal__eleven">
            <h3>{t("key.eleven.title")}</h3>
            <p className="modal__desc">
              {t("key.eleven.desc")}{" "}
              <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer">
                elevenlabs.io
              </a>{" "}
              → Developers → API Keys.
            </p>
            <input
              type="password"
              placeholder="AIza… (Gemini) · sk_… (ElevenLabs)"
              value={elevenVal}
              onChange={(e) => setElevenVal(e.target.value)}
            />
            <div className="modal__actions">
              {currentElevenKey && onClearEleven && (
                <button className="btn btn--ghost" onClick={() => { setElevenVal(""); onClearEleven(); }}>
                  {t("key.eleven.delete")}
                </button>
              )}
              <button
                className="btn btn--primary"
                disabled={!elevenVal.trim()}
                onClick={() => onSaveEleven(elevenVal.trim())}
              >
                {t("key.eleven.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
