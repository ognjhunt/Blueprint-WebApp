import { promises as fs } from "node:fs";
import path from "node:path";

import {
  buildKpiLiveSourceStatusReport,
  renderKpiLiveSourceStatusMarkdown,
  type KpiLiveSourceSnapshot,
} from "../../server/utils/kpiLiveSourceStatus";

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

async function readSnapshot(snapshotPath: string): Promise<KpiLiveSourceSnapshot> {
  const payload = await fs.readFile(snapshotPath, "utf8");
  return JSON.parse(payload) as KpiLiveSourceSnapshot;
}

async function main() {
  const repoRoot = process.cwd();
  const snapshotPath = path.resolve(
    repoRoot,
    argValue("--snapshot") || "server/tests/fixtures/kpi-live-source-snapshot.json",
  );
  const outDir = path.resolve(
    repoRoot,
    argValue("--out-dir") || "output/autonomous-org/kpi-source-status-latest",
  );
  const snapshot = await readSnapshot(snapshotPath);
  const report = buildKpiLiveSourceStatusReport(snapshot);
  const jsonPath = path.join(outDir, "kpi-source-status.json");
  const markdownPath = path.join(outDir, "kpi-source-status.md");

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, renderKpiLiveSourceStatusMarkdown(report), "utf8");

  console.log(JSON.stringify({
    ok: true,
    sourcedRows: report.summary.sourcedRows,
    sourceNeededRows: report.summary.sourceNeededRows,
    blockedLiveSources: report.blockedLiveSources,
    jsonPath,
    markdownPath,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
