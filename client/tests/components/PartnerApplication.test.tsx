// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const application = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/robotTeamAccess", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/robotTeamAccess")>(),
  applyForEarlyAccess: application.save,
}));
import { PartnerApplication } from "@/components/site/PartnerApplication";

function completeRequiredFields() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Alex Example" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Example Robotics" } });
  fireEvent.change(screen.getByLabelText("Company website"), { target: { value: "https://example.com" } });
}

describe("the one company application", () => {
  beforeEach(() => application.save.mockReset());
  afterEach(cleanup);

  it("asks four fields, agrees to nothing, and saves them through the reviewed application path", async () => {
    application.save.mockResolvedValue({ status: "applied", notificationStatus: "queued" });
    render(<PartnerApplication />);
    const form = screen.getByRole("form", { name: "Deployment company application" });
    expect([...form.querySelectorAll("input, textarea")].map(field => field.getAttribute("name")))
      .toEqual(["name", "email", "company", "website"]);
    // A notice, not a tick: no box, and no sentence saying that applying agrees to anything.
    expect(form.querySelector('input[type="checkbox"]')).toBeNull();
    expect(form.textContent).not.toMatch(/By applying|agree|Blueprint updates/i);
    // The website is shown and required: the approver's one automatic sign that the company is real.
    expect(screen.getByLabelText("Company website")).toBeVisible();
    expect(screen.getByLabelText("Company website")).toBeRequired();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    completeRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(application.save).toHaveBeenCalledWith({
      partnerRole: "deployment", name: "Alex Example", email: "alex@example.com", company: "Example Robotics", website: "https://example.com",
    }));
    expect(screen.getByRole("heading", { name: "Your application is saved." })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("We'll email you our answer within three working days.");
    expect(screen.getByRole("status").textContent).not.toMatch(/contact you when|when a job and what you do fit/i);
  });

  it("keeps the entries when saving fails, and permits a retry", async () => {
    application.save.mockRejectedValueOnce(new Error("network unavailable"));
    render(<PartnerApplication />);
    completeRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not confirm"));
    expect(screen.getByLabelText("Company")).toHaveValue("Example Robotics");
    expect(screen.queryByRole("heading", { name: "Your application is saved." })).not.toBeInTheDocument();
    application.save.mockResolvedValueOnce({ status: "applied", notificationStatus: "queued" });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your application is saved." })).toBeInTheDocument());
  });

  it("suppresses repeated submission while the first application is saving", async () => {
    let finish!: (value: unknown) => void;
    application.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<PartnerApplication />);
    completeRequiredFields();
    const form = screen.getByRole("form", { name: "Deployment company application" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(application.save).toHaveBeenCalledTimes(1);
    finish({ status: "applied", notificationStatus: "queued" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your application is saved." })).toBeInTheDocument());
  });
});
