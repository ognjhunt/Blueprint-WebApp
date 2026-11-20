// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null }));
vi.mock("../utils/accountInvitations", () => ({ robotTeamAccountInvitation: () => "invitation-fixture" }));
const { accessApprovedEmail } = await import("../utils/robotTeamAccessEmails");

// Review, 2026-11-12: the company approval email says where the job library is and what a company can do there today.
describe("the deployment company approval email", () => {
  it.each(["application", "invite"])("names the job library, says what a company does there, and promises nothing (%s)", source => {
    const email = accessApprovedEmail({ name: "Ada Example", email: "ada@example.com", source } as never);
    // Reworded on 2026-11-12 with sharing as the service: a company sees the whole job, not a summary, and answers on the
    // job's own page. It still says how to reach the jobs: sign in, then the job library, with its link.
    expect(email.body).toContain("Once you are signed in, the job library at https://tryblueprint.io/contact/robot-team shows the jobs sites share with approved companies.");
    expect(email.body).toContain("Open a job to see what the site filmed and what we have found so far, and answer: Interested, Not a fit or Would need something; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet.");
    expect(email.body).not.toMatch(/summar/i);
    expect(email.body).toContain("Approval does not guarantee a job, an introduction, or a deployment. Nothing is charged today.");
    expect(email.body).not.toMatch(/workspace|want to test at|new-job alerts|in Settings|evaluation|\$\s?\d/i);
    // The doctrine's words: an approved deployment company, never a "team" invited to a "beta" (journey audit, 2026-11-20).
    expect(email.subject).toBe("Your company is approved to see jobs on Blueprint");
    expect(email.body).toContain(source === "invite"
      ? "Following our conversation, your company is approved as a deployment company on Blueprint."
      : "Your company is approved as a deployment company on Blueprint.");
    expect(`${email.subject}\n${email.body}`).not.toMatch(/\bbeta\b|your team/i);
  });
});
