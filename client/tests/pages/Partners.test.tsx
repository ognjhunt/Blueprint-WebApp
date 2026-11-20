import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Partners from "@/pages/Partners";

describe("the page for deployment companies", () => {
  it("explains the offer and gives new and approved companies their own next step", () => {
    render(<Partners />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find jobs for the robots you deploy.");
    expect(screen.getByText(/When a site asks to meet, we introduce you/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse jobs" })).toHaveAttribute("href", "/contact/robot-team");
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
    expect(within(sample).getByRole("link", { name: "Apply to see live jobs" })).toHaveAttribute("href", "#partner-application");
    expect(screen.getByRole("link", { name: "See a sample job" })).toHaveAttribute("href", "#sample-job");
  });
});
