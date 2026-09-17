// @vitest-environment node
/**
 * A walkthrough that survives a dropped connection, and refuses to pretend.
 *
 * The dangerous failure here is not a lost upload -- it is a *quietly truncated*
 * one. Compose around a missing middle part and you get a file that is shorter
 * than it should be and still decodes, so a reconstruction built from it looks
 * like a bad capture rather than a bad upload, and the site gets blamed for our
 * network.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { composeParts, discardParts, partPath, savePart, storedPartIndices } = await import(
  "../utils/captureParts"
);

const RAW = "captures/scene-1/cap-1/raw";

/** A bucket that records what was asked of it. */
function fakeBucket() {
  const objects = new Map<string, Buffer>();
  const combines: Array<{ sources: string[]; destination: string }> = [];
  let failNextCombine = false;

  const bucket = {
    file(path: string) {
      return {
        async save(data: Buffer) {
          objects.set(path, data);
        },
        async exists(): Promise<[boolean]> {
          return [objects.has(path)];
        },
        async delete() {
          objects.delete(path);
        },
        async getMetadata(): Promise<[{ size?: string | number }]> {
          return [{ size: objects.get(path)?.length ?? 0 }];
        },
      };
    },
    async getFiles({ prefix }: { prefix: string }): Promise<[Array<{ name: string }>]> {
      return [
        [...objects.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })),
      ];
    },
    async combine(sources: string[], destination: string) {
      if (failNextCombine) {
        failNextCombine = false;
        throw new Error("compose failed");
      }
      combines.push({ sources: [...sources], destination });
      objects.set(
        destination,
        Buffer.concat(sources.map((source) => objects.get(source) ?? Buffer.alloc(0))),
      );
    },
  };

  return {
    bucket: bucket as never,
    objects,
    combines,
    failCombineOnce() {
      failNextCombine = true;
    },
  };
}

async function seedParts(harness: ReturnType<typeof fakeBucket>, count: number, skip: number[] = []) {
  for (let index = 0; index < count; index += 1) {
    if (skip.includes(index)) continue;
    await savePart({
      bucket: harness.bucket,
      rawPrefix: RAW,
      index,
      body: Buffer.from(`part-${index}-`),
    });
  }
}

let harness: ReturnType<typeof fakeBucket>;

beforeEach(() => {
  harness = fakeBucket();
});

describe("parts are ordered by their names, not by luck", () => {
  it("pads the index so ten sorts after two", async () => {
    // "part-10" sorting before "part-2" would splice somebody's walkthrough
    // into nonsense that still plays.
    expect(partPath(RAW, 2) < partPath(RAW, 10)).toBe(true);
    expect(partPath(RAW, 9) < partPath(RAW, 10)).toBe(true);
    expect(partPath(RAW, 99) < partPath(RAW, 100)).toBe(true);
  });

  it("reports what is stored so a resume sends only the rest", async () => {
    await seedParts(harness, 5, [2, 3]);

    expect(await storedPartIndices(harness.bucket, RAW)).toEqual([0, 1, 4]);
  });
});

describe("composition refuses a gap rather than composing around it", () => {
  it("names the missing parts so the client can send them", async () => {
    await seedParts(harness, 5, [2]);

    const result = await composeParts({
      bucket: harness.bucket,
      rawPrefix: RAW,
      objectPath: `${RAW}/walkthrough.mp4`,
      expectedParts: 5,
    });

    expect(result).toEqual({ ok: false, reason: "missing_parts", missing: [2] });
    // And crucially: nothing was written to the destination.
    expect(harness.objects.has(`${RAW}/walkthrough.mp4`)).toBe(false);
  });

  it("refuses when nothing arrived at all", async () => {
    const result = await composeParts({
      bucket: harness.bucket,
      rawPrefix: RAW,
      objectPath: `${RAW}/walkthrough.mp4`,
      expectedParts: 3,
    });

    expect(result).toMatchObject({ ok: false, reason: "no_parts" });
  });

  it("refuses a short upload even when the parts it has are contiguous", async () => {
    // The client said four and sent the first two. Contiguous, and still a
    // truncated video.
    await seedParts(harness, 2);

    const result = await composeParts({
      bucket: harness.bucket,
      rawPrefix: RAW,
      objectPath: `${RAW}/walkthrough.mp4`,
      expectedParts: 4,
    });

    expect(result).toMatchObject({ ok: false, missing: [2, 3] });
  });
});

describe("and composes in order when everything is there", () => {
  it("produces the parts concatenated, in sequence", async () => {
    await seedParts(harness, 4);

    const result = await composeParts({
      bucket: harness.bucket,
      rawPrefix: RAW,
      objectPath: `${RAW}/walkthrough.mp4`,
      expectedParts: 4,
    });

    expect(result).toEqual({ ok: true, parts: 4 });
    expect(harness.objects.get(`${RAW}/walkthrough.mp4`)?.toString()).toBe(
      "part-0-part-1-part-2-part-3-",
    );
  });

  it("handles a single part without a special case", async () => {
    await seedParts(harness, 1);

    const result = await composeParts({
      bucket: harness.bucket,
      rawPrefix: RAW,
      objectPath: `${RAW}/walkthrough.mp4`,
      expectedParts: 1,
    });

    expect(result).toEqual({ ok: true, parts: 1 });
    expect(harness.objects.get(`${RAW}/walkthrough.mp4`)?.toString()).toBe("part-0-");
  });

  it("composes in rounds past the 32-source limit, still in order", async () => {
    // The reason there is no part cap. Capping at 32 would mean chunk sizes
    // that grow with the recording, and a 64MB chunk is exactly what a phone
    // connection cannot get through.
    await seedParts(harness, 70);

    const result = await composeParts({
      bucket: harness.bucket,
      rawPrefix: RAW,
      objectPath: `${RAW}/walkthrough.mp4`,
      expectedParts: 70,
    });

    expect(result).toEqual({ ok: true, parts: 70 });
    // Every compose call stayed inside the limit.
    for (const call of harness.combines) {
      expect(call.sources.length).toBeLessThanOrEqual(32);
    }
    const expected = Array.from({ length: 70 }, (_, index) => `part-${index}-`).join("");
    expect(harness.objects.get(`${RAW}/walkthrough.mp4`)?.toString()).toBe(expected);
  });
});

describe("parts are cleaned up, but only after the capture exists", () => {
  it("removes every part and intermediate", async () => {
    await seedParts(harness, 40);
    await composeParts({
      bucket: harness.bucket,
      rawPrefix: RAW,
      objectPath: `${RAW}/walkthrough.mp4`,
      expectedParts: 40,
    });

    await discardParts(harness.bucket, RAW);

    const left = [...harness.objects.keys()].filter((name) => name.includes("/parts/"));
    expect(left).toEqual([]);
    // The capture itself survives the sweep.
    expect(harness.objects.has(`${RAW}/walkthrough.mp4`)).toBe(true);
  });

  it("does not throw when cleanup fails", async () => {
    // A failure to tidy up costs storage. Throwing here would cost the
    // response on an upload that actually succeeded.
    const broken = {
      ...harness.bucket,
      getFiles: async () => {
        throw new Error("list failed");
      },
    } as never;

    await expect(discardParts(broken, RAW)).resolves.toBeUndefined();
  });
});
