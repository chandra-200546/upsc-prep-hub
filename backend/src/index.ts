import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import "./db/sqlite.js";
import { ensureNeonSchema, neonHealthCheck } from "./db/neon.js";
import { functionsRouter } from "./routes/functions.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.allowedOrigin === "*" ? "*" : config.allowedOrigin,
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "upsc-backend",
    mode: config.nodeEnv,
    routes: "/functions/v1/*",
  }),
);

app.get("/health/neon", async (c) => {
  const status = await neonHealthCheck();
  return c.json(status, status.connected ? 200 : 503);
});

app.route("/functions/v1", functionsRouter);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => c.json({ error: err.message || "Internal error" }, 500));

const boot = async () => {
  await ensureNeonSchema();
  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log(`Backend running on http://localhost:${info.port}`);
    },
  );
};

boot().catch((err) => {
  console.error("Failed to boot backend:", err);
  process.exit(1);
});
