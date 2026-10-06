import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { logger } from "../logger";

const SOURCE = /^[a-f0-9]{40}$/, DIGEST = /^[a-f0-9]{64}$/;
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type RuntimeCode = "research_installed_runtime_verified" | "research_runtime_file_unavailable"
  | "research_runtime_non_regular_file" | "research_runtime_receipt_invalid" | "research_runtime_archive_digest_mismatch"
  | "research_runtime_archive_manifest_invalid" | "research_runtime_manifest_invalid" | "research_runtime_manifest_archive_mismatch"
  | "research_runtime_source_mismatch" | "research_runtime_file_path_invalid" | "research_runtime_file_digest_mismatch";
class RuntimeFailure extends Error { constructor(readonly code: RuntimeCode) { super(code); } }
function fail(code: RuntimeCode): never { throw new RuntimeFailure(code); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }

function validatedReceipt(value: unknown): { source_commit: string; sha256: string; bytes: number } {
  if (!object(value)) throw new RuntimeFailure("research_runtime_receipt_invalid");
  const { archive, source_commit, sha256, bytes } = value;
  if (archive !== "blueprint-research.tar" || typeof source_commit !== "string" || !SOURCE.test(source_commit)
    || typeof sha256 !== "string" || !DIGEST.test(sha256) || typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new RuntimeFailure("research_runtime_receipt_invalid");
  }
  return { source_commit, sha256, bytes };
}

function validatedManifest(value: unknown): { source_commit: string; files: Record<string, string> } {
  if (!object(value)) throw new RuntimeFailure("research_runtime_manifest_invalid");
  const { schema_version, source_commit, activation_performed, example_enabled, files } = value;
  if (schema_version !== "blueprint.research-standalone.v1" || typeof source_commit !== "string" || !SOURCE.test(source_commit)
    || activation_performed !== false || example_enabled !== false || !object(files)
    || !Object.keys(files).length || Object.keys(files).length > 500) {
    throw new RuntimeFailure("research_runtime_manifest_invalid");
  }
  const checked: Record<string, string> = Object.create(null);
  for (const [name, digest] of Object.entries(files)) {
    if (!name.startsWith("tools/daily_research/") || name.includes("\\")
      || name.split("/").some(part => !part || part === "." || part === "..")
      || typeof digest !== "string" || !DIGEST.test(digest)) throw new RuntimeFailure("research_runtime_file_path_invalid");
    checked[name] = digest;
  }
  if (!Object.keys(checked).length) throw new RuntimeFailure("research_runtime_manifest_invalid");
  return { source_commit, files: checked };
}

/** Read files only; no installer, package import, provider, credential or control access. */
function regularBytes(filename: string, root: string, limit: number) {
  for (let parent = dirname(filename); parent === root || parent.startsWith(root + sep); parent = dirname(parent)) {
    const stat = lstatSync(parent);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail("research_runtime_non_regular_file");
    if (parent === root) break;
  }
  const stat = lstatSync(filename);
  if (stat.isSymbolicLink() || !stat.isFile()) fail("research_runtime_non_regular_file");
  const fd = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const current = fstatSync(fd);
    if (!current.isFile() || current.size > limit) fail("research_runtime_non_regular_file");
    return readFileSync(fd);
  } finally { closeSync(fd); }
}

/** standalone.build writes manifest.json first in a deterministic regular USTAR archive.
 * Binding its exact bytes prevents a changed installed manifest from blessing changed files. */
function archiveManifest(archive: Buffer) {
  if (archive.length < 1024) return fail("research_runtime_archive_manifest_invalid");
  const header = archive.subarray(0, 512), field = (start: number, end: number) => header.subarray(start, end).toString("ascii").split("\0", 1)[0].trim();
  const octal = (start: number, end: number) => {
    const value = field(start, end);
    return /^[0-7]+$/.test(value) ? parseInt(value, 8) : NaN;
  };
  const size = octal(124, 136), checksum = [...header].reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
  if (field(0, 100) !== "manifest.json" || field(345, 500) || field(156, 157) !== "0"
    || header.subarray(257, 263).toString("ascii") !== "ustar\0" || octal(148, 156) !== checksum
    || !Number.isSafeInteger(size) || size <= 0 || size > 1024 * 1024 || 512 + size > archive.length) {
    fail("research_runtime_archive_manifest_invalid");
  }
  return archive.subarray(512, 512 + size);
}

export type InstalledResearchRuntimeReceipt = {
  schema_version: "blueprint.daily-research-installed-runtime.v1";
  code: RuntimeCode;
  source_commit: string | null;
  render_git_commit: string | null;
  archive_sha256: string | null;
  manifest_sha256: string | null;
  files_map_sha256: string | null;
  file_count: number;
  files_verified: boolean;
  flags: { send_enabled: boolean; automatic_first_contact_enabled: boolean; hypothesis_drafts_enabled: boolean };
};

export function verifyDailyResearchInstalledRuntime(paths: { releaseRoot?: string; vendorRoot?: string } = {},
  environment: NodeJS.ProcessEnv = process.env): InstalledResearchRuntimeReceipt {
  const result: InstalledResearchRuntimeReceipt = {
    schema_version: "blueprint.daily-research-installed-runtime.v1", code: "research_runtime_file_unavailable",
    source_commit: null, render_git_commit: SOURCE.test(environment.RENDER_GIT_COMMIT ?? "") ? environment.RENDER_GIT_COMMIT! : null,
    archive_sha256: null, manifest_sha256: null, files_map_sha256: null, file_count: 0, files_verified: false,
    flags: { send_enabled: environment.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true",
      automatic_first_contact_enabled: environment.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED === "true",
      hypothesis_drafts_enabled: environment.BLUEPRINT_COMMUNICATIONS_HYPOTHESIS_DRAFTS_ENABLED === "true" },
  };
  try {
    const vendor = resolve(paths.vendorRoot ?? "vendor/daily-research"), release = resolve(paths.releaseRoot ?? "dist/daily-research/release");
    let parsedReceipt: unknown;
    try { parsedReceipt = JSON.parse(regularBytes(resolve(vendor, "receipt.json"), vendor, 65536).toString("utf8")); }
    catch (error) { if (error instanceof RuntimeFailure) throw error; fail("research_runtime_receipt_invalid"); }
    const receipt = validatedReceipt(parsedReceipt);
    const archive = regularBytes(resolve(vendor, "blueprint-research.tar"), vendor, 20 * 1024 * 1024);
    result.archive_sha256 = sha(archive);
    if (archive.length !== receipt.bytes || result.archive_sha256 !== receipt.sha256) fail("research_runtime_archive_digest_mismatch");
    const raw = regularBytes(resolve(release, "manifest.json"), release, 1024 * 1024);
    result.manifest_sha256 = sha(raw);
    if (!raw.equals(archiveManifest(archive))) fail("research_runtime_manifest_archive_mismatch");
    let parsedManifest: unknown;
    try { parsedManifest = JSON.parse(raw.toString("utf8")); } catch { fail("research_runtime_manifest_invalid"); }
    const manifest = validatedManifest(parsedManifest);
    result.source_commit = manifest.source_commit;
    if (manifest.source_commit !== receipt.source_commit) fail("research_runtime_source_mismatch");
    const actual: Record<string, string> = {};
    for (const name of Object.keys(manifest.files).sort()) {
      if (!name.startsWith("tools/daily_research/") || name.includes("\\") || name.split("/").some(part => !part || part === "." || part === "..")
        || !DIGEST.test(manifest.files[name])) fail("research_runtime_file_path_invalid");
      const path = resolve(release, name);
      if (!path.startsWith(release + sep)) fail("research_runtime_file_path_invalid");
      actual[name] = sha(regularBytes(path, release, 4 * 1024 * 1024)); result.file_count++;
      if (actual[name] !== manifest.files[name]) fail("research_runtime_file_digest_mismatch");
    }
    result.files_map_sha256 = sha(JSON.stringify(actual));
    result.files_verified = true; result.code = "research_installed_runtime_verified";
  } catch (error) {
    result.code = error instanceof RuntimeFailure ? error.code : "research_runtime_file_unavailable";
  }
  return result;
}

/** Observation only: failure adds no activation, interruption or new worker authority. */
export function logDailyResearchInstalledRuntime(paths: { releaseRoot?: string; vendorRoot?: string } = {},
  environment: NodeJS.ProcessEnv = process.env) {
  const receipt = verifyDailyResearchInstalledRuntime(paths, environment);
  if (receipt.files_verified) logger.info(receipt, "Research installed runtime verification");
  else logger.warn(receipt, "Research installed runtime verification");
}
