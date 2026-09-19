// @vitest-environment node
/**
 * Listing the task objects, and photographing them — end to end at the route.
 *
 * The scope split from the token work carries here: declaring an item is an
 * operating statement (owner), photographing one is capture (film is fine). And
 * an image for an item nobody declared is refused before any bytes are stored.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

/** Records every object saved to storage, so tests can assert bytes landed. */
const savedObjects: { path: string; bytes: number }[] = [];

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  const { Writable } = await import("node:stream");
  const storageAdmin = {
    bucket: () => ({
      file: (path: string) => ({
        save: async (buffer: Buffer) => {
          savedObjects.push({ path, bytes: buffer.length });
        },
        // The upload routes stream disk-backed files into storage now, so the
        // fake speaks the write-stream surface as well as `.save`.
        createWriteStream: () => {
          const chunks: Buffer[] = [];
          return new Writable({
            write(chunk, _encoding, callback) {
              chunks.push(Buffer.from(chunk));
              callback();
            },
            final(callback) {
              savedObjects.push({ path, bytes: Buffer.concat(chunks).length });
              callback();
            },
          });
        },
      }),
    }),
  };
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    storageAdmin,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The capture gate is tested where it lives; here it is open so the item image
// path itself is what is under test.
vi.mock("../utils/captureUploadAuthorization", () => ({
  authorizeCaptureUpload: vi.fn(async () => ({ allowed: true })),
}));

// The brief route fires an outbox delivery on confirm; keep it off a provider.
vi.mock("../utils/captureOutbox", () => ({
  enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));

const briefRouter = (await import("../routes/site-task-brief")).default;
const uploadsRouter = (await import("../routes/self-capture-uploads")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { draftBrief, saveBrief } = await import("../utils/siteTaskBrief");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  savedObjects.length = 0;
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  app.use("/api/self-capture/uploads", uploadsRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
    contact: { email: "ops@acme.example", firstName: "Dana" },
  });
  await saveBrief(
    draftBrief({
      requestId: "req-1",
      summary: "Move sealed cartons from the conveyor into a tote.",
      captureMode: "self_capture",
      proposed: [],
    }),
  );
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function token(scope: "owner" | "film") {
  return createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", scope });
}

const items = (t: string) => `${baseUrl}/api/site-task-brief/${t}/items`;
// Photographing an item is capture, so its image lands on the uploads router.
const itemImage = (t: string, itemId: string) =>
  `${baseUrl}/api/self-capture/uploads/${t}/items/${itemId}/image`;

describe("the item list is seeded from the brief, then the operator owns it", () => {
  it("suggests items read out of the task description on first read", async () => {
    const body = (await (await fetch(items(token("owner")))).json()) as {
      items: { label: string; basis: string }[];
    };
    const labels = body.items.map((i) => i.label);
    expect(labels).toContain("Cartons");
    expect(labels).toContain("Totes");
    expect(body.items.every((i) => i.basis === "suggested")).toBe(true);
  });

  it("lets an owner add an item with where it goes", async () => {
    const response = await fetch(items(token("owner")), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Blue bins", locationNote: "stacked by the pallet" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { label: string; locationNote: string | null }[] };
    const bin = body.items.find((i) => i.label === "Blue bins");
    expect(bin?.locationNote).toBe("stacked by the pallet");
  });

  it("refuses a film-only link changing the list, and does not change it", async () => {
    const response = await fetch(items(token("film")), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Sneaked in" }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("capture_token_film_only");

    const after = (await (await fetch(items(token("owner")))).json()) as { items: { label: string }[] };
    expect(after.items.map((i) => i.label)).not.toContain("Sneaked in");
  });
});

describe("photographing an item is capture, so a film link may do it", () => {
  async function firstItemId(scope: "owner" | "film" = "owner") {
    const body = (await (await fetch(items(token(scope)))).json()) as { items: { itemId: string }[] };
    return body.items[0].itemId;
  }

  function imageForm() {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" }), "photo.jpg");
    return form;
  }

  it("stores a photo from a film link and counts it toward coverage", async () => {
    const itemId = await firstItemId();
    const response = await fetch(itemImage(token("film"), itemId), {
      method: "POST",
      body: imageForm(),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { items: { itemId: string; imageCount: number }[] };
    expect(body.items.find((i) => i.itemId === itemId)?.imageCount).toBe(1);
    // And the bytes actually landed, under the scene/item namespace.
    expect(savedObjects).toHaveLength(1);
    expect(savedObjects[0].path).toContain(`scenes/scene-1/items/${itemId}/`);
  });

  it("marks an item covered once it has enough photos", async () => {
    const itemId = await firstItemId();
    let last: { items: { itemId: string; coverageStatus: string }[] } | null = null;
    for (let i = 0; i < 2; i += 1) {
      const response = await fetch(itemImage(token("film"), itemId), {
        method: "POST",
        body: imageForm(),
      });
      last = (await response.json()) as typeof last;
    }
    expect(last!.items.find((i) => i.itemId === itemId)?.coverageStatus).toBe("covered");
  });

  it("refuses an image for an item nobody declared, before storing bytes", async () => {
    const response = await fetch(itemImage(token("film"), "item_does_not_exist"), {
      method: "POST",
      body: imageForm(),
    });
    expect(response.status).toBe(404);
    expect(((await response.json()) as { code: string }).code).toBe("unknown_item");
    expect(savedObjects).toHaveLength(0);
  });
});
