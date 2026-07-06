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
        <h2>Kendi API Anahtarınız</h2>
        {reason && <p className="modal__reason">{reason}</p>}
        <p className="modal__desc">
          Kendi anahtarınızı girerek sınırsız oturum açabilirsiniz. Anahtar yalnızca bu
          tarayıcıda saklanır, hiçbir sunucuda tutulmaz. Groq mu DeepSeek mi kullandığınız
          anahtardan otomatik anlaşılır.
        </p>

        <div className="modal__providers">
          <div className="modal__prov modal__prov--free">
            <div className="modal__prov-head">
              <strong>Groq</strong>
              <span className="badge badge--free">ÜCRETSİZ</span>
            </div>
            <p>API'niz yok mu? Groq saniyeler içinde ücretsiz anahtar veriyor, kartsız.</p>
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              console.groq.com/keys →
            </a>
          </div>
          <div className="modal__prov">
            <div className="modal__prov-head">
              <strong>DeepSeek</strong>
              <span className="badge">ücretli</span>
            </div>
            <p>Zaten DeepSeek anahtarınız varsa onu da kullanabilirsiniz.</p>
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">
              platform.deepseek.com →
            </a>
          </div>
        </div>

        <input
          type="password"
          placeholder="gsk_... (Groq) veya sk-... (DeepSeek)"
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
