import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import { handleChat, type ChatRequestBody } from "./api/_lib/handler";
import { handleContext } from "./api/_lib/context";
import { handleTts, type TtsRequestBody } from "./api/_lib/tts";

// Yerel geliştirmede /api/chat isteklerini Vercel serverless fonksiyonunun
// aynısı olan ortak handler'a bağlar. Böylece `npm run dev` tek başına yeter.
function devApi() {
  return {
    name: "dev-api-chat",
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use("/api/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Yalnızca POST." }));
          return;
        }
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body: ChatRequestBody;
        try {
          body = JSON.parse(raw);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Geçersiz JSON." }));
          return;
        }
        const userKey = req.headers["x-user-api-key"];
        const key = Array.isArray(userKey) ? userKey[0] : userKey;
        const fwd = req.headers["x-forwarded-for"];
        const ip =
          (typeof fwd === "string" ? fwd.split(",")[0] : req.socket?.remoteAddress) || "local";
        const result = await handleChat(body, key, ip);
        if (result.stream) {
          res.statusCode = result.status;
          if (result.headers) {
            Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
          }
          const reader = result.stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) { res.end(); break; }
              res.write(value);
            }
          } catch { res.end(); }
          return;
        }
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });

      server.middlewares.use("/api/tts", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Yalnızca POST." }));
          return;
        }
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body: TtsRequestBody;
        try {
          body = JSON.parse(raw);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Geçersiz JSON." }));
          return;
        }
        const ek = req.headers["x-eleven-key"];
        const key = Array.isArray(ek) ? ek[0] : ek;
        const fwd = req.headers["x-forwarded-for"];
        const ip =
          (typeof fwd === "string" ? fwd.split(",")[0] : req.socket?.remoteAddress) || "local";
        const result = await handleTts(body, key, ip);
        if (result.headers) {
          Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
        }
        if (result.audio) {
          res.statusCode = result.status;
          res.setHeader("Content-Type", result.contentType || "audio/mpeg");
          res.end(Buffer.from(result.audio));
          return;
        }
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });

      server.middlewares.use("/api/context", async (req, res) => {
        const u = new URL(req.url || "", "http://x");
        const result = await handleContext(
          u.searchParams.get("action") ?? undefined,
          u.searchParams.get("url") ?? undefined,
        );
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  server: { port: 5173 },
});
