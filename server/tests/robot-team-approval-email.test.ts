// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: null }));
vi.mock("../utils/accountInvitations", () => ({ robotTeamAccountInvitation: () => "invitation-fixture" }));
const { accessApprovedEmail, introductionCompanyEmail } = await import("../utils/robotTeamAccessEmails");

// Review, 2026-11-12: the company approval email says where the jobs are and what a company can do there today.
// Launch copy (2026-11-20, e-009 to e-011): the account link is its own button, the list is "Find jobs", and the
// email no longer lists the answers or hedges about what approval guarantees.
describe("the deployment company approval email", () => {
  it.each(["application", "invite"])("names Find jobs, says what a company does there, and promises nothing (%s)", source => {
    const email = accessApprovedEmail({ name: "Ada Example", email: "ada@example.com", source } as never);
    // It says how to reach the jobs: sign in, then Find jobs, with its link as a button.
    expect(email.body).toContain("\n\nOnce you are signed in, open Find jobs to see the jobs sites have posted. Open a job to see its job packet and respond.\n\nFind jobs:\nhttps://tryblueprint.io/contact/robot-team\n\n");
    // The invitation works for the reader's own address alone, so the address is named, and the link is one button.
    expect(email.body).toContain("Use this email address (ada@example.com) to create your account, or sign in if you already have one.\n\n"
      + "Set up your account:\nhttps://tryblueprint.io/signup/business?invitation=invitation-fixture\n\n"
      + "The link works only for this email address and expires in 7 days. If it expires, get a new one at https://tryblueprint.io/contact/robot-team.");
    expect(email.body).not.toMatch(/summar|job library|bound to|guarantee|in a minute/i);
    expect(email.body).toContain("\nNothing is charged today.\n");
    expect(email.body).not.toMatch(/workspace|want to test at|new-job alerts|in Settings|evaluation|\$\s?\d/i);
    // The doctrine's words: an approved deployment company, never a "team" invited to a "beta" (journey audit, 2026-11-20).
    expect(email.subject).toBe("Your company is approved to see jobs on Blueprint");
    expect(email.body).toContain(source === "invite"
      ? "Following our conversation, your company is approved as a deployment company on Blueprint."
      : "Your company is approved as a deployment company on Blueprint.");
    expect(`${email.subject}\n${email.body}`).not.toMatch(/\bbeta\b|your team/i);
  });
});

describe("the company's introduction email", () => {
  const site = { name: "Eastside Laundromat", contactName: null, email: "manager@site.example", phone: null, location: "1200 E 6th St, Austin, TX" };
  const jobUrl = "https://tryblueprint.io/jobs/req-1";

  it("quotes the company's answer, labels the address, and says where to write (a reply reaches Blueprint)", () => {
    const { body } = introductionCompanyEmail({ site, jobUrl, contactName: "Dana Lee", answerLabel: "Tested it: can do" });
    expect(body).toContain('You answered "Tested it: can do" to a job on Blueprint, and the site has asked for an introduction.');
    expect(body).toContain("\nSite: Eastside Laundromat\nEmail: manager@site.example\nAddress: 1200 E 6th St, Austin, TX\n\nOpen the job:\nhttps://tryblueprint.io/jobs/req-1\n");
    expect(body).toContain("We are sending the site your company's name and your contact details now. Write to them at the email above.");
    expect(body).not.toMatch(/Reply to them|Where it is/);
  });

  it("says a start-form job's typed address once, as its address, not as the site's name", () => {
    const { body } = introductionCompanyEmail({ site: { ...site, name: site.location }, jobUrl, answerLabel: "Interested" });
    expect(body).not.toContain("Site: ");
    expect(body.split("1200 E 6th St, Austin, TX")).toHaveLength(2);
    expect(body).toContain("\nAddress: 1200 E 6th St, Austin, TX\n");
  });
});
