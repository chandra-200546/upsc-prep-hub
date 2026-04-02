import dotenv from "dotenv";

dotenv.config();

const required = (name: string, fallback = "") => {
  const value = process.env[name] ?? fallback;
  return value.trim();
};

export const config = {
  port: Number(required("PORT", "8787")),
  nodeEnv: required("NODE_ENV", "development"),
  geminiApiKey: required("GEMINI_API_KEY"),
  neonDatabaseUrl: required("NEON_DATABASE_URL"),
  sqlitePath: required("SQLITE_PATH", "./backend/data/app.db"),
  allowedOrigin: required("ALLOWED_ORIGIN", "*"),
};

export const hasGemini = Boolean(config.geminiApiKey);
export const hasNeon = Boolean(config.neonDatabaseUrl);
