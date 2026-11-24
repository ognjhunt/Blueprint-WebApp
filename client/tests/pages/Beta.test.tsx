import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Beta from "@/pages/Beta";
import { COMPANY } from "@/data/company";

// The Questions page (bare bones; frame of 2026-11-12): the one details screen for the public pages, in short rows.
describe("the questions page", () => {
  it("answers cost, which jobs and where, without a reply time, a refunds link or a price", () => {
    render(<Beta />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Questions");
    const sites = screen.getByRole("region", { name: "For sites" });
    expect(sites).toHaveAttribute("id", "scope");
    expect(sites).toHaveTextContent(/Cost\s*Free for sites\./);
    expect(sites).toHaveTextContent(/Jobs\s*Any job someone does over and over, like moving boxes, loading a cart or sorting items\./);
    expect(sites).toHaveTextContent(/Where\s*We take videos only from sites in the United States\./);
    // Launch copy (2026-11-20): no promised reply time, and no refunds link beside the only money sentence.
    expect(document.body.textContent).not.toMatch(/reply within|Refunds/i);
    expect(screen.queryByRole("link", { name: /Refunds/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$\s?\d|per introduction|fee on/i);
  });

  it("says what is in the job packet and what it is not", () => {
    render(<Beta />);
    const packet = screen.getByRole("region", { name: "Your job packet" });
    expect(packet).toHaveTextContent(/Your video and job description, a first look, and a simulation of your site when ready\./);
    expect(packet).not.toHaveTextContent(/early trial|openly available/i);
    expect(packet).toHaveTextContent(/It does not certify performance or safety\./);
    expect(packet).not.toHaveTextContent(/proof|guarantee|which did best|AI robot/i);
  });

  it("promises no response from a company", () => {
    render(<Beta />);
    expect(screen.getByRole("region", { name: "Deployment companies" }))
      .toHaveTextContent("A company can choose Apply, Not a fit or Need more details. Once the simulation can be downloaded, it can also choose Tested it: can do or Tested it: cannot yet. We can't promise any will say yes.");
    expect(screen.getByRole("region", { name: "Deployment companies" }))
      .toHaveTextContent("You see each company's name and website with its answer. Press Accept beside a company that applied or answered Tested it: can do to meet it. We email the company your email address and the place you gave us, and email you theirs.");
  });

  it("says who sees the video, what stays with us, how to stop, and who we are", () => {
    render(<Beta />);
    const video = screen.getByRole("region", { name: "Your video" });
    expect(video).toHaveTextContent(/We share it, without its sound, with the deployment companies we approve, so they can decide whether they can do your job\. Your name, address and contact details go to a company only if you accept it\./);
    expect(video).toHaveTextContent(/Who sees it\s*We share it, without its sound/);
    expect(video).toHaveTextContent("Sending a job means we share it. You agree to that once, when you send. If your job page asks you to agree, we share the job only after you do.");
    expect(video).not.toHaveTextContent(/12 November 2026/);
    expect(video).toHaveTextContent(/stop us using your video at any time, from your job page\. Your job then leaves every company's view at once\./);
    expect(video).toHaveTextContent("We ask any company that saved a copy to delete it, but we cannot take that copy back.");
    expect(video).not.toHaveTextContent(/stays private|summary/);
    const who = screen.getByRole("region", { name: "Who we are" });
    expect(who).toHaveAttribute("id", "who-we-are");
    expect(who).toHaveTextContent(COMPANY.legalName);
    expect(who).toHaveTextContent(COMPANY.mailingAddress);
    expect(screen.getAllByRole("link", { name: "Start a job" })).toHaveLength(1);
  });
});
