// @vitest-environment node
/**
 * The venue indexer never replaces stored vectors with empty ones, never
 * deletes them, and never marks the index as built when embeddings were not
 * available for a source (an empty vector is "not available").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const embedTexts = vi.hoisted(() => vi.fn());
const writes = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("../retrieval/embeddings", () => ({ embedTexts }));
vi.mock("node-fetch", () => ({ default: vi.fn(async (url: string) => ({ ok: true, status: 200,
  headers: { get: () => "text/plain" }, text: async () => (String(url).includes("robots") ? "" : "Venue knowledge text. ".repeat(50)) })) }));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const chunks: any = { async get() { return { docs: [{ id: "stored-chunk", ref: { id: "stored-chunk" } }], size: 1 }; },
    doc: (id: string) => ({ id }) };
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "TS" } } }, storageAdmin: null,
    dbAdmin: {
      collection: () => ({ doc: () => ({ collection: () => chunks,
        set: async (value: Record<string, unknown>) => { writes.push({ index: value }); } }) }),
      batch: () => ({ set: (ref: { id: string }, data: Record<string, unknown>) => writes.push({ set: ref.id, embedding: data.embedding }),
        delete: (ref: { id: string }) => writes.push({ deleted: ref.id }), commit: async () => undefined }),
    } };
});

const sources = [
  { url: "https://venue.example/one", title: "One", category: "web" },
  { url: "https://venue.example/two", title: "Two", category: "web" },
] as never;

beforeEach(() => {
  writes.length = 0;
  embedTexts.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  vi.resetModules();
});

describe("venue indexer and empty vectors", () => {
  it.each([
    ["every source", () => embedTexts.mockImplementation(async (texts: string[]) => texts.map(() => []))],
    ["one source", () => embedTexts.mockImplementationOnce(async (texts: string[]) => texts.map(() => [0.5]))
      .mockImplementation(async (texts: string[]) => texts.map(() => []))],
  ])("writes, deletes and marks nothing when %s came back without vectors", async (_name, arrange) => {
    arrange();
    const { buildVenueIndex } = await import("../retrieval/venueIndexer");
    await buildVenueIndex("bp-1", sources);
    expect(embedTexts).toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("writes the vectors, replaces stale chunks and marks the index when every source has vectors", async () => {
    embedTexts.mockImplementation(async (texts: string[]) => texts.map(() => [0.5]));
    const { buildVenueIndex } = await import("../retrieval/venueIndexer");
    await buildVenueIndex("bp-1", sources);
    expect(writes.filter((write) => "set" in write).every((write) => Array.isArray(write.embedding)
      && (write.embedding as number[]).length === 1)).toBe(true);
    expect(writes.some((write) => write.deleted === "stored-chunk")).toBe(true);
    expect(writes.some((write) => write.index)).toBe(true);
  });
});
