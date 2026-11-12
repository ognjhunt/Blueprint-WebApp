import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SiteScreeningCallPanel } from "@/components/admin/SiteScreeningCallPanel";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));

const triage = (disposition: "not_now" | "needs_conversation") => ({
  disposition, blocking_field_ids: [], blockers: [], open_questions: [], open_question_field_ids: [],
  unanswered_field_ids: [], incomplete: false, evaluated_at: "2026-11-12T00:00:00Z",
}) as never;

function renderPanel(disposition: "not_now" | "needs_conversation", screenGateEnded?: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SiteScreeningCallPanel requestId="job-1" triage={triage(disposition)} gatesOnFile={{}} briefConfirmed
        {...(screenGateEnded === undefined ? {} : { screenGateEnded })} />
    </QueryClientProvider>,
  );
}

// Owner decision 2026-11-11: for a job uploaded after the cutover the screen's
// reading is a note; staff are never told its scene is not being built.
describe("SiteScreeningCallPanel", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ revision: "r1" }), { status: 200 }));
  });

  it.each(["not_now", "needs_conversation"] as const)("notes a %s reading on a job past the cutover without claiming no scene", disposition => {
    renderPanel(disposition, true);
    const verdict = screen.getByText(/Verdict:/).textContent ?? "";
    expect(verdict).not.toMatch(/no scene/i);
    expect(verdict).toMatch(/a note: the scene is built whatever the screen says/i);
  });

  it("keeps the old wording for a job uploaded before the cutover", () => {
    renderPanel("not_now");
    expect(screen.getByText(/Verdict:/).textContent).toMatch(/no scene; an answer only the site can change blocks it/);
  });
});
