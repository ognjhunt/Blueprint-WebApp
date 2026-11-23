// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

const auth = vi.hoisted(() => ({ getUserByEmail: vi.fn(), createUser: vi.fn(), createCustomToken: vi.fn(), updateUser: vi.fn(), revokeRefreshTokens: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  authAdmin: auth, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } } }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { requestCompanySignInLink, redeemCompanySignInLink } = await import("../utils/companySignInLink");
const { createAccountInvitationToken, createAccountSignInToken } = await import("../utils/request-review-auth");
const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
const router = (await import("../routes/robot-team-access")).default;
const { csrfProtection } = await import("../middleware/csrf");

const email = "team@robot.example";
const id = accessRecordId(email);
const approved = { name: "Team Person", email, company: "Robot Co", website: null, status: "approved",
  appliedAtIso: "2026-11-01T00:00:00.000Z", updatedAtIso: "2026-11-02T00:00:00.000Z", decidedAtIso: "2026-11-02T00:00:00.000Z",
  decidedBy: "ops@example.com", decisionNote: null };
const outbox = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"))
  .map(([, row]) => row as { kind: string; to: string; subject: string; body: string });
const linkFrom = (body: string) => decodeURIComponent(/\/sign-in\?link=(\S+)/.exec(body)![1]);

beforeEach(() => {
  state.docs.clear(); vi.clearAllMocks();
  vi.stubEnv("BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET", "test-sign-in-link-secret");
  auth.getUserByEmail.mockRejectedValue(Object.assign(new Error("Absent"), { code: "auth/user-not-found" }));
  auth.createUser.mockImplementation(async (input: { uid: string }) => ({ uid: input.uid, emailVerified: true }));
  auth.createCustomToken.mockResolvedValue("custom-session");
  state.docs.set(`robotTeamAccess/${id}`, structuredClone(approved) as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("asking for a sign-in link", () => {
  it("queues one link through the outbox for an approved address, at most one per five minutes", async () => {
    const now = Date.parse("2026-11-23T10:00:00.000Z");
    await requestCompanySignInLink(" Team@Robot.Example ", now);
    await requestCompanySignInLink(email, now + 60_000);
    expect(outbox()).toHaveLength(1);
    const [row] = outbox();
    expect(row).toMatchObject({ kind: "robot_team_sign_in_link", to: email, subject: "Your Blueprint sign-in link" });
    expect(row.body).toContain("It works once and expires in 15 minutes.");
    await requestCompanySignInLink(email, now + 5 * 60_000);
    expect(outbox()).toHaveLength(2);
  });

  it("queues nothing for an unknown, pending or declined address", async () => {
    await requestCompanySignInLink("stranger@example.com");
    for (const status of ["applied", "declined"]) {
      state.docs.set(`robotTeamAccess/${id}`, { ...approved, status } as never);
      await requestCompanySignInLink(email);
    }
    expect(outbox()).toEqual([]);
  });
});

describe("using a sign-in link", () => {
  async function link() {
    await requestCompanySignInLink(email);
    return linkFrom(outbox()[0].body);
  }

  it("signs the existing account in once; the same link is refused afterwards", async () => {
    auth.getUserByEmail.mockResolvedValue({ uid: "existing-user", emailVerified: true });
    const token = await link();
    expect(await redeemCompanySignInLink(token)).toEqual({ customToken: "custom-session", returnTo: "/contact/robot-team" });
    expect(auth.createCustomToken).toHaveBeenCalledWith("existing-user");
    expect(auth.createUser).not.toHaveBeenCalled(); expect(auth.updateUser).not.toHaveBeenCalled();
    await expect(redeemCompanySignInLink(token)).rejects.toMatchObject({ status: 403 });
    expect(auth.createCustomToken).toHaveBeenCalledTimes(1);
  });

  it("creates the account with no password when the address has none yet", async () => {
    await redeemCompanySignInLink(await link());
    expect(auth.createUser).toHaveBeenCalledWith({ uid: `invited_${id}`, email, emailVerified: true, displayName: "Team Person" });
  });

  it("marks an unverified account verified: the link reached its inbox", async () => {
    auth.getUserByEmail.mockResolvedValue({ uid: "existing-user", emailVerified: false });
    await redeemCompanySignInLink(await link());
    expect(auth.updateUser).toHaveBeenCalledWith("existing-user", { emailVerified: true });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith("existing-user");
  });

  it("removes the password of an unverified account and ends its sessions before verifying it (no pre-account takeover)", async () => {
    // Someone registered the company's address with their own password before the company did; the address was never
    // verified. The company's link must not hand that stranger a verified account.
    auth.getUserByEmail.mockResolvedValue({ uid: "squatted", emailVerified: false, providerData: [{ providerId: "password" }] });
    await redeemCompanySignInLink(await link());
    expect(auth.updateUser).toHaveBeenCalledWith("squatted", { emailVerified: true, providersToUnlink: ["password"] });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith("squatted");
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(auth.createCustomToken.mock.invocationCallOrder[0]);
  });

  it("keeps a verified account's password and sessions", async () => {
    auth.getUserByEmail.mockResolvedValue({ uid: "existing-user", emailVerified: true, providerData: [{ providerId: "password" }] });
    await redeemCompanySignInLink(await link());
    expect(auth.updateUser).not.toHaveBeenCalled(); expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("is refused after the approval is withdrawn or re-decided, for a disabled account, expired, tampered or of another kind", async () => {
    const token = await link();
    state.docs.set(`robotTeamAccess/${id}`, { ...approved, status: "declined" } as never);
    await expect(redeemCompanySignInLink(token)).rejects.toMatchObject({ status: 403 });
    state.docs.set(`robotTeamAccess/${id}`, { ...approved, decidedAtIso: "2026-11-03T00:00:00.000Z" } as never);
    await expect(redeemCompanySignInLink(createAccountSignInToken({ email, sourceId: id, revision: approved.decidedAtIso }))).rejects.toMatchObject({ status: 403 });
    state.docs.set(`robotTeamAccess/${id}`, structuredClone(approved) as never);
    auth.getUserByEmail.mockResolvedValue({ uid: "existing-user", disabled: true });
    await expect(redeemCompanySignInLink(createAccountSignInToken({ email, sourceId: id, revision: approved.decidedAtIso }))).rejects.toMatchObject({ status: 403 });
    vi.useFakeTimers({ now: Date.now() });
    const old = createAccountSignInToken({ email, sourceId: id, revision: approved.decidedAtIso });
    vi.setSystemTime(Date.now() + 15 * 60_000 + 1000);
    await expect(redeemCompanySignInLink(old)).rejects.toMatchObject({ status: 403 });
    vi.useRealTimers();
    const invitation = createAccountInvitationToken({ email, workspaceType: "robot_team", sourceId: id, revision: approved.decidedAtIso });
    for (const bad of [invitation, `${token}x`, "", "a.b"]) await expect(redeemCompanySignInLink(bad)).rejects.toMatchObject({ status: 403 });
    expect(auth.createCustomToken).not.toHaveBeenCalled();
  });
});

describe("the sign-in link routes", () => {
  let server: Server, base: string;
  beforeEach(async () => {
    const app = express(); app.use(express.json()); app.use(csrfProtection); app.use("/api/robot-team-access", router);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  const post = (path: string, body: unknown) => fetch(`${base}/api/robot-team-access/${path}`, { method: "POST",
    headers: { "content-type": "application/json", cookie: "csrf_token=proof", "x-csrf-token": "proof" }, body: JSON.stringify(body) });

  it("answers the same whether or not the address is known", async () => {
    const known = await post("sign-in-link", { email });
    const unknown = await post("sign-in-link", { email: "stranger@example.com" });
    expect(known.status).toBe(202);
    expect({ status: unknown.status, body: await unknown.json() }).toEqual({ status: 202, body: await known.json() });
    expect(outbox()).toHaveLength(1);
  });

  it("redeems once and then refuses", async () => {
    await post("sign-in-link", { email });
    const link = linkFrom(outbox()[0].body);
    const first = await post("sign-in-link/redeem", { link });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ customToken: "custom-session", returnTo: "/contact/robot-team" });
    expect((await post("sign-in-link/redeem", { link })).status).toBe(403);
  });
});
