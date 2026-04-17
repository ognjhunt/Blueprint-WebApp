import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("covers technical and buyer questions", () => {
    render(<FAQ />);

    expect(screen.getByText(/not a generic benchmark scene or a synthetic environment generator/i)).toBeInTheDocument();
    expect(screen.getByText(/camera poses, intrinsics, site notes, and any available depth or geometry artifacts/i)).toBeInTheDocument();
    expect(screen.getByText(/one hour of self-serve hosted runtime on one exact site/i)).toBeInTheDocument();
    expect(screen.getByText(/exact-site proof means the facility in the package or hosted session is the actual place the buyer cares about/i)).toBeInTheDocument();
    expect(screen.getByText(/adjacent-site proof means a clearly labeled nearby or similar site/i)).toBeInTheDocument();
    expect(screen.getByText(/a buyer can bring a policy, checkpoint, stack adapter, teleop surface, or evaluation contract into the scoping conversation/i)).toBeInTheDocument();
    expect(screen.getByText(/Request-scoped commercial review means the public listing is readable, not that Blueprint is claiming blanket site approval/i)).toBeInTheDocument();
    expect(screen.getByText(/If your team does not have a target facility or workflow lane yet, exact-site work is usually too early/i)).toBeInTheDocument();
  });
});
