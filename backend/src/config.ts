import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envCandidates = [
  process.env.BACKEND_ENV_PATH,
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env"),
  path.resolve(process.cwd(), "../.env"),
].filter(Boolean) as string[];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const required = (name: string, fallback = "") => {
  const value = process.env[name] ?? fallback;
  return value.trim();
};

const parseAllowedOrigins = (raw: string) => {
  if (!raw || raw === "*") return ["*"];
  const explicit = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const localhostDefaults = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
  return Array.from(new Set([...explicit, ...localhostDefaults]));
};

const buildNeonUrlFromPgEnv = () => {
  const user = required("PGUSER");
  const password = required("PGPASSWORD");
  const host = required("PGHOST");
  const database = required("PGDATABASE", "neondb");
  const port = required("PGPORT", "5432");
  const sslmode = required("PGSSLMODE", "require");
  const channelBinding = required("CHANNEL_BINDING", "require");

  if (!user || !password || !host) return "";

  const u = encodeURIComponent(user);
  const p = encodeURIComponent(password);
  return `postgresql://${u}:${p}@${host}:${port}/${database}?sslmode=${sslmode}&channel_binding=${channelBinding}`;
};

export const config = {
  port: Number(required("PORT", "8787")),
  nodeEnv: required("NODE_ENV", "development"),
  geminiApiKey:
    required("GEMINI_API_KEY") ||
    required("GOOGLE_GEMINI_API_KEY") ||
    required("GEMINI_KEY") ||
    required("VITE_GEMINI_API_KEY"),
  neonDatabaseUrl: required("NEON_DATABASE_URL") || buildNeonUrlFromPgEnv(),
  sqlitePath: required("SQLITE_PATH", "./data/app.db"),
  allowedOrigins: parseAllowedOrigins(required("ALLOWED_ORIGIN", "*")),
  googleClientId: required("GOOGLE_CLIENT_ID"),
  googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
};

export const hasGemini = Boolean(config.geminiApiKey);
export const hasNeon = Boolean(config.neonDatabaseUrl);
