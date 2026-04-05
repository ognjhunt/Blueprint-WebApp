import { syncGrowthStudioToNotion } from "../server/utils/notion-sync";

async function main() {
  const limitIndex = process.argv.indexOf("--limit");
  const limitValue = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : 50;
  const refreshIntegrationSnapshot = !process.argv.includes("--skip-refresh-integrations");

  const result = await syncGrowthStudioToNotion({
    limit: Number.isFinite(limitValue) ? limitValue : 50,
    refreshIntegrationSnapshot,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (result.failedCount > 0) {
    process.exitCode = 1;
  }
}

void main();
