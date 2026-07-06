import { useState } from "react";

interface Props {
  open: boolean;
  reason?: string;
  currentKey: string | null;
  onSave: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}

// BYOK: kullanıcı kendi DeepSeek anahtarını girer. Anahtar yalnızca
// tarayıcıda (localStorage) saklanır; isteklerde header ile taşınır.
export function ApiKeyModal({ open, reason, currentKey, onSave, onClear, onClose }: Props) {
  const [value, setValue] = useState(currentKey ?? "");
  if (!open) return null;

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>DeepSeek API Anahtarı</h2>
        {reason && <p className="modal__reason">{reason}</p>}
        <p className="modal__desc">
          Kendi anahtarınızı girerek sınırsız oturum açabilirsiniz. Anahtar yalnızca bu
          tarayıcıda saklanır, hiçbir sunucuda tutulmaz.{" "}
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">
            Anahtar al
          </a>
        </p>
        <input
          type="password"
          placeholder="sk-..."
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
            onClick={() => onSave(value.trim())}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
