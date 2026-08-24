import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Governance from "@/pages/Governance";
import { dataControls, honestEdges } from "@/data/dataHandling";

/**
 * This page makes claims about machinery in another repository. These
 * assertions cannot verify that machinery — only a human re-reading the
 * pipeline can — but they can hold the page to the shape that makes
 * re-verification possible: every claim named with the module that enforces it,
 * and the limits given equal weight to the promises.
 */
describe("Governance data controls", () => {
  it("pairs every control with the mechanism that enforces it", () => {
    render(<Governance />);
    expect(dataControls.length).toBeGreaterThanOrEqual(5);
    dataControls.forEach((control) => {
      expect(screen.getByText(control.claim)).toBeInTheDocument();
      expect(screen.getByText(control.enforcedBy)).toBeInTheDocument();
    });
  });

  it("states the load-bearing controls in the words counsel will look for", () => {
    const { container } = render(<Governance />);
    expect(container).toHaveTextContent(/does not process/i);
    expect(container).toHaveTextContent(/monotone toward denial/i);
    expect(container).toHaveTextContent(/hosted, not downloadable/i);
    expect(container).toHaveTextContent(/revoke after delivery/i);
    expect(container).toHaveTextContent(/byte-exact against the original/i);
  });

  it("gives the limits the same weight as the promises", () => {
    const { container } = render(<Governance />);
    expect(
      screen.getByRole("heading", { name: /What we do not claim/i }),
    ).toBeInTheDocument();
    honestEdges.forEach((edge) => {
      expect(screen.getByText(edge.limit)).toBeInTheDocument();
    });
    // The SOC 2 disclaimer is the one that must never quietly disappear.
    expect(container).toHaveTextContent(/We do not hold SOC 2/i);
  });

  it("does not overstate the suppression control as a rendering claim", () => {
    const { container } = render(<Governance />);
    // The pipeline proves artifact-level exactness, not zero rendered pixels.
    expect(container).not.toHaveTextContent(/zero pixels/i);
    expect(container).toHaveTextContent(/absent from the published artifact/i);
  });

  it("keeps the no-harvesting commitments explicit", () => {
    const { container } = render(<Governance />);
    expect(container).toHaveTextContent(/without a separate, explicit, written agreement/i);
    expect(container).toHaveTextContent(/Evaluation is the product/i);
  });
});
