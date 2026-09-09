import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockLocation = "/contact/site-operator";
vi.mock("wouter", () => ({ useLocation: () => [mockLocation, vi.fn()] }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "test-token" }) }));

beforeEach(() => {
  mockLocation = "/contact/site-operator";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

function fillForm() {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "  Test Person  " } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Example Company" } });
  fireEvent.change(screen.getByRole("textbox", { name: /What (task|does)/ }), { target: { value: "A bounded pick-and-place workcell in Raleigh." } });
}

function sentBody() {
  return JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
}

describe("Minimal public inquiries", () => {
  it("submits site persona and pilot context through the durable contact API with CSRF", async () => {
    render(<Contact />);
    fillForm();
    fireEvent.change(screen.getByLabelText("Evaluation budget"), { target: { value: "Approved" } });
    fireEvent.change(screen.getByLabelText(/Pilot window/), { target: { value: "Q1 2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));
    await screen.findByRole("heading", { name: "Your inquiry is in." });
    expect(fetch).toHaveBeenCalledWith("/api/contact", expect.objectContaining({ method: "POST", credentials: "include", headers: expect.objectContaining({ "X-CSRF-Token": "test-token" }) }));
    expect(sentBody()).toMatchObject({ name: "Test Person", engagementScope: "site_operator", requestSource: "website-contact-form", projectType: "Site-funded Task Evaluation Run" });
    expect(sentBody().message).toContain("Evaluation budget: Approved");
    expect(sentBody().message).toContain("Pilot window: Q1 2027");
  });
  it("keeps robot participation distinct from a paid buyer inquiry", async () => {
    mockLocation = "/contact/robot-team";
    render(<Contact />);
    expect(screen.queryByLabelText("Evaluation budget")).not.toBeInTheDocument();
    expect(screen.getByText(/does not guarantee either/)).toBeInTheDocument();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await screen.findByRole("heading", { name: "Your application is in." });
    expect(sentBody()).toMatchObject({ engagementScope: "robot_team", projectType: "Robot team participation" });
    expect(sentBody().message).toContain("Robot team application");
    expect(sentBody().message).not.toContain("Evaluation budget");
  });
  it("retains input and permits retry after a server failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    render(<Contact />);
    fillForm();
    fireEvent.change(screen.getByLabelText("Evaluation budget"), { target: { value: "Seeking approval" } });
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Company")).toHaveValue("Example Company");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));
    await screen.findByRole("status");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not acknowledge a network failure as success", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<Contact />); fillForm();
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Send inquiry" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("blocks whitespace-only required fields", async () => {
    render(<Contact />); fillForm();
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByRole("alert")).toHaveTextContent("Please complete all required fields.");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("prevents duplicate requests while one is pending", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<Contact />); fillForm();
    fireEvent.submit(screen.getByRole("form")); fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    resolve({ ok: true } as Response);
    await screen.findByRole("status");
  });
});
