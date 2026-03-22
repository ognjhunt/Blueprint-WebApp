// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const extractPdf = vi.hoisted(() => vi.fn());
const embedTexts = vi.hoisted(() => vi.fn());

function createFakeDb() {
  const store = {
    opsDocuments: new Map<string, Record<string, unknown>>(),
    knowledgeChunks: new Map<string, Record<string, unknown>>(),
  };

  return {
    store,
    db: {
      collection(name: string) {
        if (name === "opsDocuments") {
          return {
            doc(id: string) {
              return {
                async set(value: Record<string, unknown>, options?: { merge?: boolean }) {
                  const current = store.opsDocuments.get(id) || {};
                  store.opsDocuments.set(id, options?.merge ? { ...current, ...value } : value);
                },
                async get() {
                  const value = store.opsDocuments.get(id);
                  return {
                    exists: Boolean(value),
                    data: () => value,
                  };
                },
              };
            },
            orderBy() {
              return {
                limit() {
                  return {
                    async get() {
                      return {
                        docs: [...store.opsDocuments.entries()].map(([id, data]) => ({
                          id,
                          data: () => data,
                        })),
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (name === "blueprints") {
          return {
            doc(blueprintId: string) {
              return {
                collection(collectionName: string) {
                  if (collectionName !== "knowledge_chunks") {
                    throw new Error(`Unexpected subcollection ${collectionName}`);
                  }
                  return {
                    doc(id: string) {
                      return {
                        async set(value: Record<string, unknown>, options?: { merge?: boolean }) {
                          const key = `${blueprintId}:${id}`;
                          const current = store.knowledgeChunks.get(key) || {};
                          store.knowledgeChunks.set(
                            key,
                            options?.merge ? { ...current, ...value } : value,
                          );
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (name === "opsActionLogs") {
          return {
            doc() {
              return {
                async set() {
                  return;
                },
              };
            },
          };
        }

        throw new Error(`Unexpected collection ${name}`);
      },
    },
  };
}

const fake = createFakeDb();

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: fake.db,
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../integrations/openclaw/client", () => ({
  extractPdf,
}));

vi.mock("../retrieval/embeddings", () => ({
  embedTexts,
}));

beforeEach(() => {
  fake.store.opsDocuments.clear();
  fake.store.knowledgeChunks.clear();
  extractPdf.mockReset();
  embedTexts.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe("ops documents", () => {
  it("extracts a document, persists OpenClaw metadata, and writes knowledge chunks", async () => {
    extractPdf.mockResolvedValue({
      accepted: true,
      openclaw_session_id: "session-1",
      openclaw_run_id: "run-1",
      status: "completed",
      result: {
        summary: "Key SOP",
        text: "Step one. Step two. Step three.",
      },
      artifacts: { pdf_extraction: "gs://artifacts/doc-1.json" },
      logs: [{ level: "info", message: "done" }],
      error: null,
    });
    embedTexts.mockResolvedValue([[0.1, 0.2, 0.3]]);

    const { createOpsDocument, extractOpsDocument } = await import("../agents/ops-documents");
    const created = await createOpsDocument({
      title: "Launch SOP",
      source_file_uri: "gs://docs/launch-sop.pdf",
      blueprint_ids: ["bp-1"],
    });

    const extracted = await extractOpsDocument(created.id);

    expect(extracted?.extraction_status).toBe("completed");
    expect(extracted?.openclaw_run_id).toBe("run-1");
    expect(fake.store.knowledgeChunks.size).toBeGreaterThan(0);
  });
});
