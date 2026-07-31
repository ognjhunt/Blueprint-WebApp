/**
 * Fail-closed verifier for cross-repo shared doctrine blocks.
 *
 * Byte-for-byte twin of `scripts/verify_shared_doctrine.py` in
 * BlueprintCapturePipeline. Both read the same `contracts/shared-doctrine.lock.json`
 * and must agree on every digest.
 *
 * Unlike `scripts/pipeline/verify-*-contract.ts`, this does NOT compare against a
 * sibling checkout. Sibling comparison passes trivially in CI because siblings are
 * not checked out there, which is how the shared blocks diverged on 2026-07-29
 * without any gate firing. Digests are committed instead, so the check is
 * offline, deterministic, and identical on a laptop and in CI.
 *
 * Extraction rule, kept identical to the Python implementation:
 *   - locate the single line containing `<!-- <BLOCK>_START -->`
 *   - locate the single line containing `<!-- <BLOCK>_END -->`
 *   - take the lines strictly between them, join with LF, append one LF
 *   - hash the UTF-8 bytes with SHA-256
 *
 * Exits non-zero unless every tracked block matches.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const REPO_NAME = "Blueprint-WebApp";
export const LOCK_RELATIVE_PATH = "contracts/shared-doctrine.lock.json";
export const LOCK_SCHEMA_VERSION = "blueprint.shared_doctrine_lock.v1";
const STATUS_LOCKED = "locked";
const STATUS_UNRECONCILED = "unreconciled";

export class DoctrineVerificationError extends Error {}

type BlockEntry = {
  file: string;
  canonical_sha256: string | null;
  observed_sha256: Record<string, string | null>;
};

type DoctrineLock = {
  schema_version: string;
  status: string;
  blocks: Record<string, BlockEntry>;
  repos: string[];
};

export type BlockResult = {
  block: string;
  file: string;
  expected_sha256: string;
  actual_sha256: string;
  matched: boolean;
};

export function extractBlock(text: string, block: string): string {
  const startMarker = `<!-- ${block}_START -->`;
  const endMarker = `<!-- ${block}_END -->`;
  const lines = text.split("\n");

  const startHits: number[] = [];
  const endHits: number[] = [];
  lines.forEach((line, index) => {
    if (line.includes(startMarker)) startHits.push(index);
    if (line.includes(endMarker)) endHits.push(index);
  });

  if (startHits.length !== 1) {
    throw new DoctrineVerificationError(
      `${block}: expected exactly one ${startMarker}, found ${startHits.length}`,
    );
  }
  if (endHits.length !== 1) {
    throw new DoctrineVerificationError(
      `${block}: expected exactly one ${endMarker}, found ${endHits.length}`,
    );
  }
  if (endHits[0] <= startHits[0]) {
    throw new DoctrineVerificationError(`${block}: end marker precedes start marker`);
  }

  return `${lines.slice(startHits[0] + 1, endHits[0]).join("\n")}\n`;
}

export function digestBlock(body: string): string {
  return createHash("sha256").update(Buffer.from(body, "utf-8")).digest("hex");
}

export function loadLock(root: string): DoctrineLock {
  const lockPath = path.resolve(root, LOCK_RELATIVE_PATH);
  if (!fs.existsSync(lockPath)) {
    throw new DoctrineVerificationError(`missing lock file: ${LOCK_RELATIVE_PATH}`);
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8")) as DoctrineLock;
  if (lock.schema_version !== LOCK_SCHEMA_VERSION) {
    throw new DoctrineVerificationError(
      `unsupported lock schema_version: ${JSON.stringify(lock.schema_version)}`,
    );
  }
  if (lock.status !== STATUS_LOCKED && lock.status !== STATUS_UNRECONCILED) {
    throw new DoctrineVerificationError(`unsupported lock status: ${JSON.stringify(lock.status)}`);
  }
  return lock;
}

function expectedDigest(blockName: string, entry: BlockEntry, status: string): string {
  if (status === STATUS_LOCKED) {
    if (!entry.canonical_sha256) {
      throw new DoctrineVerificationError(
        `${blockName}: lock status is ${STATUS_LOCKED} but canonical_sha256 is absent`,
      );
    }
    return entry.canonical_sha256;
  }
  const observed = entry.observed_sha256 ?? {};
  const baseline = observed[REPO_NAME];
  if (!baseline) {
    throw new DoctrineVerificationError(
      `${blockName}: no baseline recorded for ${REPO_NAME}; ` +
        "measure this repo's block and add it to the lock before merging",
    );
  }
  return baseline;
}

export function verify(root: string): BlockResult[] {
  const lock = loadLock(root);
  const blockNames = Object.keys(lock.blocks ?? {}).sort();
  if (blockNames.length === 0) {
    throw new DoctrineVerificationError("lock declares no blocks");
  }

  const results: BlockResult[] = [];
  const failures: string[] = [];

  for (const blockName of blockNames) {
    const entry = lock.blocks[blockName];
    const source = path.resolve(root, entry.file);
    if (!fs.existsSync(source)) {
      failures.push(`${blockName}: missing source file ${entry.file}`);
      continue;
    }
    let actual: string;
    let wanted: string;
    try {
      actual = digestBlock(extractBlock(fs.readFileSync(source, "utf-8"), blockName));
      wanted = expectedDigest(blockName, entry, lock.status);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    const matched = actual === wanted;
    if (!matched) {
      failures.push(
        `${blockName}: ${entry.file} does not match the lock ` +
          `(expected ${wanted}, found ${actual})`,
      );
    }
    results.push({
      block: blockName,
      file: entry.file,
      expected_sha256: wanted,
      actual_sha256: actual,
      matched,
    });
  }

  if (failures.length > 0) {
    throw new DoctrineVerificationError(failures.join("; "));
  }
  return results;
}

function main(): number {
  const root = process.cwd();
  let results: BlockResult[];
  try {
    results = verify(root);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`shared doctrine verification FAILED: ${message}\n`);
    return 1;
  }

  for (const row of results) {
    process.stdout.write(`ok  ${row.block}  ${row.file}  ${row.actual_sha256}\n`);
  }
  if (loadLock(root).status === STATUS_UNRECONCILED) {
    process.stderr.write(
      "\nNOTE: lock status is 'unreconciled'. Blocks are frozen at their current " +
        "per-repo baselines so no new variants can appear, but the repos do not yet " +
        "agree. See BlueprintCapturePipeline " +
        "docs/doctrine-shared-block-divergence-2026-07-31.md.\n",
    );
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  process.exit(main());
}
