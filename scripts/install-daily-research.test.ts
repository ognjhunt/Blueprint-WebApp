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
        "const {Store} = await import(process.argv[2]); const {Publisher, requirePublicationVerification} = await import(new URL('./publisher.mjs', 'file://' + process.argv[2])); for (const method of ['publicationAgentTool', 'recoverTerminalSheets', 'publishNotionBatch', 'screenSnapshot']) if (typeof Store.prototype[method] !== 'function') throw Error('controlled_store_contract_missing'); for (const method of ['writeNotionStep', 'notionProgress']) if (typeof Publisher.prototype[method] !== 'function') throw Error('controlled_publisher_contract_missing'); if (typeof requirePublicationVerification !== 'function') throw Error('verification_gate_missing'); await import('firebase-admin/app'); await import('google-auth-library')",
        "research-package-proof", join(target, "release/tools/daily_research/firestore_bridge.mjs")], { encoding: "utf8" });
      expect(node.status, node.stderr).toBe(0);
    } finally { rmSync(target, { recursive: true, force: true }); }
  });

  it("reads retained screen evidence through the Web consumer and installed package without external calls or writes", () => {
    mkdirSync("output", { recursive: true });
    const target = mkdtempSync(resolve("output/research-screen-reader-test-"));
    try {
      const install = spawnSync("python3", ["scripts/install-daily-research.py", "--verify-only", "--target", join(target, "dist/daily-research")], { encoding: "utf8" });
      expect(install.status, install.stderr).toBe(0);
      const proof = spawnSync("node", ["--import", "tsx", "--input-type=module", "-e", `
        import assert from 'node:assert/strict';
        import {readFileSync} from 'node:fs';
        import {createHash} from 'node:crypto';
        import {gzipSync} from 'node:zlib';
        import {pathToFileURL} from 'node:url';
        globalThis.fetch = () => { throw Error('external_call_forbidden'); };
        const {readScreenAdmissionSnapshot, screenAdmission} = await import(pathToFileURL(process.argv[1]).href);
        const expected = JSON.parse(readFileSync(process.argv[2], 'utf8')).snapshot;
        const root = 'blueprintDailyResearch/sites-first', records = new Map();
        function blob(raw, hash) {
          assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
          const compressed = gzipSync(raw), path = root + '/blobs/' + hash;
          records.set(path, {sha256: hash, codec: 'gzip', bytes: raw.length, chunks: 1, compressed_bytes: compressed.length});
          records.set(path + '/chunks/0', {bytes: compressed});
        }
        // The golden exposes the state projection, not its original stored blob bytes.
        // Materialize that synthetic state with its own exact content address.
        const stateBytes = Buffer.from(JSON.stringify(expected.state));
        expected.work_item.state_blob = createHash('sha256').update(stateBytes).digest('hex');
        blob(stateBytes, expected.work_item.state_blob);
        blob(Buffer.from(expected.bundle, 'base64'), expected.admission_id);
        const itemPath = root + '/screenWorkItems/' + expected.admission_id;
        const statePath = root + '/screenAdmissions/' + expected.admission_id;
        records.set(itemPath, expected.work_item);
        records.set(statePath, {state: 'acknowledged', blob: expected.work_item.state_blob});
        let writes = 0, reads = 0;
        const denyWrite = () => { writes++; throw Error('write_forbidden'); };
        const db = {runTransaction: denyWrite, doc: path => ({path, set: denyWrite, update: denyWrite, delete: denyWrite,
          get: async () => { reads++; return {exists: records.has(path), data: () => records.get(path)}; }})};
        const snapshot = await readScreenAdmissionSnapshot(db, expected.admission_id);
        assert.deepEqual(snapshot, expected);
        assert.equal(screenAdmission(snapshot).sites.size, 7);
        records.set(statePath, {state: 'planned', blob: expected.work_item.state_blob});
        await assert.rejects(readScreenAdmissionSnapshot(db, expected.admission_id), /screen_admission_snapshot_binding_invalid/);
        records.set(statePath, {state: 'acknowledged', blob: expected.work_item.state_blob});
        records.delete(itemPath);
        await assert.rejects(readScreenAdmissionSnapshot(db, expected.admission_id), /screen_admission_work_item_missing/);
        records.set(itemPath, expected.work_item);
        const bundlePath = root + '/blobs/' + expected.admission_id;
        records.get(bundlePath).bytes++;
        await assert.rejects(readScreenAdmissionSnapshot(db, expected.admission_id), /firestore_blob_digest_mismatch/);
        assert.equal(writes, 0); assert.ok(reads > 0);
      `, resolve("server/agents/communications-screen-research.ts"), resolve("server/tests/fixtures/screen-admission-snapshot.json")], { cwd: target, encoding: "utf8" });
      expect(proof.status, proof.stderr).toBe(0);
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
