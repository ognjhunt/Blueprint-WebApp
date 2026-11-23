import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import Partners from "@/pages/Partners";

describe("the page for deployment companies", () => {
  afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
  it("explains the offer and gives new and approved companies their own next step", () => {
    render(<Partners />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find jobs for the robots you deploy.");
    expect(screen.getByText(/When a site asks to meet, we introduce you/)).toBeVisible();
    expect(screen.getByText(/Review real jobs, each with the site's video and description\./)).toBeVisible();
    expect(screen.getByRole("link", { name: "See jobs" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.getByRole("form", { name: "Deployment company application" })).toBeVisible();
    expect(document.body.textContent).not.toMatch(/\btest (?:it|on|in)\b|to test\b|can test\b/i);
  });

  // Owner, 2026-11-20: the Find jobs page shows one sample job, laid out as a live job, so a company sees what it gets.
  it("shows one sample job, said to be stock footage and not a live job where it starts, with no sound", () => {
    render(<Partners />);
    const sample = screen.getByRole("region", { name: "Load parcels onto a hand truck" });
    expect(within(sample).getByText("Sample job")).toBeVisible();
    expect(within(sample).getByText("Stock footage, not a live job. No site posted it.")).toBeVisible();
    expect(within(sample).getByText("Pick up each parcel and stack it on the hand truck.")).toBeVisible();
    const video = within(sample).getByLabelText("Sample video, without sound") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", "/samples/sample-job-parcels.mp4");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("preload", "none");
    // The clip's license (Mixkit, free) is credited beside it.
    expect(within(sample).getByText(/^Video: Mixkit, free license\./)).toBeVisible();
    // A live job's simulation and first look are named, never imitated: no viewer, download or result on the sample.
    expect(within(sample).queryByRole("link", { name: /Download|View the simulation/ })).toBeNull();
    expect(within(sample).getByRole("link", { name: "Apply to see jobs" })).toHaveAttribute("href", "#partner-application");
    // Launch copy (2026-11-20): what a live job can include, the answers without a timing promise, and the privacy line
    // where the introduction is explained.
    expect(within(sample).getByRole("heading", { name: "A live job can also include" })).toBeVisible();
    expect(within(sample).getByText("Choose Apply, Not a fit or Need more details. Once you can download the simulation, you can also choose Tested it: can do or Tested it: cannot yet.")).toBeVisible();
    expect(within(sample).getByText("The site sees your company's name and website when you answer. You see no site name, address or contact details until the site accepts you. Then we email you both each other's details.")).toBeVisible();
    expect(sample).not.toHaveTextContent(/in a minute|busiest/);
    expect(screen.getByRole("link", { name: "See a sample job" })).toHaveAttribute("href", "#sample-job");
  });

  it("shows the sample job before the application, and /jobs#sample-job opens on the sample", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.replaceState(null, "", "/jobs#sample-job");
    render(<Partners />);
    const sample = document.getElementById("sample-job")!;
    const application = screen.getByRole("form", { name: "Deployment company application" });
    expect(sample.compareDocumentPosition(application) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(sample);
  });
});
