// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger";
import { logDailyResearchInstalledRuntime, verifyDailyResearchInstalledRuntime } from "../utils/dailyResearchInstalledRuntime";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const source = "a".repeat(40), render = "b".repeat(40), name = "tools/daily_research/tiny.py", body = "# synthetic installed file\n";
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

function fixture(change: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "installed-research-proof-")); roots.push(root);
  const releaseRoot = join(root, "release"), vendorRoot = join(root, "vendor"), file = join(releaseRoot, name);
  mkdirSync(dirname(file), { recursive: true }); mkdirSync(vendorRoot);
  const manifest = { schema_version: "blueprint.research-standalone.v1", source_commit: source,
    activation_performed: false, example_enabled: false, files: { [name]: hash(body) }, ...change };
  const raw = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(join(releaseRoot, "manifest.json"), raw); writeFileSync(file, body);
  // Python's standard USTAR writer supplies an independent tiny archive fixture.
  const built = spawnSync("python3", ["-c", "import io,json,sys,tarfile\nv=json.load(sys.stdin)\nb=io.BytesIO()\nwith tarfile.open(fileobj=b,mode='w',format=tarfile.USTAR_FORMAT) as t:\n for n,s in [('manifest.json',v['manifest']),(v['name'],v['body'])]:\n  raw=s.encode(); i=tarfile.TarInfo(n); i.size=len(raw); i.mode=0o644; t.addfile(i,io.BytesIO(raw))\nsys.stdout.buffer.write(b.getvalue())"],
    { input: JSON.stringify({ manifest: raw, name, body }) });
  if (built.status !== 0) throw new Error("synthetic_archive_fixture_failed");
  const archive = join(vendorRoot, "blueprint-research.tar"), receiptPath = join(vendorRoot, "receipt.json");
  writeFileSync(archive, built.stdout);
  const receipt = { source_commit: source, archive: "blueprint-research.tar", bytes: built.stdout.length, sha256: hash(built.stdout) };
  writeFileSync(receiptPath, JSON.stringify(receipt));
  return { root, releaseRoot, vendorRoot, file, archive, receiptPath, receipt, raw };
}
const environment = { RENDER_GIT_COMMIT: render, BLUEPRINT_COMMUNICATIONS_SEND_ENABLED: "false",
  BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED: "false", BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED: "false" };

describe("installed daily research runtime proof (synthetic, read only)", () => {
  it("hashes the actual archive, manifest and every regular installed file", () => {
    const f = fixture(), proof = verifyDailyResearchInstalledRuntime(f, environment);
    expect(proof).toEqual({ schema_version: "blueprint.daily-research-installed-runtime.v1", code: "research_installed_runtime_verified",
      source_commit: source, render_git_commit: render, archive_sha256: hash(readFileSync(f.archive)), manifest_sha256: hash(f.raw),
      files_map_sha256: hash(JSON.stringify({ [name]: hash(readFileSync(f.file)) })), file_count: 1, files_verified: true,
      flags: { send_enabled: false, automatic_first_contact_enabled: false, hypothesis_drafts_enabled: false } });
  });
  it("refuses changed installed bytes rather than copying the manifest's expected hash", () => {
    const f = fixture(); writeFileSync(f.file, "# changed synthetic bytes\n");
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_file_digest_mismatch", files_verified: false, files_map_sha256: null });
  });
  it.each(["file", "directory"])("refuses a %s symlink even when its target has the expected bytes", kind => {
    const f = fixture();
    if (kind === "file") { renameSync(f.file, join(f.root, "original.py")); symlinkSync(join(f.root, "original.py"), f.file); }
    else { renameSync(dirname(f.file), join(f.root, "original-dir")); symlinkSync(join(f.root, "original-dir"), dirname(f.file)); }
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_non_regular_file", files_verified: false });
  });
  it("binds installed manifest bytes to the archive even when changed files match that changed manifest", () => {
    const f = fixture(), changed = "# modified installed bytes\n";
    const manifest = JSON.parse(f.raw); manifest.files[name] = hash(changed);
    writeFileSync(join(f.releaseRoot, "manifest.json"), JSON.stringify(manifest)); writeFileSync(f.file, changed);
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_manifest_archive_mismatch", files_verified: false });
  });
  it.each([{ schema_version: "foreign" }, { activation_performed: true }, { example_enabled: true }, { files: {} }])("refuses invalid manifest metadata %j", change => {
    const f = fixture(change);
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_manifest_invalid", files_verified: false });
  });
  it("refuses a source commit mismatch with the current vendor receipt", () => {
    const f = fixture(); writeFileSync(f.receiptPath, JSON.stringify({ ...f.receipt, source_commit: "c".repeat(40) }));
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_source_mismatch", source_commit: source, files_verified: false });
  });
  it("reports the actual changed archive hash and refuses it", () => {
    const f = fixture(); writeFileSync(f.archive, "changed synthetic archive");
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_archive_digest_mismatch",
      archive_sha256: hash("changed synthetic archive"), files_verified: false });
  });
  it("refuses paths outside the installed research subtree", () => {
    const f = fixture({ files: { "tools/daily_research/../outside.py": hash(body) } });
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_file_path_invalid", files_verified: false });
  });
  it("refuses an own __proto__ manifest key rather than silently dropping every file", () => {
    const files = JSON.parse(`{"__proto__":"${"0".repeat(64)}"}`);
    expect(Object.keys(files)).toEqual(["__proto__"]);
    const f = fixture({ files });
    expect(verifyDailyResearchInstalledRuntime(f, environment)).toMatchObject({ code: "research_runtime_file_path_invalid", files_verified: false, file_count: 0 });
  });
  it("reads only the commit and three flag fields and emits only the fixed aggregate schema", () => {
    const f = fixture(), fields: string[] = [], allowed = { ...environment, BLUEPRINT_COMMUNICATIONS_SEND_ENABLED: "true",
      BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED: "TRUE", BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED: "1" };
    const env = new Proxy(allowed, { get(target, key) {
      if (typeof key !== "string" || !(key in target)) throw new Error("unexpected_environment_read");
      fields.push(key); return target[key as keyof typeof target];
    } });
    const proof = verifyDailyResearchInstalledRuntime(f, env);
    expect([...new Set(fields)].sort()).toEqual(Object.keys(environment).sort());
    expect(Object.keys(proof).sort()).toEqual(["schema_version", "code", "source_commit", "render_git_commit", "archive_sha256", "manifest_sha256", "files_map_sha256", "file_count", "files_verified", "flags"].sort());
    expect(proof.flags).toEqual({ send_enabled: true, automatic_first_contact_enabled: false, hypothesis_drafts_enabled: false });
    expect(proof.files_verified).toBe(true);
  });
  it("does not echo an invalid deployment commit", () => {
    const f = fixture();
    expect(verifyDailyResearchInstalledRuntime(f, { ...environment, RENDER_GIT_COMMIT: "unexpected private metadata" }).render_git_commit).toBeNull();
  });
  it("logs only the aggregate success receipt", () => {
    const f = fixture(), info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    expect(logDailyResearchInstalledRuntime(f, environment)).toBeUndefined();
    expect(info).toHaveBeenCalledExactlyOnceWith(verifyDailyResearchInstalledRuntime(f, environment), "Research installed runtime verification");
    expect(warn).not.toHaveBeenCalled();
  });
  it("returns normally and logs only the stable failure receipt without raw file data", () => {
    const f = fixture(), changed = "SYNTHETIC_RAW_SHOULD_NOT_BE_LOGGED"; writeFileSync(f.file, changed);
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    expect(logDailyResearchInstalledRuntime(f, environment)).toBeUndefined();
    expect(warn).toHaveBeenCalledExactlyOnceWith(verifyDailyResearchInstalledRuntime(f, environment), "Research installed runtime verification");
    expect(JSON.stringify(warn.mock.calls)).not.toContain(changed); expect(info).not.toHaveBeenCalled();
  });
});
