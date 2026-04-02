import fs from "node:fs";
import path from "node:path";
import { ensureNeonSchema } from "../db/neon.js";
import { parseProfilesCsv, upsertProfiles } from "../db/profiles.js";

const run = async () => {
  const fileArg = process.argv[2];
  const defaultPath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "profiles-export-2026-04-02_20-53-38.csv",
  );
  const csvPath = path.resolve(fileArg ?? defaultPath);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const schemaReady = await ensureNeonSchema();
  if (!schemaReady) {
    throw new Error("NEON_DATABASE_URL/PG env is not configured.");
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const profiles = parseProfilesCsv(raw);
  if (!profiles.length) {
    throw new Error("No valid profiles found in CSV.");
  }

  const result = await upsertProfiles(profiles);
  console.log(
    JSON.stringify(
      {
        ok: true,
        csvPath,
        parsed: profiles.length,
        inserted: result.inserted,
      },
      null,
      2,
    ),
  );
};

run().catch((err) => {
  console.error("Profile import failed:", err?.message || err);
  process.exit(1);
});
