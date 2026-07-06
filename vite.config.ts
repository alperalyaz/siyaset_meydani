import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import { handleChat, type ChatRequestBody } from "./api/lib/handler";

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
