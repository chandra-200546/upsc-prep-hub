import { ensureNeonSchema } from "../db/neon.js";

const run = async () => {
  await ensureNeonSchema();
  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "Backend now runs fully on local SQLite. Neon migration script is deprecated.",
      },
      null,
      2,
    ),
  );
};

run().catch((err) => {
  console.error("Local DB bootstrap failed:", err?.message || err);
  process.exit(1);
});
