import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CaptureVisit from "@/pages/CaptureVisit";
import { visitSchedule } from "@/data/captureVisit";

describe("CaptureVisit", () => {
  it("answers the operational question with the run order", () => {
    render(<CaptureVisit />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /We come to you\. One access window\. Nothing left behind/i,
      }),
    ).toBeInTheDocument();
    // Every step renders. Two of the labels ("Clean-background pass",
    // "Object-present pass") also appear in the passes section above, so this
    // asserts presence rather than uniqueness.
    visitSchedule.forEach((step) => {
      expect(screen.getAllByText(step.what).length).toBeGreaterThan(0);
    });
    expect(
      screen.getByRole("heading", { name: /Six steps\. Two of them need your team/i }),
    ).toBeInTheDocument();
  });

  /**
   * A regression guard, not a style preference.
   *
   * This page previously carried a "two and a half hours" headline and a
   * T+0:00-to-T+2:30 schedule that came from a GTM draft rather than from any
   * measured capture. No visit-duration telemetry exists in this repo or in
   * BlueprintCapturePipeline, so a wall-clock figure here is an invented
   * operational promise. The only enforced capture limit is the 45-minute
   * per-capture ceiling, which is cited rather than inferred.
   *
   * If real visit timings ever exist, this test is the thing to change — after
   * the numbers land in `captureVisit.ts` with their source.
   */
  it("makes no unmeasured claim about how long the visit takes", () => {
    const { container } = render(<CaptureVisit />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/two and a half hours/i);
    expect(text).not.toMatch(/T\+\d/);
    expect(text).not.toMatch(/\b(?:two|2)\s*hours?\s*(?:thirty|30)\b/i);
    // The window is a request we make of the site, not a duration we promise.
    expect(text).toMatch(/2–4 hour window with the cell out of production/i);
    // The one ceiling that is actually enforced in software, with its numbers.
    expect(text).toMatch(/A pass cannot run longer than 45 minutes/i);
    expect(text).toMatch(/45 minutes, 20 GiB/i);
  });

  it("states the scope limit and the two-pass order", () => {
    const { container } = render(<CaptureVisit />);
    expect(container).toHaveTextContent(/One workcell\. Not the facility/i);
    expect(container).toHaveTextContent(/We do not roam the building/i);
    expect(container).toHaveTextContent(/Clean-background pass/i);
    expect(container).toHaveTextContent(/Object-present pass/i);
    // The registration requirement is why the order matters.
    expect(container).toHaveTextContent(/registered against each\s+other/i);
  });

  it("carries the turnaround as a target, never as a service level", () => {
    const { container } = render(<CaptureVisit />);
    expect(container).toHaveTextContent(/12–24h/);
    expect(container).toHaveTextContent(
      /a design target we are engineering toward, not a service level we contract to/i,
    );
  });

  it("kills the objections the site operator has not voiced", () => {
    const { container } = render(<CaptureVisit />);
    expect(container).toHaveTextContent(/A normal working cell is the correct input/i);
    expect(container).toHaveTextContent(/Clean the cell to a showroom standard/i);
    expect(container).toHaveTextContent(/Host our hardware/i);
    expect(container).toHaveTextContent(/nothing is left behind/i);
  });

  /**
   * Two facts a site operator must not be able to miss, and which the page has
   * an easy way of blurring: that Blueprint sends the operator (a "handheld
   * rig" reads as self-serve unless it is said outright), and that capture runs
   * in one metro (silence there implies a national footprint we do not have).
   */
  it("makes clear that Blueprint sends the operator, not the site", () => {
    const { container } = render(<CaptureVisit />);
    expect(
      screen.getByRole("heading", {
        name: /We send the operator\. Nobody at your site captures anything/i,
      }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(/trained Blueprint capture operator travels to you/i);
    expect(container).toHaveTextContent(/Do the capture yourself/i);
  });

  it("names the accepted gear as a 360 camera and a smartphone", () => {
    const { container } = render(<CaptureVisit />);
    expect(container).toHaveTextContent(/360 camera and a smartphone/i);
    expect(container).not.toHaveTextContent(/glasses/i);
  });

  it("states the Austin-metro service area rather than implying a footprint", () => {
    const { container } = render(<CaptureVisit />);
    expect(container).toHaveTextContent(/Austin, Texas — one metro, on purpose/i);
    expect(container).toHaveTextContent(/Capture visits run in the Austin metro today/i);
    expect(container).toHaveTextContent(/outside the metro/i);
  });

  /**
   * The page's most load-bearing correction: a capture is not bookable. It is
   * gated on a scoping call and on a real counterparty, and the page has to say
   * so before it describes the day — otherwise the run order reads as a menu.
   */
  it("gates the visit on qualification rather than presenting it as bookable", () => {
    const { container } = render(<CaptureVisit />);
    expect(
      screen.getByRole("heading", {
        name: /Capture is the last step of qualification/i,
      }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(/We do not capture speculatively/i);
    // The call is stated as a gate, not a courtesy.
    expect(container).toHaveTextContent(/Scoping call/i);
    expect(container).toHaveTextContent(/a real gate rather than a courtesy/i);
    // The match is against teams actually in conversation, not a vendor catalogue.
    expect(container).toHaveTextContent(/robot teams we are actually in conversation with/i);
  });

  it("locks the visit logistics in writing before anyone travels", () => {
    const { container } = render(<CaptureVisit />);
    expect(
      screen.getByRole("heading", { name: /Six lines, confirmed in writing/i }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent(/The operator does not travel until every line is filled/i);
    expect(container).toHaveTextContent(/Named contact, plus a backup/i);
    expect(container).toHaveTextContent(/The exact door/i);
  });

  it("routes to intake and to the data controls", () => {
    render(<CaptureVisit />);
    expect(screen.getAllByRole("link", { name: /Submit a site task/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("buyerType=site_operator"),
    );
    expect(
      screen.getAllByRole("link", { name: /data|capture visit/i }).length,
    ).toBeGreaterThan(0);
  });
});
