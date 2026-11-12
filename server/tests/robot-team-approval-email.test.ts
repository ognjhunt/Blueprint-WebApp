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
