import fs from "node:fs";
import path from "node:path";

let bootstrapped = false;

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

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

function loadEnvFile(filePath: string, options?: { overrideExisting?: boolean }) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (
      !options?.overrideExisting
      && typeof process.env[parsed.key] === "string"
      && process.env[parsed.key]?.length
    ) {
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

  if (isTruthy(process.env.BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP)) {
    return;
  }

  const cwd = process.cwd();
  const defaultCandidates = [
    process.env.BLUEPRINT_ENV_FILE,
    path.resolve(cwd, ".env"),
  ].filter((value): value is string => Boolean(value && value.trim()));
  const overridingCandidates = [
    process.env.PAPERCLIP_ENV_FILE,
    path.resolve(cwd, "../.paperclip-blueprint.env"),
    path.resolve(cwd, ".env.local"),
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const candidate of defaultCandidates) {
    loadEnvFile(candidate);
  }

  for (const candidate of overridingCandidates) {
    loadEnvFile(candidate, { overrideExisting: true });
  }
}

bootstrapLocalEnv();
