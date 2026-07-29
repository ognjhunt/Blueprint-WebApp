import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import Overview from "@/pages/app/Overview";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userData: { buyerType: "robot_team" } }),
}));

vi.mock("@/components/blueprint/app/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/buyerAppData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/buyerAppData")>();
  return {
    ...actual,
    useBuyerAppEntitlements: () => ({
      entitlements: [],
      provisionedEntitlements: [],
      reviewEntitlements: [],
      revokedEntitlements: [],
      isLoading: false,
      error: null,
    }),
    useBuyerAppRuns: () => ({
      runs: [
        {
          job_id: "request-001",
          decision_question: "Should candidate A receive field time?",
          status: "planning",
          created_at_iso: "2026-07-29T12:00:00-05:00",
        },
      ],
      isLoading: false,
      error: null,
    }),
  };
});

describe("authenticated overview", () => {
  it("leads with the testbed/run/result lifecycle instead of standalone commerce", () => {
    render(<Overview />);
    expect(screen.getByRole("heading", { name: "Task Evaluation Runs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a Task Evaluation Run" })).toHaveAttribute("href", "/app/runs/new");
    expect(screen.getByText("Should candidate A receive field time?")).toBeInTheDocument();
    expect(screen.queryByText("Licensed Blueprint access")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add access" })).not.toBeInTheDocument();
  });
});
