/**
 * An in-memory Cloud Storage bucket for the browser walkthrough upload
 * (`POST /api/self-capture/uploads/:token`) and the status reads that follow.
 *
 * It speaks the subset that route depends on: streamed and saved writes with
 * generation preconditions (412 on mismatch), metadata, existence and download,
 * reads pinned to a generation, and deletion bound to an exact generation.
 * `server/tests/capture-link-at-submit.test.ts` fakes the same surface inline;
 * this one is shared so a journey can start from the real intake and land real
 * footage through the real route.
 */
import { Readable, Writable } from "node:stream";

interface Metadata {
  name: string;
  generation: string;
  size: string;
  crc32c: string;
}

interface Version {
  body: Buffer;
  metadata: Metadata;
}

function missing(name: string) {
  return Object.assign(new Error(`No such object: ${name}`), { code: 404 });
}

export function createFakeUploadBucket(name = "fake-upload-bucket") {
  const versions = new Map<string, Version[]>();
  let nextGeneration = 1;

  const latest = (object: string) => versions.get(object)?.at(-1);
  const at = (object: string, generation?: string) => generation
    ? versions.get(object)?.find(version => version.metadata.generation === String(generation))
    : latest(object);
  const checkPrecondition = (object: string, match: unknown) => {
    if (match === undefined) return;
    if (String(match) !== String(latest(object)?.metadata.generation ?? 0)) {
      throw Object.assign(new Error(`Precondition failed for ${object}`), { code: 412 });
    }
  };
  const store = (object: string, body: Buffer): Metadata => {
    const metadata = { name: object, generation: String(nextGeneration++), size: String(body.length), crc32c: "AAAAAA==" };
    versions.set(object, [...(versions.get(object) ?? []), { body, metadata }]);
    return metadata;
  };

  const bucket = {
    name,
    getFiles: async ({ prefix }: { prefix: string }) =>
      [[...versions.keys()].filter(object => object.startsWith(prefix) && latest(object)).map(object => ({ name: object }))],
    file: (object: string, options?: { generation?: string }) => {
      let written: Record<string, unknown> | undefined;
      return {
        name: object,
        /** What the storage client attaches after a write. */
        get metadata() { return written; },
        save: async (body: unknown, config?: { resumable?: boolean; preconditionOpts?: { ifGenerationMatch?: unknown } }) => {
          checkPrecondition(object, config?.preconditionOpts?.ifGenerationMatch);
          const metadata = store(object, Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
          // Storage 7.21 resumable writes report the size as a number.
          written = config?.resumable === false ? { ...metadata } : { ...metadata, size: Number(metadata.size) };
        },
        createWriteStream: (config?: { preconditionOpts?: { ifGenerationMatch?: unknown } }) => {
          const chunks: Buffer[] = [];
          return new Writable({
            write(chunk, _encoding, callback) {
              chunks.push(Buffer.from(chunk));
              callback();
            },
            final(callback) {
              try {
                checkPrecondition(object, config?.preconditionOpts?.ifGenerationMatch);
                written = { ...store(object, Buffer.concat(chunks)) };
                callback();
              } catch (error) {
                callback(error as Error);
              }
            },
          });
        },
        getMetadata: async () => {
          const version = at(object, options?.generation);
          if (!version) throw missing(object);
          return [{ ...version.metadata }];
        },
        exists: async () => [Boolean(at(object, options?.generation))],
        download: async () => {
          const version = at(object, options?.generation);
          if (!version) throw missing(object);
          return [version.body];
        },
        createReadStream: () => {
          const version = at(object, options?.generation);
          if (!version) throw missing(object);
          return Readable.from(version.body);
        },
        delete: async () => {
          if (!options?.generation) throw new Error("Deletion must bind the exact generation");
          versions.set(object, (versions.get(object) ?? []).filter(version => version.metadata.generation !== String(options.generation)));
        },
      };
    },
  };

  return {
    bucket,
    /** The current objects' names, for assertions. */
    objectNames: () => [...versions.keys()].filter(object => latest(object)),
    clear: () => { versions.clear(); nextGeneration = 1; },
  };
}

/** One bucket per test file, shared by its `firebaseAdmin` mock and its assertions. */
export const sharedUploadBucket = createFakeUploadBucket();
