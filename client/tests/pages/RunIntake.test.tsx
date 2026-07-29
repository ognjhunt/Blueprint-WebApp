import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import RunIntake from "@/pages/app/RunIntake";

const navigate = vi.fn();
const getIdToken = vi.fn(async () => "buyer-token");

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return { ...actual, useLocation: () => ["/app/runs/new", navigate] };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: {
      uid: "buyer-001",
      email: "buyer@example.com",
      getIdToken,
    },
    loading: false,
  }),
}));

vi.mock("@/components/blueprint/app/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("Task Evaluation Run intake", () => {
  beforeEach(() => {
    navigate.mockReset();
  });

  it("submits a decision contract without a client-selected simulator or price", async () => {
    let submitted: Record<string, unknown> | null = null;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/csrf") {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/api/task-evaluation-runs") {
        submitted = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        return new Response(JSON.stringify({ ok: true, status: "submitted" }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(<RunIntake />);

    fill("Testbed ID", "testbed-001");
    fill("Testbed version", "2026-07-29.1");
    fill("Testbed manifest digest", `sha256:${"a".repeat(64)}`);
    fill("Site ID", "site-001");
    fill("Task ID", "task-001");
    fill("Task description", "Move a tote to the fixture.");
    fill("Site and task conditions (one per line)", "dry floor\nday shift");
    fill("What decision do you need to make?", "Should candidate A receive field time?");
    fill("Candidates or policies, if applicable (one per line)", "Candidate A");
    fill("Decision-relevant claims (one per line)", "Candidate A can reach the fixture.");
    fill("Primary success metric", "reach success rate");
    fill("Minimum value", "0.95");
    fill("Unit", "ratio");
    fill("Acceptable risk or confidence requirement", "At most five percent false-safe risk.");
    fill("Unacceptable failures", "Fixture collision");
    fill("Consequence of a false-safe", "Could damage the fixture.");
    fill("Budget ceiling (USD)", "5000");
    fill("Decision deadline", "2026-08-15T17:00");
    fill("Allowed site changes (one per line)", "Move marker within 10 cm");
    fill("Rights, privacy, and provider restrictions (one per line)", "No raw video outside Blueprint storage");
    fireEvent.click(screen.getByLabelText("Authoritative physical testing is possible for this task"));
    fireEvent.click(screen.getByRole("button", { name: "Request a Task Evaluation Run" }));

    await waitFor(() => expect(submitted).not.toBeNull());
    const serialized = JSON.stringify(submitted);
    expect(submitted).toMatchObject({
      schema_version: "blueprint.decision_evidence_request.v1",
      decision_question: "Should candidate A receive field time?",
      routing_authority: {
        system: "BlueprintCapturePipeline",
        method_selection: "pipeline_qualified_least_cost_sufficient_evidence",
        webapp_backend_selection_allowed: false,
      },
      commercial: {
        engagement: "scoped_task_evaluation_run",
        quote_required: true,
        client_supplied_price: false,
      },
    });
    expect(serialized).not.toMatch(/mujoco|isaac|cosmos|oscar/i);
    expect(serialized).not.toMatch(/client_supplied_price\":true|price_cents|amount_cents/i);
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/runs\/request-/));
  });

  it("does not ask an ordinary user to choose an evaluation backend", () => {
    render(<RunIntake />);
    expect(screen.getByRole("heading", { name: /Describe the decision/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/MuJoCo|Isaac|Cosmos|OSCAR/);
  });
});
