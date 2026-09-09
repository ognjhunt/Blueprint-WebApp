// @vitest-environment node
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  contactAdds: [] as Record<string, unknown>[],
  sendEmail: vi.fn(async () => ({ sent: true })),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "serverTimestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name === "ops") {
        return {
          doc: () => ({
            collection: () => ({
              add: async () => ({ id: "wishlist-record" }),
            }),
          }),
        };
      }

      if (name === "contactRequests") {
        return {
          add: async (payload: Record<string, unknown>) => {
            state.contactAdds.push(payload);
            return { id: "contact-request-record" };
          },
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  },
}));

vi.mock("../utils/email", () => ({
  sendEmail: state.sendEmail,
}));

function makeResponse() {
  const response = {
    locals: { requestId: "req-test" },
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return response as Response & { statusCode: number; body: unknown };
}

afterEach(() => {
  state.contactAdds.length = 0;
  state.sendEmail.mockClear();
  vi.resetModules();
});

describe("contact request persistence", () => {
  it("persists a website inquiry without fabricating a scene or waitlist state", async () => {
    const { default: contactHandler } = await import("../routes/contact");
    const req = {
      method: "POST",
      body: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        city: "Durham",
        state: "NC",
        requestSource: "website-contact-form",
        message: "We need a task evaluation scene.",
      },
      get: () => undefined,
      ip: "127.0.0.1",
      originalUrl: "/api/contact",
      path: "/api/contact",
    } as unknown as Request;
    const res = makeResponse();
    const taskMedia = { links: ["https://example.com/task"], uploads: [{ name: "task.mp4", storageUri: "gs://private-test-bucket/contact-task-videos/example/task.mp4", reviewUrl: "https://storage.example/review", reviewUrlExpiresAt: "2026-09-16T00:00:00.000Z", contentType: "video/mp4", sizeBytes: 1024 }] };
    res.locals.contactTaskMedia = taskMedia;

    await contactHandler(req, res);

    expect(res.statusCode).toBe(202);
    expect(state.contactAdds).toHaveLength(1);
    expect(state.contactAdds[0]).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      requestSource: "website-contact-form",
      taskVideoLinks: taskMedia.links,
      taskVideos: taskMedia.uploads,
      ops_automation: expect.objectContaining({ status: "pending" }),
    });
    expect(res.body).toEqual({ success: true, sent: true });
    expect(res.locals.contactRequestPersisted).toBe(true);
  });
});
