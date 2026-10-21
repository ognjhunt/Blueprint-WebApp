// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const application = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/robotTeamAccess", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/robotTeamAccess")>(),
  applyForEarlyAccess: application.save,
}));
import { PartnerApplication } from "@/components/site/PartnerApplication";

function completeRequiredFields(role: "deployment" | "technology") {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Alex Example" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "alex@example.com" } });
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Example Robotics" } });
  fireEvent.change(screen.getByLabelText(role === "deployment" ? "What jobs can you deliver?" : "What work should your system be assessed on?"), { target: { value: "Move sealed cases from totes into trays" } });
  fireEvent.change(screen.getByLabelText(role === "deployment" ? "Your delivery capabilities" : "What does your system do?"), { target: { value: "Fixed arm systems with parallel grippers" } });
}

describe("partner applications", () => {
  beforeEach(() => application.save.mockReset());
  afterEach(cleanup);

  it("saves a deployment role and delivery region through the reviewed application path", async () => {
    application.save.mockResolvedValue({ status: "applied", notificationStatus: "queued" });
    render(<PartnerApplication role="deployment" />);
    completeRequiredFields("deployment");
    fireEvent.change(screen.getByLabelText("Where can you install and support systems?"), { target: { value: "Central Texas" } });
    fireEvent.change(screen.getByLabelText("Supported robots and software"), { target: { value: "Franka with a supported policy stack" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply as a deployment partner" }));
    await waitFor(() => expect(application.save).toHaveBeenCalledWith(expect.objectContaining({
      partnerRole: "deployment", region: "Central Texas", supportedSystems: "Franka with a supported policy stack",
      name: "Alex Example", email: "alex@example.com", company: "Example Robotics", acceptedTerms: true, optionalUpdates: false,
    })));
    expect(screen.getByRole("heading", { name: "Your application is saved." })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Applying does not approve access");
  });

  it("retains a technology application when saving fails, and permits a retry", async () => {
    application.save.mockRejectedValueOnce(new Error("network unavailable"));
    render(<PartnerApplication role="technology" />);
    completeRequiredFields("technology");
    fireEvent.click(screen.getByRole("button", { name: "Make your system available" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not confirm"));
    expect(screen.getByLabelText("Company")).toHaveValue("Example Robotics");
    expect(screen.queryByRole("heading", { name: "Your application is saved." })).not.toBeInTheDocument();
    application.save.mockResolvedValueOnce({ status: "applied", notificationStatus: "queued" });
    fireEvent.click(screen.getByRole("button", { name: "Make your system available" }));
    await waitFor(() => expect(application.save).toHaveBeenLastCalledWith(expect.objectContaining({ partnerRole: "technology" })));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your application is saved." })).toBeInTheDocument());
  });

  it("suppresses repeated submission while the first application is saving", async () => {
    let finish!: (value: unknown) => void;
    application.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<PartnerApplication role="technology" />);
    completeRequiredFields("technology");
    const form = screen.getByRole("form", { name: "Technology provider application" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(application.save).toHaveBeenCalledTimes(1);
    finish({ status: "applied", notificationStatus: "queued" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Your application is saved." })).toBeInTheDocument());
  });
});
