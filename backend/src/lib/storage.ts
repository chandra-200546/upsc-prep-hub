import fs from "node:fs";
import path from "node:path";

const baseDir = path.resolve(process.cwd(), "uploads");

const cleanPart = (value: string) =>
  value
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..")
    .join("/");

const ensureDir = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
};

export const saveBase64File = (bucket: string, filePath: string, base64: string) => {
  const safeBucket = cleanPart(bucket || "default") || "default";
  const safePath = cleanPart(filePath || "");
  if (!safePath) throw new Error("Invalid storage path");

  const abs = path.join(baseDir, safeBucket, safePath);
  ensureDir(path.dirname(abs));
  const buffer = Buffer.from(base64, "base64");
  fs.writeFileSync(abs, buffer);

  return { bucket: safeBucket, path: safePath, abs };
};

export const deleteFile = (bucket: string, filePath: string) => {
  const safeBucket = cleanPart(bucket || "default") || "default";
  const safePath = cleanPart(filePath || "");
  if (!safePath) return false;
  const abs = path.join(baseDir, safeBucket, safePath);
  if (!fs.existsSync(abs)) return false;
  fs.unlinkSync(abs);
  return true;
};

export const readFile = (bucket: string, filePath: string) => {
  const safeBucket = cleanPart(bucket || "default") || "default";
  const safePath = cleanPart(filePath || "");
  if (!safePath) return null;
  const abs = path.join(baseDir, safeBucket, safePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
};

export const getStoragePublicPath = (bucket: string, filePath: string) => {
  const safeBucket = cleanPart(bucket || "default") || "default";
  const safePath = cleanPart(filePath || "");
  if (!safePath) return "";
  return `/storage/${safeBucket}/${safePath}`;
};
