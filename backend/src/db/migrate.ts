import { ensureNeonSchema } from "./neon.js";

const run = async () => {
  const ok = await ensureNeonSchema();
  if (!ok) {
    console.log("Skipping migration: NEON_DATABASE_URL not set.");
    return;
  }
  console.log("Neon migration completed: ai_cache_entries, ai_function_logs");
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
