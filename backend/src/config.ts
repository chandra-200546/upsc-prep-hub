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

export const config = {
  port: Number(required("PORT", "8787")),
  nodeEnv: required("NODE_ENV", "development"),
  geminiApiKey: required("GEMINI_API_KEY"),
  neonDatabaseUrl: required("NEON_DATABASE_URL"),
  sqlitePath: required("SQLITE_PATH", "./data/app.db"),
  allowedOrigin: required("ALLOWED_ORIGIN", "*"),
};

export const hasGemini = Boolean(config.geminiApiKey);
export const hasNeon = Boolean(config.neonDatabaseUrl);
