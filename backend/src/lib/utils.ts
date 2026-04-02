import crypto from "node:crypto";

export const hashPayload = (fn: string, payload: unknown) => {
  const raw = `${fn}:${JSON.stringify(payload ?? null)}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
};

export const safeJsonParse = <T = unknown>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
