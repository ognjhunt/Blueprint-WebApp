// @vitest-environment node
/**
 * The rate limits in front of the deployment company's routes, with the real limiter (stress test round 2, 2026-11-24:
 * one 5-a-minute bucket per address covered applying, sign-in links and pressing "I agree", so an office that asked for
 * its sign-in link a few times could not accept the Terms, and a 429 said nothing of how long to wait).
 */
import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../middleware/verifyFirebaseToken", () => ({
  default: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = req.header("x-test-uid");
    if (!uid) return res.status(401).json({ error: "Sign in first." });
    res.locals.firebaseUser = { uid, email: `${uid}@north.example`, email_verified: true };
    next();
  },
}));
vi.mock("../utils/companyTerms", () => ({ recordCompanyTermsAcceptance: vi.fn(async () => true) }));
vi.mock("../utils/companySignInLink", () => ({ requestCompanySignInLink: vi.fn(async () => undefined),
  redeemCompanySignInLink: vi.fn(), CompanySignInLinkError: class extends Error {} }));
vi.mock("../utils/jobAutoSend", () => ({ emailOpenJobsToCompany: vi.fn(async () => false) }));
vi.mock("../utils/slack", () => ({ notifySlackRobotTeamAccessApplication: vi.fn(async () => ({ sent: true })) }));
vi.mock("../utils/companyCheck", () => ({ checkNewCompanyApplication: vi.fn(async () => undefined) }));

const router = (await import("../routes/robot-team-access")).default;
const { waitInWords } = await import("../routes/robot-team-access");
const { TERMS_VERSION, PRIVACY_VERSION } = await import("../../client/src/lib/legalAcceptance");

let server: Server;
let base = "";
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/robot-team-access", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${base}/api/robot-team-access/${path}`,
  { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })
  .then(async response => ({ status: response.status, retryAfter: response.headers.get("retry-after"),
    body: await response.json().catch(() => ({})) as Record<string, any> }));
const agree = (uid: string) => post("accept-terms", { acceptedTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
  { "x-test-uid": uid });

describe("the limits on a deployment company's routes", () => {
  it("lets a company accept the Terms after its address used up the sign-in link's limit", async () => {
    const asked = [];
    for (let index = 0; index < 6; index += 1) asked.push((await post("sign-in-link", { email: "ops@north.example" })).status);
    expect(asked.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
    const held = await post("sign-in-link", { email: "ops@north.example" });
    expect(held.status).toBe(429);
    expect(Number(held.retryAfter)).toBeGreaterThan(0);
    expect(held.body.error).toMatch(/^Too many tries in a short time\. Wait (?:a minute|\d+ minutes) and try again\.$/);
    expect((await agree("north-uid")).status).toBe(200);
  });

  it("limits pressing I agree by the signed-in account, and says how long to wait", async () => {
    const statuses = [];
    for (let index = 0; index < 11; index += 1) statuses.push((await agree("busy-uid")).status);
    expect(statuses.filter(status => status === 200)).toHaveLength(10);
    const held = await agree("busy-uid");
    expect(held.status).toBe(429);
    expect(held.body).toMatchObject({ code: "rate_limited" });
    expect(held.body.error).toMatch(/^Too many tries in a short time\. Wait (?:a minute|\d+ minutes) and try again\.$/);
    // Another account from the same address is not held by it.
    expect((await agree("other-uid")).status).toBe(200);
  });

  it("says a wait in plain words", () => {
    expect(waitInWords(1)).toBe("a minute");
    expect(waitInWords(60)).toBe("a minute");
    expect(waitInWords(61)).toBe("2 minutes");
    expect(waitInWords(89 * 60)).toBe("89 minutes");
    expect(waitInWords(5 * 3600 + 1)).toBe("6 hours");
  });
});
