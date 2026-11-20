import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Beta from "@/pages/Beta";
import { COMPANY } from "@/data/company";

// The Questions page (bare bones; frame of 2026-11-12): the one details screen for the public pages, in short rows.
describe("the questions page", () => {
  it("answers cost and what happens after sending without inventing a reply time, dates or a price", () => {
    render(<Beta />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Questions");
    const sites = screen.getByRole("region", { name: "For sites" });
    // No person replies to a job, so no reply time is promised (journey audit, 2026-11-20): only what the code does.
    expect(sites).toHaveTextContent(/After you send\s*You get a private link to your job page, which shows where the job stands\./);
    expect(document.body.textContent).not.toMatch(/reply within|within an hour|we (usually )?reply/i);
    expect(sites).toHaveAttribute("id", "scope");
    expect(sites).toHaveTextContent(/Cost\s*Free for sites\./);
    expect(screen.getByRole("link", { name: "Refunds and cancellations" })).toHaveAttribute("href", "/refunds");
    expect(document.body.textContent).not.toMatch(/\$\s?\d|per introduction|fee on/i);
  });

  it("says what is in the job packet and what it is not", () => {
    render(<Beta />);
    const packet = screen.getByRole("region", { name: "Your job packet" });
    expect(packet).toHaveTextContent(/Your video and job description, a first look, and a simulation of your site when ready\./);
    expect(packet).not.toHaveTextContent(/early trial|openly available/i);
    expect(packet).toHaveTextContent(/It does not certify performance or safety\./);
    expect(screen.getByRole("region", { name: "For sites" })).toHaveTextContent(/You can post other jobs, too\./);
    expect(packet).not.toHaveTextContent(/proof|guarantee|which did best|AI robot/i);
  });

  it("promises no response from a company", () => {
    render(<Beta />);
    expect(screen.getByRole("region", { name: "Deployment companies" }))
      .toHaveTextContent("A company can answer Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet. We can't promise any will say yes.");
    expect(screen.getByRole("region", { name: "Deployment companies" }))
      .toHaveTextContent("Press Introduce us beside a company that answered Interested or Tested it: can do. We send both sides each other's contact details.");
  });

  it("says who sees the video, what stays with us, how to stop, and who we are", () => {
    render(<Beta />);
    const video = screen.getByRole("region", { name: "Your video" });
    expect(video).toHaveTextContent(/We share it, without its sound, with the deployment companies we approve, so they can decide whether they can do your job\. Your name, address and contact details go to a company only if you ask for an introduction\./);
    expect(video).toHaveTextContent(/A job started before 12 November 2026 is shared only if you agree on its job page\./);
    expect(video).toHaveTextContent(/stop us using your video at any time, from your job page\. Your job then leaves every company's view at once\./);
    expect(video).not.toHaveTextContent(/stays private|summary/);
    const who = screen.getByRole("region", { name: "Who we are" });
    expect(who).toHaveAttribute("id", "who-we-are");
    expect(who).toHaveTextContent(COMPANY.legalName);
    expect(who).toHaveTextContent(COMPANY.mailingAddress);
    expect(screen.getAllByRole("link", { name: "Start a job" })).toHaveLength(1);
  });
});
