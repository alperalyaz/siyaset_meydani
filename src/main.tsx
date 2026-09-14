import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import { I18nProvider } from "./components/I18nProvider";
import "./styles.css";

// Ziyaretçi ölçümü SADECE web'de. Mobil (Capacitor) derlemede sayfa telefondan
// paketli servis edilir, /_vercel/insights yolu yoktur — VITE_API_BASE yalnızca
// o derlemede set edilir (bkz. package.json "build:mobile").
const isWeb = !import.meta.env.VITE_API_BASE;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
    {isWeb && <Analytics />}
  </React.StrictMode>,
);
