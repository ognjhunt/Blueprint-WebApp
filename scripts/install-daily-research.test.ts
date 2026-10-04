// @vitest-environment node
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("pinned daily research package", () => {
  it("extracts and imports the actual release without Pipeline application dependencies", () => {
    mkdirSync("output", { recursive: true });
    const target = mkdtempSync(resolve("output/research-package-test-"));
    try {
      const result = spawnSync("python3", ["scripts/install-daily-research.py", "--verify-only", "--target", target], { encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      const receipt = JSON.parse(readFileSync("vendor/daily-research/receipt.json", "utf8"));
      expect(JSON.parse(result.stdout).source_commit).toBe(receipt.source_commit);
      const proof = spawnSync("python3", ["-I", "-S", "-c",
        "import sys; sys.path.insert(0, sys.argv[1]); from tools.daily_research import runner, render, firestore, capabilities, consumer, history, publication, verification, expansion, exa_transport; assert publication.PROFILE == 'agent-owned-v1'; assert verification.VERSION == 'blueprint.lead-verification.v1'; assert len(capabilities.inline_files()) == 4; assert not any(m.startswith(('blueprint_pipeline', 'torch', 'openai')) for m in sys.modules)",
        join(target, "release")], { encoding: "utf8" });
      expect(proof.status, proof.stderr).toBe(0);
      const node = spawnSync("node", ["--input-type=module", "-e",
        "const {Store} = await import(process.argv[2]); const {Publisher, requirePublicationVerification} = await import(new URL('./publisher.mjs', 'file://' + process.argv[2])); for (const method of ['publicationAgentTool', 'recoverTerminalSheets', 'publishNotionBatch']) if (typeof Store.prototype[method] !== 'function') throw Error('controlled_store_contract_missing'); for (const method of ['writeNotionStep', 'notionProgress']) if (typeof Publisher.prototype[method] !== 'function') throw Error('controlled_publisher_contract_missing'); if (typeof requirePublicationVerification !== 'function') throw Error('verification_gate_missing'); await import('firebase-admin/app'); await import('google-auth-library')",
        "research-package-proof", join(target, "release/tools/daily_research/firestore_bridge.mjs")], { encoding: "utf8" });
      expect(node.status, node.stderr).toBe(0);
    } finally { rmSync(target, { recursive: true, force: true }); }
  });

  it("refuses a changed archive before installing or extracting", () => {
    mkdirSync("output", { recursive: true });
    const source = mkdtempSync(resolve("output/research-corrupt-test-"));
    try {
      copyFileSync("vendor/daily-research/receipt.json", join(source, "receipt.json"));
      writeFileSync(join(source, "blueprint-research.tar"), "changed archive bytes");
      const result = spawnSync("python3", ["scripts/install-daily-research.py", "--verify-only", "--source", source,
        "--target", join(source, "extracted")], { encoding: "utf8" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("research_release_digest_mismatch");
    } finally { rmSync(source, { recursive: true, force: true }); }
  });
});
