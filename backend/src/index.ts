import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import "./db/sqlite.js";
import { ensureNeonSchema, neonHealthCheck } from "./db/neon.js";
import { readFile } from "./lib/storage.js";
import { functionsRouter } from "./routes/functions.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.allowedOrigins.length === 1 ? config.allowedOrigins[0] : config.allowedOrigins,
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
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

app.get("/storage/:bucket/*", async (c) => {
  const bucket = c.req.param("bucket");
  const wildcard = c.req.path.split(`/storage/${bucket}/`)[1] || "";
  const file = readFile(bucket, wildcard);
  if (!file) return c.json({ error: "File not found" }, 404);
  return new Response(file, { status: 200 });
});

app.route("/functions/v1", functionsRouter);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => c.json({ error: err.message || "Internal error" }, 500));

const boot = async () => {
  try {
    await ensureNeonSchema();
    console.log("Neon schema ready");
  } catch (err) {
    console.error("Neon unavailable at boot, continuing with local fallback:", err);
  }
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
