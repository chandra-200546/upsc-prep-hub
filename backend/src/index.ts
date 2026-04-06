import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import "./db/sqlite.js";
import { ensureNeonSchema, neonHealthCheck } from "./db/neon.js";
import { readFile } from "./lib/storage.js";
import { functionsRouter } from "./routes/functions.js";
import { seedGeographyBooksIfMissing, seedHistoryBookIfMissing, seedPolityBookIfMissing } from "./rag/subject-rag.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
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
    database: "local-sqlite",
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
    console.log("Local SQLite schema ready");
    const seed = await seedHistoryBookIfMissing();
    if (seed.seeded) {
      const saved = "saved" in seed ? seed.saved : 0;
      console.log(`History book seeded in DB with ${saved} chunks`);
    } else {
      console.log(`History seed status: ${seed.reason || "skipped"}`);
    }

    const politySeed = await seedPolityBookIfMissing();
    if (politySeed.seeded) {
      const saved = "saved" in politySeed ? politySeed.saved : 0;
      console.log(`Polity book seeded in DB with ${saved} chunks`);
    } else {
      console.log(`Polity seed status: ${politySeed.reason || "skipped"}`);
    }

    const geographySeed = await seedGeographyBooksIfMissing();
    if (geographySeed.seeded) {
      const books = "ingestedBooks" in geographySeed ? geographySeed.ingestedBooks : 0;
      const chunks = "ingestedChunks" in geographySeed ? geographySeed.ingestedChunks : 0;
      console.log(`Geography books seeded: ${books} new books, ${chunks} chunks`);
    } else {
      console.log(`Geography seed status: ${geographySeed.reason || "skipped"}`);
    }
  } catch (err) {
    console.error("Local SQLite bootstrap failed.", err);
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
