import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteAnswer } from "@/components/site/SiteAnswer";
import { cannotAssessAnswer, noPickAnswer, readingAnswer, readyAnswer } from "../fixtures/siteAnswer";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "local-test" }) }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

/** Words a site manager should never meet on the answer, and anything that looks like a raw code. */
const BANNED = /episode|candidate|screening|embodiment|checkpoint|policy|[a-z]_[a-z]|sha256/i;

describe("the site's answer", () => {
  it("leads with the pick, its checks, its sourced figures and its sourced track record", () => {
    render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    expect(screen.getByRole("heading", { name: "Your answer" })).toBeVisible();
    expect(screen.getByText(readyAnswer.headline)).toBeVisible();
    expect(screen.getByText(/We read your job as: “Move cartons from the end of the conveyor onto the pallet”\. If that is wrong, correct it below\./)).toBeVisible();
    const pick = screen.getByRole("article", { name: "Our pick" });
    expect(within(pick).getByRole("heading", { name: "Universal Robots UR10e" })).toBeVisible();
    expect(within(pick).getByText("One arm that stays in one place")).toBeVisible();
    expect(within(pick).getByText("Fits on paper")).toBeVisible();
    for (const check of readyAnswer.pick!.checks) expect(within(pick).getByText(check.text)).toBeVisible();
    const sources = within(pick).getAllByRole("link", { name: "source" });
    expect(sources.map(link => link.getAttribute("href"))).toEqual(readyAnswer.pick!.specs.map(spec => spec.sourceUrl));
    expect(within(pick).getByText("In production use")).toBeVisible();
    expect(within(pick).getByText(`“${readyAnswer.pick!.evidence[0].quote}”`)).toBeVisible();
    expect(within(pick).getByRole("link", { name: /TEST case study: carton palletizing with the UR10e, Example Test News, March 1, 2025/ }))
      .toHaveAttribute("href", readyAnswer.pick!.evidence[0].sourceUrl);
    expect(within(pick).getByText(/for this maker, not this model by name/)).toBeVisible();
    expect(screen.getByText(`How it would be controlled: ${readyAnswer.approach!.text}`)).toBeVisible();

    const runnerUp = screen.getByRole("article", { name: "Runner-up" });
    expect(within(runnerUp).getByRole("heading", { name: "Yaskawa HC20DTP" })).toBeVisible();
    expect(within(runnerUp).queryByRole("list")).toBeNull();
    expect(screen.getByText("Also fit on paper: Universal Robots UR20, Universal Robots UR30, ABB GoFa CRB 15000-12/1.27.")).toBeVisible();

    const ruledOut = screen.getByText("Ruled out (11)").closest("details")!;
    expect(ruledOut).not.toHaveAttribute("open");
    expect(within(ruledOut).getByText("And 9 more.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What we could not tell from your video" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "How sure we are: Fair" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "What would raise it" })).toBeVisible();
    const numbers = screen.getByRole("heading", { name: "The numbers this rests on" }).parentElement!;
    expect(within(numbers).getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "Weight of each carton: 8–11 kg (estimated from your video)",
      "Distance between the two spots: about 1.6 m (estimated from your video)",
      "Height of the pallet stack: up to 1.2 m (you told us)",
    ]);
    expect(screen.getByText(new RegExp(readyAnswer.note.slice(0, 40)))).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ask for an introduction" })).toBeVisible();
  });

  it("never shows a site a banned word or a raw code", () => {
    const { container } = render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    expect(container.textContent).not.toMatch(BANNED);
    for (const answer of [noPickAnswer, cannotAssessAnswer, readingAnswer]) {
      const { container: other, unmount } = render(<SiteAnswer token="owner-token" answer={answer} />);
      expect(other.textContent).not.toMatch(BANNED);
      unmount();
    }
  });

  it("says why there is no pick, with the numbers, and offers no button", () => {
    render(<SiteAnswer token="owner-token" answer={noPickAnswer} />);
    expect(screen.getByText(noPickAnswer.headline)).toBeVisible();
    expect(screen.getByText(noPickAnswer.reason!)).toBeVisible();
    expect(screen.getByText(/about 180 kg/)).toBeVisible();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([["cannot_assess", cannotAssessAnswer], ["reading", readingAnswer]] as const)("shows the %s state as its headline and reason only", (_, answer) => {
    render(<SiteAnswer token="owner-token" answer={answer} />);
    expect(screen.getByText(answer.headline)).toBeVisible();
    if (answer.reason) expect(screen.getByText(answer.reason)).toBeVisible();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/How sure we are/)).toBeNull();
  });

  it("asks for an introduction once and then says so with the date", async () => {
    const onRequested = vi.fn();
    fetchMock.mockResolvedValue(response({ ok: true, requestedAtIso: "2026-11-11T15:00:00.000Z" }));
    render(<SiteAnswer token="owner token" answer={readyAnswer} onIntroductionRequested={onRequested} />);
    const button = screen.getByRole("button", { name: "Ask for an introduction" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent("You asked for an introduction on November 11, 2026. Blueprint will reply by email.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/owner%20token/introduction-request", expect.objectContaining({
      method: "POST", referrerPolicy: "no-referrer", headers: expect.objectContaining({ "X-CSRF-Token": "local-test" }) }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(onRequested).toHaveBeenCalledTimes(1);
  });

  it("keeps the button with one plain sentence when the request fails", async () => {
    fetchMock.mockResolvedValue(response({ error: "introduction_request_failed" }, 500));
    render(<SiteAnswer token="owner-token" answer={readyAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask for an introduction" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your request just now. Try again shortly.");
    expect(screen.getByRole("button", { name: "Ask for an introduction" })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/introduction_request_failed/);
  });

  it("shows a stored request instead of the button", () => {
    render(<SiteAnswer token="owner-token" answer={{ ...readyAnswer, introductionRequestedAtIso: "2026-11-10T09:00:00.000Z" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("You asked for an introduction on November 10, 2026. Blueprint will reply by email.");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
