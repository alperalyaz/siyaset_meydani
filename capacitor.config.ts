import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alperalyaz.siyasetmeydani",
  appName: "Siyaset Meydanı",
  webDir: "dist",
  // Uygulama telefonda paketli (dist) çalışır; API çağrıları VITE_API_BASE ile
  // Vercel'e gider (bkz. package.json "build:mobile").
};

export default config;
