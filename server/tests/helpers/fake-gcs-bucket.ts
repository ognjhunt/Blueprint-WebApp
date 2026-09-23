/**
 * An in-memory Cloud Storage bucket that behaves the way the bundle upload
 * depends on: create-only preconditions fail with 412, missing objects with 404,
 * `md5Hash` is computed from the stored bytes, a V4 signed PUT is bound to one
 * object, one Content-MD5 and `x-goog-if-generation-match: 0`, and a resumable
 * session writes one object once.
 *
 * It speaks the subset of the Firebase Admin bucket surface
 * `siteCaptureBundleStorage` uses, plus client-side helpers (`putSigned`,
 * `uploadResumable`) standing in for the phone talking to storage directly.
 */

import { createHash } from "node:crypto";

export interface FakeObject {
  data: Buffer;
  contentType: string;
  generation: number;
}

interface SignedBinding {
  name: string;
  md5: string;
  contentType: string;
  expiresAtMs: number;
}

interface SessionBinding {
  name: string;
  md5: string | null;
  contentType: string;
}

class HttpishError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function md5(data: Buffer): string {
  return createHash("md5").update(data).digest("base64");
}

export class FakeGcsBucket {
  readonly objects = new Map<string, FakeObject>();
  /** Every object write, in order, including ones a signed URL made. */
  readonly writeLog: string[] = [];
  readonly calls = {
    getFiles: 0,
    getMetadata: 0,
    download: 0,
    save: 0,
    getSignedUrl: 0,
    createResumableUpload: 0,
  };
  private readonly signed = new Map<string, SignedBinding>();
  private readonly sessions = new Map<string, SessionBinding>();
  private generation = 1;
  private counter = 0;
  now: () => number = () => Date.now();

  constructor(readonly name = "test-capture-bucket") {}

  private store(name: string, data: Buffer, contentType: string, ifGenerationMatch?: number) {
    if (ifGenerationMatch === 0 && this.objects.has(name)) {
      throw new HttpishError(412, `Precondition failed for ${name}`);
    }
    this.objects.set(name, { data, contentType, generation: this.generation++ });
    this.writeLog.push(name);
  }

  /** Write an object directly, as some other writer would. */
  seed(name: string, data: string | Buffer, contentType = "application/octet-stream") {
    this.store(name, Buffer.isBuffer(data) ? data : Buffer.from(data), contentType);
  }

  text(name: string): string | null {
    return this.objects.get(name)?.data.toString("utf8") ?? null;
  }

  names(prefix = ""): string[] {
    return [...this.objects.keys()].filter((name) => name.startsWith(prefix)).sort();
  }

  private metadataFor(name: string) {
    const object = this.objects.get(name);
    if (!object) return undefined;
    return {
      name,
      size: String(object.data.length),
      md5Hash: md5(object.data),
      contentType: object.contentType,
      generation: String(object.generation),
    };
  }

  file(name: string) {
    const bucket = this;
    return {
      name,
      get metadata() {
        return bucket.metadataFor(name);
      },
      async getMetadata() {
        bucket.calls.getMetadata += 1;
        const metadata = bucket.metadataFor(name);
        if (!metadata) throw new HttpishError(404, `No such object: ${name}`);
        return [metadata] as [Record<string, unknown>];
      },
      async exists() {
        return [bucket.objects.has(name)] as [boolean];
      },
      async download() {
        bucket.calls.download += 1;
        const object = bucket.objects.get(name);
        if (!object) throw new HttpishError(404, `No such object: ${name}`);
        return [Buffer.from(object.data)] as [Buffer];
      },
      async save(content: string | Buffer, options: Record<string, any> = {}) {
        bucket.calls.save += 1;
        const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
        bucket.store(name, data, String(options.contentType ?? "application/octet-stream"),
          options.preconditionOpts?.ifGenerationMatch);
      },
      async getSignedUrl(config: Record<string, any>) {
        bucket.calls.getSignedUrl += 1;
        if (config.version !== "v4" || config.action !== "write") {
          throw new Error("fake bucket signs only v4 write URLs");
        }
        if (config.extensionHeaders?.["x-goog-if-generation-match"] !== "0") {
          throw new Error("fake bucket refuses a signed write that is not create-only");
        }
        const url = `https://storage.fake/${encodeURIComponent(name)}?X-Goog-Signature=${++bucket.counter}`;
        bucket.signed.set(url, {
          name,
          md5: String(config.contentMd5),
          contentType: String(config.contentType),
          expiresAtMs: Number(config.expires),
        });
        return [url] as [string];
      },
      async createResumableUpload(options: Record<string, any>) {
        bucket.calls.createResumableUpload += 1;
        if (options.preconditionOpts?.ifGenerationMatch !== 0) {
          throw new Error("fake bucket refuses a resumable session that is not create-only");
        }
        const uri = `https://storage.fake/upload/resumable/${encodeURIComponent(name)}?upload_id=${++bucket.counter}`;
        bucket.sessions.set(uri, {
          name,
          md5: options.metadata?.md5Hash ?? null,
          contentType: String(options.metadata?.contentType ?? "application/octet-stream"),
        });
        return [uri] as [string];
      },
    };
  }

  async getFiles(options: Record<string, any>) {
    this.calls.getFiles += 1;
    const prefix = String(options.prefix ?? "");
    let names = this.names(prefix);
    if (options.maxResults) names = names.slice(0, Number(options.maxResults));
    return [names.map((name) => this.file(name))] as [ReturnType<FakeGcsBucket["file"]>[]];
  }

  /** The phone's PUT to a signed URL. Returns the HTTP status GCS would. */
  putSigned(url: string, body: string | Buffer, headers: Record<string, string>): number {
    const binding = this.signed.get(url);
    if (!binding) return 403;
    if (this.now() > binding.expiresAtMs) return 400;
    if (headers["Content-MD5"] !== binding.md5 || headers["Content-Type"] !== binding.contentType) return 403;
    if (headers["x-goog-if-generation-match"] !== "0") return 403;
    const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (md5(data) !== binding.md5) return 400;
    try {
      this.store(binding.name, data, binding.contentType, 0);
      return 200;
    } catch (error) {
      return (error as HttpishError).code ?? 500;
    }
  }

  /** The phone's single-request upload to a resumable session URI. */
  uploadResumable(sessionUri: string, body: string | Buffer): number {
    const binding = this.sessions.get(sessionUri);
    if (!binding) return 404;
    const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (binding.md5 && md5(data) !== binding.md5) return 400;
    try {
      this.store(binding.name, data, binding.contentType, 0);
      return 200;
    } catch (error) {
      return (error as HttpishError).code ?? 500;
    }
  }
}
