// @vitest-environment node
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore as database } from "./helpers/fake-firestore";
const auth = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, authAdmin: auth }));
vi.mock("../utils/access-control", () => ({ hasAnyRole: async (res: any) => res.locals.firebaseUser?.ops === true }));
import router from "../routes/account-deletion";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { csrfProtection } from "../middleware/csrf";
import { accountDeletionId } from "../utils/accountDeletion";

describe("account deletion request boundary", () => {
  let server: Server, base: string;
  beforeEach(async () => {
    state.docs.clear(); vi.clearAllMocks();
    auth.verifyIdToken.mockImplementation(async (token: string) => {
      if (token === "revoked") throw new Error("revoked");
      return { uid: token === "other" ? "other-user" : "owner-user", email: "owner@example.com", ops: token === "staff",
        auth_time: token === "stale" ? 1 : token === "missing-time" ? undefined : token === "future" ? Math.floor(Date.now() / 1000) + 120 : Math.floor(Date.now() / 1000) };
    });
    const app = express(); app.use(express.json()); app.use("/api/account-deletion", csrfProtection, verifyFirebaseToken, router);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/account-deletion`;
  });
  afterEach(async () => { vi.restoreAllMocks(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const headers = (token = "owner") => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}`, cookie: "csrf_token=proof", "x-csrf-token": "proof" });
  const post = (body: unknown = { confirmation: "DELETE" }, token = "owner", path = "") => fetch(`${base}${path}`, { method: "POST", headers: headers(token), body: JSON.stringify(body) });

  it("requires authenticated, unrevoked identity and CSRF before accepting a request", async () => {
    expect((await fetch(base, { method: "POST", headers: { ...headers(), Authorization: "" }, body: JSON.stringify({ confirmation: "DELETE" }) })).status).toBe(401);
    expect((await post(undefined, "revoked")).status).toBe(401);
    expect(auth.verifyIdToken).toHaveBeenCalledWith("revoked", true);
    expect((await fetch(base, { method: "POST", headers: { ...headers(), "x-csrf-token": "wrong" }, body: JSON.stringify({ confirmation: "DELETE" }) })).status).toBe(403);
    expect(state.docs.size).toBe(0);
  });
  it("requires a recent, plausible sign-in time; token refresh alone cannot pass", async () => {
    for (const token of ["stale", "missing-time", "future"]) {
      const response = await post(undefined, token);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "recent_sign_in_required" });
    }
    expect(state.docs.size).toBe(0);
  });
  it("uses only verified UID and rejects injected identities, notes, or completion state", async () => {
    for (const body of [{ confirmation: "DELETE", uid: "victim" }, { confirmation: "DELETE", email: "victim@example.com" }, { confirmation: "DELETE", status: "completed" }, { confirmation: "delete" }]) {
      expect((await post(body)).status).toBe(400);
    }
    const response = await post(); expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json();
    expect(payload.request).toMatchObject({ id: accountDeletionId("owner-user"), status: "requested" });
    expect(payload.request.message).toContain("does not confirm deletion");
    expect(payload.request).not.toHaveProperty("accountUid"); expect(payload.request).not.toHaveProperty("accountEmail");
    expect(state.docs.get(`accountDeletionRequests/${payload.request.id}`)).toMatchObject({ accountUid: "owner-user", accountEmail: "owner@example.com" });
  });
  it("atomically deduplicates concurrent requests and retains the original receipt", async () => {
    const responses = await Promise.all([post(), post(), post()]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 200, 202]);
    const payloads = await Promise.all(responses.map(response => response.json()));
    expect(new Set(payloads.map(payload => JSON.stringify(payload.request))).size).toBe(1);
    expect(state.docs.size).toBe(1);
    expect((await (await fetch(`${base}?uid=other-user`, { headers: headers() })).json()).request.id).toBe(accountDeletionId("owner-user"));
    expect(await (await fetch(base, { headers: headers("other") })).json()).toEqual({ request: null });
  });
  it("does not claim successful receipt when storage fails, and a retry can succeed", async () => {
    vi.spyOn(database, "runTransaction").mockRejectedValueOnce(new Error("database unavailable"));
    expect((await post()).status).toBe(503); expect(state.docs.size).toBe(0);
    expect((await post()).status).toBe(202); expect(state.docs.size).toBe(1);
  });
  it("limits queue and review to staff and never accepts a completion mutation", async () => {
    const request = (await (await post()).json()).request;
    expect((await fetch(`${base}/admin`, { headers: headers() })).status).toBe(403);
    expect((await post({}, "owner", `/admin/${request.id}/review`)).status).toBe(403);
    expect((await fetch(`${base}/admin`, { headers: headers("staff") })).status).toBe(200);
    expect((await post({ status: "completed", receipt: "made-up" }, "staff", `/admin/${request.id}/review`)).status).toBe(400);
    const reviewed = await post({}, "staff", `/admin/${request.id}/review`);
    expect((await reviewed.json()).request.status).toBe("in_review");
    const saved = structuredClone(state.docs.get(`accountDeletionRequests/${request.id}`));
    await post({}, "staff", `/admin/${request.id}/review`);
    expect(state.docs.get(`accountDeletionRequests/${request.id}`)).toEqual(saved);
    expect((await (await fetch(base, { headers: headers() })).json()).request.message).toContain("does not confirm deletion");
  });
});
