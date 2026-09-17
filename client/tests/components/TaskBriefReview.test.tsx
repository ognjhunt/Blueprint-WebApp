// @vitest-environment jsdom
/**
 * The click that was missing.
 *
 * Tier 2 built the brief, the attestation, and the readiness ladder, and
 * shipped no way for an operator to confirm anything — so no site could reach
 * `qualified` through the new path, and the dead end was still a dead end. This
 * is the UI that closes it, so these tests pin the two things that make it an
 * attestation rather than a form: the operator's correction is what gets sent,
 * and "I am not sure" is a real answer that neither loops nor blocks.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

import { TaskBriefReview, type DraftedBrief } from "@/components/site/TaskBriefReview";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A brief with one confirmable answer and one open question. */
function brief(overrides: Partial<DraftedBrief> = {}): DraftedBrief {
  return {
    summary: "Cartons from a conveyor onto a pallet",
    captureMode: "self_capture",
    proposed: [
      {
        fieldId: "sceneStability",
        value: "stable",
        basis: "observation",
        reading: "The pallet station does not move between the clips.",
      },
      {
        fieldId: "objectVariety",
        value: "under_10",
        basis: "assumption",
        reading: "Guessing from the description; please confirm.",
      },
    ],
    unresolved: ["accessWindow"],
    ...overrides,
  };
}

function lastConfirmBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/confirm"));
  return JSON.parse((call?.[1] as { body: string }).body);
}

describe("confirming a brief is an attestation", () => {
  it("shows what we understood, with where each answer came from", () => {
    render(<TaskBriefReview token="tok" brief={brief()} />);

    expect(screen.getByText(/Cartons from a conveyor onto a pallet/)).toBeInTheDocument();
    // The confirmable answer shows its basis.
    expect(screen.getByText(/from your footage/i)).toBeInTheDocument();
    // The assumption is not pre-filled as an answer -- it is an open question,
    // and so is the unresolved gate. Both show the open-question copy.
    expect(screen.getAllByText(/could not tell from what you sent/i).length).toBe(2);
  });

  it("sends the operator's name and their correction, not our reading", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, disposition: "qualified", stage: "capture_needed", nextAction: "Film it." }),
    });

    render(<TaskBriefReview token="tok" brief={brief()} />);

    // Correct the one confirmable answer.
    fireEvent.change(screen.getByLabelText(/change it/i), { target: { value: "reconfigured" } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana Okafor" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    await waitFor(() => expect(screen.getByText(/that is confirmed/i)).toBeInTheDocument());

    const body = lastConfirmBody();
    expect(body.confirmedBy).toBe("Dana Okafor");
    expect((body.answers as Record<string, string>).sceneStability).toBe("reconfigured");
  });

  it("treats 'I am not sure' on an open question as unknown, and still confirms", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, disposition: "needs_conversation", stage: "capture_needed", nextAction: "Film it." }),
    });

    render(<TaskBriefReview token="tok" brief={brief()} />);

    // The open question defaults to unset; choosing "not sure" records it as
    // unknown rather than looping or blocking.
    const openSelect = screen.getByLabelText(/idle and clear|access|clear of untrained/i);
    fireEvent.change(openSelect, { target: { value: "__unknown" } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    await waitFor(() => expect(screen.getByText(/that is confirmed/i)).toBeInTheDocument());

    const body = lastConfirmBody();
    expect(body.unknown).toContain("accessWindow");
    expect((body.answers as Record<string, string>).accessWindow).toBeUndefined();
  });

  it("refuses to confirm without a name, because an attestation needs one", async () => {
    render(<TaskBriefReview token="tok" brief={brief()} />);

    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/add your name/i);
    // Nothing was sent.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/confirm"))).toBe(false);
  });

  it("surfaces the next action the verdict returns, not a raw disposition", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        disposition: "qualified",
        stage: "capture_needed",
        nextAction: "We have enough to guide the recording. Film the work area now.",
        stillNeeded: ["deploymentTimeline"],
      }),
    });

    render(<TaskBriefReview token="tok" brief={brief()} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm it/i }));

    await waitFor(() =>
      expect(screen.getByText(/enough to guide the recording/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/deploymentTimeline/)).toBeInTheDocument();
  });
});
