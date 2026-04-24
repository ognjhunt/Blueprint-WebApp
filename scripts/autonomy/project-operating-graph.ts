import { runOperatingGraphProjectionLoop } from "../../server/utils/operatingGraphEvidenceProjectors";

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim();
  }
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1]?.trim() || "";
  }
  return "";
}

async function main() {
  const result = await runOperatingGraphProjectionLoop({
    city: argValue("--city") || undefined,
    limit: Number(argValue("--limit") || 500),
  });

  console.log(
    JSON.stringify(
      {
        ok: result.failedCount === 0,
        ...result,
      },
      null,
      2,
    ),
  );

  if (result.failedCount > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
