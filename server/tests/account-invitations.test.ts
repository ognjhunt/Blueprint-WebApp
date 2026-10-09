// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
const auth = vi.hoisted(() => ({ getUserByEmail: vi.fn(), createUser: vi.fn(), createCustomToken: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, authAdmin: auth, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } } }));
vi.mock("../utils/field-encryption", () => ({ decryptInboundRequestForAdmin: async (record: unknown) => record }));
vi.mock("../utils/rate-limit-redis", () => ({ createRateLimitRedisStore: () => undefined }));
import { createAccountInvitationToken, createSiteClaimToken, verifyAccountInvitationToken } from "../utils/request-review-auth";
import { accountHasAdmission, redeemAccountInvitation, resolveAccountInvitation, robotTeamAccountInvitation } from "../utils/accountInvitations";
import { accessRecordId, type RobotTeamAccessRecord } from "../utils/robotTeamEarlyAccess";
import router from "../routes/account-invitations";
import { csrfProtection } from "../middleware/csrf";
const email = "team@robot.example";
const approved: RobotTeamAccessRecord = { name: "Team", email, company: "Robot Co", website: null, robot: "Arm", workWanted: "Picking", region: null, status: "approved", appliedAtIso: "2026-10-01T00:00:00Z", updatedAtIso: "2026-10-09T00:00:00Z", decidedAtIso: "2026-10-09T00:00:00Z", decidedBy: "ops@example.com", decisionNote: "Reviewed" };
const robotRef = `robotTeamAccess/${accessRecordId(email)}`;
beforeEach(() => {
  state.docs.clear(); vi.clearAllMocks();
  vi.stubEnv("BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET", "test-account-invitation-purpose-secret");
  auth.getUserByEmail.mockRejectedValue(Object.assign(new Error("Absent"), { code: "auth/user-not-found" }));
  auth.createUser.mockResolvedValue({}); auth.createCustomToken.mockResolvedValue("custom-session");
  state.docs.set(robotRef, structuredClone(approved));
});
afterEach(() => vi.unstubAllEnvs());
describe("approval before account creation", () => {
  it("rejects missing, tampered, expired, and wrong-purpose invitations", async () => {
    const valid = robotTeamAccountInvitation(approved);
    const expired = createAccountInvitationToken({ email, workspaceType: "robot_team", sourceId: accessRecordId(email), revision: approved.decidedAtIso! }, -1);
    for (const token of ["", `${valid}x`, `${valid}.extra`, expired, createSiteClaimToken("site-1")]) {
      expect(verifyAccountInvitationToken(token)).toBeNull();
      await expect(redeemAccountInvitation(token, "password", "password123")).rejects.toMatchObject({ status: 403 });
    }
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("rechecks manual approval at redemption even after inspection and with the library opened", async () => {
    const token = robotTeamAccountInvitation(approved);
    await expect(resolveAccountInvitation(token)).resolves.toMatchObject({ email, workspaceType: "robot_team" });
    vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", "0");
    state.docs.set(robotRef, { ...approved, status: "declined" });
    expect(await accountHasAdmission(email, "robot_team")).toBe(false);
    await expect(redeemAccountInvitation(token, "google")).rejects.toMatchObject({ status: 403 });
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("invalidates a prior decision revision and refuses role escalation", async () => {
    const token = robotTeamAccountInvitation(approved);
    state.docs.set(robotRef, { ...approved, decidedAtIso: "later-review" });
    await expect(resolveAccountInvitation(token)).rejects.toMatchObject({ status: 403 });
    const forgedRole = createAccountInvitationToken({ email, workspaceType: "site_operator", sourceId: accessRecordId(email), revision: approved.decidedAtIso! });
    await expect(resolveAccountInvitation(forgedRole)).rejects.toMatchObject({ status: 403 });
  });
  it("provisions an approved password account on the server with an unverified email", async () => {
    expect(await redeemAccountInvitation(robotTeamAccountInvitation(approved), "password", "password123")).toEqual({ customToken: "custom-session" });
    expect(auth.createUser).toHaveBeenCalledWith({ uid: `invited_${accessRecordId(email)}`, email, emailVerified: false, displayName: "Team", password: "password123" });
    expect(auth.createCustomToken).toHaveBeenCalledWith(`invited_${accessRecordId(email)}`);
  });
  it("never replaces existing credentials or returns a session for Google preparation", async () => {
    auth.getUserByEmail.mockResolvedValue({ uid: "existing-user" });
    const token = robotTeamAccountInvitation(approved);
    await expect(redeemAccountInvitation(token, "password", "replacement123")).rejects.toMatchObject({ status: 409 });
    expect(await redeemAccountInvitation(token, "google")).toEqual({ ready: true });
    expect(auth.createUser).not.toHaveBeenCalled(); expect(auth.createCustomToken).not.toHaveBeenCalled();
  });
  it("leaves sites open without approval or prerequisites", async () => {
    state.docs.clear();
    expect(await accountHasAdmission("new-site@example.com", "site_operator")).toBe(true);
    expect(await accountHasAdmission("new-site@example.com", "robot_team")).toBe(false);
  });
});
describe("public invitation endpoints", () => {
  let server: Server, base: string;
  beforeEach(async () => {
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { if (req.headers["x-staff"] === "1") res.locals.firebaseUser = { uid: "ops", email: "ops@example.com", ops: true }; next(); });
    app.use(csrfProtection, router); server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  async function post(path: string, body: Record<string, unknown>, extra: Record<string, string> = {}) { return fetch(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", cookie: "csrf_token=proof", "x-csrf-token": "proof", ...extra }, body: JSON.stringify(body) }); }
  it("requires CSRF before any account is provisioned", async () => {
    const response = await post("redeem", { invitation: robotTeamAccountInvitation(approved), mode: "password", password: "password123", acceptedTerms: true }, { "x-csrf-token": "wrong" });
    expect(response.status).toBe(403);
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("denies signup without an invitation and rejects extra email/role overrides or absent terms", async () => {
    const invitation = robotTeamAccountInvitation(approved);
    for (const body of [{ mode: "password", password: "password123", acceptedTerms: true }, { invitation, mode: "google", email: "attacker@example.com", acceptedTerms: true }, { invitation, mode: "google", workspaceType: "site_operator", acceptedTerms: true }, { invitation, mode: "google" }]) {
      expect((await post("redeem", body)).status).toBe(400);
    }
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("returns only the invited setup details, without the approval revision or a session", async () => {
    const response = await post("inspect", { invitation: robotTeamAccountInvitation(approved) });
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ email, name: "Team", organization: "Robot Co", workspaceType: "robot_team", returnTo: "/contact/robot-team" });
    expect(auth.createUser).not.toHaveBeenCalled();
  });
});
