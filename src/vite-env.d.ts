/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mobil (Capacitor) derlemede mutlak API adresi; web'de boş (göreli). */
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
