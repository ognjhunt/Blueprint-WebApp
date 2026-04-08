import fs from "node:fs";
import path from "node:path";

let bootstrapped = false;

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!key) return null;

  const rawValue = trimmed.slice(separatorIndex + 1);
  return {
    key,
    value: stripWrappingQuotes(rawValue).replace(/\\n/g, "\n"),
  };
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (typeof process.env[parsed.key] === "string" && process.env[parsed.key]?.length) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
  }
}

export function bootstrapLocalEnv() {
  if (bootstrapped) return;
  bootstrapped = true;

  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return;
  }

  const cwd = process.cwd();
  const candidates = [
    process.env.BLUEPRINT_ENV_FILE,
    process.env.PAPERCLIP_ENV_FILE,
    path.resolve(cwd, ".env"),
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "../.paperclip-blueprint.env"),
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const candidate of candidates) {
    loadEnvFile(candidate);
  }
}

bootstrapLocalEnv();
