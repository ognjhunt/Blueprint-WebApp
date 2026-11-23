import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdatePreferencesForm } from "@/components/workspace/UpdatePreferencesForm";
import type { UpdatePreferences } from "@/types/updatePreferences";

/**
 * Settings asks only what each account needs (launch copy, decision 10): two email switches, the job-email one for a
 * deployment company only, and no targeting fields, which never changed who is emailed.
 */
const stored: UpdatePreferences = {
  newsletter: false, newJobAlerts: false,
  source: "settings", updatedAtIso: "2026-11-19T10:00:00.000Z", version: "optional-updates-v2",
};

describe("Settings email choices", () => {
  it("shows a deployment company both boxes and saves what it sees and nothing else", () => {
    const save = vi.fn();
    render(<UpdatePreferencesForm preferences={stored} pending={false} save={save} jobEmails />);
    expect(screen.getByRole("heading", { name: "Emails" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Email me about each new job" }));
    fireEvent.click(screen.getByRole("button", { name: "Save email choices" }));
    expect(save).toHaveBeenCalledWith({ newsletter: false, newJobAlerts: true });
  });

  it("does not show a site the job-email box, and leaves its stored value alone", () => {
    const save = vi.fn();
    render(<UpdatePreferencesForm preferences={stored} pending={false} save={save} jobEmails={false} />);
    expect(screen.queryByRole("checkbox", { name: "Email me about each new job" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Blueprint news and updates" }));
    fireEvent.click(screen.getByRole("button", { name: "Save email choices" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ newsletter: true, newJobAlerts: false }));
  });

  it("has no targeting fields and no internal words", () => {
    render(<UpdatePreferencesForm preferences={null} pending={false} save={vi.fn()} jobEmails />);
    expect(screen.getByText("Emails about your account and your jobs still come. Unsubscribe anytime.")).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/Targeting|Embodiments|Policy categories|retention|rights scopes|suppression|\(optional\)/i);
  });
});
