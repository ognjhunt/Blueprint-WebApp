/**
 * The contact screens, as a screen.
 *
 * These pin the properties that make the form worth filling in: gate answers
 * leave as enums rather than prose, a blocked site is told what would flip it
 * before submitting, and the expensive questions stay hidden until the cheap
 * ones pass.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockLocation = "/contact/site-operator";
vi.mock("wouter", () => ({ useLocation: () => [mockLocation, vi.fn()] }));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({
    ...headers,
    "X-CSRF-Token": "test-token",
  }),
}));

beforeEach(() => {
  mockLocation = "/contact/site-operator";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "test-uuid" });
});

/** Answers that clear every site gate. */
const CLEAR_GATES: Record<string, string> = {
  serviceArea: "austin_metro",
  sceneStability: "stable",
  taskShape: "single",
  objectVariety: "under_10",
  deploymentTimeline: "this_quarter",
  accessWindow: "scheduled",
};

function answerGates(answers: Record<string, string>) {
  for (const [fieldId, value] of Object.entries(answers)) {
    fireEvent.change(document.querySelector(`#gate-${fieldId}`)!, { target: { value } });
  }
}

function fillContact() {
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "  Test Person  " },
  });
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "person@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Company"), {
    target: { value: "Example Company" },
  });
}

function sentBody() {
  return JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
}

describe("Minimal public screening", () => {
  it("posts gate answers as enums to the inbound-request pipeline with CSRF", async () => {
    render(<Contact />);
    answerGates(CLEAR_GATES);
    fillContact();
    fireEvent.change(document.querySelector("#contact-site-address")!, {
      target: { value: "1100 E 5th St, Austin, TX" },
    });
    fireEvent.change(document.querySelector("#prose-taskDescription")!, {
      target: { value: "Totes move from the conveyor to a pallet." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      "/api/inbound-request",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "test-token" }),
      }),
    );

    const body = sentBody();
    // The point of the change: structured answers, not a prose blob.
    expect(body.siteTaskGates).toEqual(CLEAR_GATES);
    expect(body.buyerType).toBe("site_operator");
    expect(body.firstName).toBe("Test");
    expect(body.taskDescription).toContain("Totes move from the conveyor");
  });

  it("shows a blocked site what would flip it, before it submits", async () => {
    render(<Contact />);
    answerGates({ ...CLEAR_GATES, serviceArea: "outside_texas" });

    expect(await screen.findByText(/Not yet/i)).toBeInTheDocument();
    // A rejection that names the change is a reason to come back. It shows in
    // both the summary line and the itemised blocker, so match either.
    expect(screen.getAllByText(/Expansion beyond Texas/i).length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the spec questions hidden until the gates pass", async () => {
    render(<Contact />);
    expect(document.querySelector("#spec-cycleTime")).toBeNull();

    answerGates(CLEAR_GATES);
    await waitFor(() => expect(document.querySelector("#spec-cycleTime")).not.toBeNull());
  });

  it("does not ask a robot team the site gates", () => {
    mockLocation = "/contact/robot-team";
    render(<Contact />);
    expect(document.querySelector("#gate-serviceArea")).toBeNull();
    expect(document.querySelector("#gate-hardwareMaturity")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Send application" })).toBeInTheDocument();
  });

  it("refuses to submit until the required fields are there", async () => {
    render(<Contact />);
    answerGates(CLEAR_GATES);
    fireEvent.submit(screen.getByRole("form"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/complete all required fields/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains what was typed when the submission fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Service temporarily unavailable" }) }),
    );
    render(<Contact />);
    answerGates(CLEAR_GATES);
    fillContact();
    fireEvent.change(document.querySelector("#contact-site-address")!, {
      target: { value: "1100 E 5th St, Austin, TX" },
    });
    fireEvent.change(document.querySelector("#prose-taskDescription")!, {
      target: { value: "Totes move from the conveyor to a pallet." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Service temporarily unavailable/i);
    // The form stays filled so the visitor can retry without starting over.
    expect(screen.getByLabelText("Company")).toHaveValue("Example Company");
    expect(document.querySelector<HTMLSelectElement>("#gate-serviceArea")!.value).toBe(
      "austin_metro",
    );
  });
});
