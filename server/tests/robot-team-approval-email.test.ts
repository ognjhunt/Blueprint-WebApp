// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null }));
vi.mock("../utils/accountInvitations", () => ({ robotTeamAccountInvitation: () => "invitation-fixture" }));
const { accessApprovedEmail } = await import("../utils/robotTeamAccessEmails");

// Review, 2026-11-12: the company approval email says where the job library is and what a company can do there today.
describe("the deployment company approval email", () => {
  it.each(["application", "invite"])("names the job library, says what a company does there, and promises nothing (%s)", source => {
    const email = accessApprovedEmail({ name: "Ada Example", email: "ada@example.com", source } as never);
    expect(email.body).toContain("Once you are signed in, the job library at https://tryblueprint.io/contact/robot-team shows summaries of the site jobs shared with approved companies.");
    expect(email.body).toContain("For each one you can tell us you are interested or that it is not a fit.");
    expect(email.body).toContain("Approval does not guarantee a job, an introduction, or a deployment. Nothing is charged today.");
    expect(email.body).not.toMatch(/workspace|want to test at|new-job alerts|in Settings|evaluation|\$\s?\d/i);
  });
});

// Review, 2026-11-12: the agent contract and the published OpenAPI say what a company can do today.
describe("the agent contract a company's agent reads", () => {
  it("says running a company's own software is not offered yet, and quotes no beta pricing", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const published = fs.readFileSync(path.resolve(import.meta.dirname, "../../client/public/agent-access.openapi.json"), "utf8");
    expect(published).toContain("running a company's own software on a site's job is not offered yet");
    expect(published).toContain("Deployment companies apply at /partners");
    expect(published).not.toMatch(/free during the beta|Evaluations are free|apply to give Blueprint access to a policy/i);
    // Review, 2026-11-12: the description at the top of the contract said the old frame.
    expect(published).not.toMatch(/compares public control policies|free for sites and partners|takes no cut|evaluation tools for robot teams/i);
    expect(published).toContain("can see the summary the site approved, never the video or the simulation");
  });
});
