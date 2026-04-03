import fs from "node:fs";
import path from "node:path";

const renderApiKey = (process.env.RENDER_API_KEY || "").trim();
const renderServiceId = (process.env.RENDER_SERVICE_ID || "").trim();

function usage() {
  console.error(
    [
      "Usage:",
      "  RENDER_API_KEY=... RENDER_SERVICE_ID=... node scripts/render/import-render-env.mjs [env-file] [--dry-run]",
      "",
      "Examples:",
      "  RENDER_API_KEY=... RENDER_SERVICE_ID=srv_xxx node scripts/render/import-render-env.mjs render.required.env.example --dry-run",
      "  RENDER_API_KEY=... RENDER_SERVICE_ID=srv_xxx node scripts/render/import-render-env.mjs render.required.env",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  let envFile = "render.required.env.example";
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (!arg.startsWith("-")) {
      envFile = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    envFile: path.resolve(process.cwd(), envFile),
    dryRun,
  };
}

function isRequiredManifest(filePath) {
  return path.basename(filePath) === "render.required.env.example";
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const envEntries = [];

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid env line ${index + 1}: ${line}`);
    }

    const key = line.slice(0, eqIndex).trim();
    const value = stripWrappingQuotes(line.slice(eqIndex + 1));

    if (!key) {
      throw new Error(`Missing env key on line ${index + 1}`);
    }

    envEntries.push({ key, value });
  }

  return envEntries;
}

function redactValue(value) {
  if (!value) {
    return "<EMPTY>";
  }
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

async function upsertEnvVar({ key, value, dryRun }) {
  const endpoint = `https://api.render.com/v1/services/${renderServiceId}/env-vars/${encodeURIComponent(key)}`;

  if (dryRun) {
    console.log(`[dry-run] ${key}=${redactValue(value)}`);
    return;
  }

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${renderApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Render API rejected ${key} with ${response.status}: ${body}`);
  }

  console.log(`updated ${key}`);
}

async function main() {
  const { envFile, dryRun } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(envFile)) {
    throw new Error(`Env file not found: ${envFile}`);
  }

  if (!dryRun) {
    if (!renderApiKey || !renderServiceId) {
      usage();
      throw new Error("RENDER_API_KEY and RENDER_SERVICE_ID are required unless --dry-run is used.");
    }
  }

  const envEntries = parseEnvFile(envFile);
  const failOnEmpty = isRequiredManifest(envFile);

  if (failOnEmpty) {
    const emptyKeys = envEntries
      .filter((entry) => entry.value.length === 0)
      .map((entry) => entry.key);

    if (emptyKeys.length > 0) {
      throw new Error(
        [
          `Required Render manifest contains empty values: ${emptyKeys.join(", ")}`,
          "Fill every required key before importing this file.",
          "If you only want to import the keys that are already set, move unfinished keys to render.optional.env.example first.",
        ].join("\n"),
      );
    }
  }

  console.log(`Loaded ${envEntries.length} env vars from ${envFile}`);

  for (const entry of envEntries) {
    await upsertEnvVar({ ...entry, dryRun });
  }

  if (dryRun) {
    console.log("Dry run complete.");
  } else {
    console.log("Render environment import complete.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
