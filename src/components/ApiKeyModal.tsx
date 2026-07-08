import { useState } from "react";
import type { ProviderKind } from "../lib/store";

interface Props {
  open: boolean;
  reason?: string;
  currentKey: string | null;
  currentProvider?: ProviderKind;
  onSave: (key: string, provider: ProviderKind) => void;
  onClear: () => void;
  onClose: () => void;
}

const PROVIDERS: { id: ProviderKind; label: string; prefix: string; desc: string; link: string; linkText: string; placeholder: string }[] = [
  {
    id: "groq",
    label: "Groq (ücretsiz)",
    prefix: "gsk_",
    desc: "Groq'tan ÜCRETSİZ API anahtarı alabilirsiniz — kredi kartı gerekmez.",
    link: "https://console.groq.com/keys",
    linkText: "console.groq.com",
    placeholder: "gsk_... (Groq)",
  },
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
];

export function ApiKeyModal({ open, reason, currentKey, currentProvider, onSave, onClear, onClose }: Props) {
  const [value, setValue] = useState(currentKey ?? "");
  const [provider, setProvider] = useState<ProviderKind>(currentProvider ?? "groq");

  if (!open) return null;

  const sel = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>API Anahtarı</h2>
        {reason && <p className="modal__reason">{reason}</p>}
        <p className="modal__desc">
          Kendi API anahtarınızı girerek sınırsız oturum açabilirsiniz. Anahtar yalnızca
          bu tarayıcıda saklanır, hiçbir sunucuda tutulmaz.
        </p>

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
              Anahtarı sil
            </button>
          )}
          <button className="btn btn--ghost" onClick={onClose}>
            Kapat
          </button>
          <button
            className="btn btn--primary"
            disabled={!value.trim()}
            onClick={() => onSave(value.trim(), provider)}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
