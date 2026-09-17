/**
 * A walkthrough that survives a dropped connection.
 *
 * ## Why the single POST was not enough
 *
 * The upload route takes the whole file in one request. That is fine on a desk
 * and wrong on the thing this product actually runs on: someone standing in a
 * warehouse on a phone, on site wifi, holding a recording they cannot make
 * again without walking back to the pallet. A connection that drops at 80% of
 * a 200MB upload loses all of it, and the second attempt is a second favour
 * asked of somebody who already did us one.
 *
 * So the recording arrives in parts, each one durable the moment it lands, and
 * a resumed upload sends only what is missing.
 *
 * ## Composed rather than appended
 *
 * Cloud Storage has no append. It has `combine`, which merges up to 32 objects
 * into one — so a long recording is composed in rounds: 32 parts into an
 * intermediate, intermediates into the next level, until one object remains.
 * That is why there is no part cap here and no maximum recording length beyond
 * the byte limit the route already enforces.
 *
 * The rounds are the only real complexity in this module and they exist for a
 * reason worth stating: capping parts at 32 would have meant chunk sizes that
 * grow with the recording, and a 64MB chunk is exactly the thing a phone
 * connection cannot get through — which is the problem we came here to solve.
 *
 * ## Parts are not the capture
 *
 * Nothing downstream may read a part. The privacy screen, the manifest and the
 * completion marker all act on the composed object, because a part is a
 * fragment of a video nobody has looked at yet and the whole point of Tier 3's
 * split is that we do not derive from footage before the privacy question is
 * answered. Parts are cleaned up after composition succeeds.
 */

import { logger } from "../logger";

/** Cloud Storage's own limit on sources per compose call. */
const COMPOSE_FANOUT = 32;

export interface PartsBucket {
  file(path: string): {
    save(data: Buffer, options?: unknown): Promise<unknown>;
    exists(): Promise<[boolean]>;
    delete(options?: unknown): Promise<unknown>;
    getMetadata(): Promise<[{ size?: string | number }]>;
  };
  getFiles(options: { prefix: string }): Promise<[Array<{ name: string }>]>;
  combine(sources: string[], destination: string): Promise<unknown>;
}

export function partsPrefix(rawPrefix: string): string {
  return `${rawPrefix}/parts`;
}

export function partPath(rawPrefix: string, index: number): string {
  // Zero-padded so lexical order is numeric order. Composition depends on the
  // sequence being right, and "part-10" sorting before "part-2" would splice
  // somebody's walkthrough into nonsense that still plays.
  return `${partsPrefix(rawPrefix)}/part-${String(index).padStart(6, "0")}`;
}

/** Which part indices are already stored, so a resume sends only the rest. */
export async function storedPartIndices(
  bucket: PartsBucket,
  rawPrefix: string,
): Promise<number[]> {
  const [files] = await bucket.getFiles({ prefix: `${partsPrefix(rawPrefix)}/part-` });
  return files
    .map((file) => {
      const match = /part-(\d{6})$/.exec(file.name);
      return match ? Number(match[1]) : null;
    })
    .filter((index): index is number => index !== null)
    .sort((a, b) => a - b);
}

export async function savePart(params: {
  bucket: PartsBucket;
  rawPrefix: string;
  index: number;
  body: Buffer;
}): Promise<void> {
  await params.bucket
    .file(partPath(params.rawPrefix, params.index))
    // `application/octet-stream`, not the video type: a part is not a playable
    // video and labelling it as one invites something to try.
    .save(params.body, { contentType: "application/octet-stream", resumable: false });
}

export type CompositionResult =
  | { ok: true; parts: number }
  | { ok: false; reason: "no_parts" | "missing_parts"; missing: number[] };

/**
 * Compose the parts into the capture, in rounds of 32.
 *
 * Refuses on a gap rather than composing around it. A missing middle part
 * produces a file that is shorter than it should be and still decodes, which is
 * the worst possible failure here: a reconstruction built from a silently
 * truncated walkthrough looks like a bad capture rather than a bad upload.
 */
export async function composeParts(params: {
  bucket: PartsBucket;
  rawPrefix: string;
  objectPath: string;
  /** How many parts the client says it sent. */
  expectedParts: number;
}): Promise<CompositionResult> {
  const stored = await storedPartIndices(params.bucket, params.rawPrefix);
  if (!stored.length) return { ok: false, reason: "no_parts", missing: [] };

  const missing: number[] = [];
  for (let index = 0; index < params.expectedParts; index += 1) {
    if (!stored.includes(index)) missing.push(index);
  }
  if (missing.length) return { ok: false, reason: "missing_parts", missing };

  let sources = Array.from({ length: params.expectedParts }, (_, index) =>
    partPath(params.rawPrefix, index),
  );
  let round = 0;

  // Compose in rounds until one object is left. Intermediates live beside the
  // parts so the cleanup below sweeps them too.
  while (sources.length > 1) {
    const next: string[] = [];
    for (let start = 0; start < sources.length; start += COMPOSE_FANOUT) {
      const group = sources.slice(start, start + COMPOSE_FANOUT);
      if (group.length === 1) {
        next.push(group[0]!);
        continue;
      }
      const destination =
        `${partsPrefix(params.rawPrefix)}/merge-${round}-`
        + `${String(next.length).padStart(4, "0")}`;
      await params.bucket.combine(group, destination);
      next.push(destination);
    }
    sources = next;
    round += 1;
  }

  // One source left. Composed to the real destination rather than leaving the
  // caller to work out which intermediate won -- with a single source that is
  // a copy, which is the cost of one extra write on the last round and worth
  // it for a destination path nobody has to guess.
  await params.bucket.combine([sources[0]!], params.objectPath);

  return { ok: true, parts: params.expectedParts };
}

/**
 * Remove the parts once the capture exists.
 *
 * Best effort, and after composition rather than before: a failure to tidy up
 * costs storage, and a failure to tidy up *early* costs the recording.
 */
export async function discardParts(bucket: PartsBucket, rawPrefix: string): Promise<void> {
  try {
    const [files] = await bucket.getFiles({ prefix: `${partsPrefix(rawPrefix)}/` });
    await Promise.all(
      files.map((file) =>
        bucket
          .file(file.name)
          .delete({ ignoreNotFound: true })
          .catch(() => undefined),
      ),
    );
  } catch (error) {
    logger.warn({ error, rawPrefix }, "Could not clean up capture parts after composition");
  }
}
