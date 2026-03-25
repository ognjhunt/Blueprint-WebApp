import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("covers technical and buyer questions", () => {
    render(<FAQ />);

    expect(screen.getByText(/not a generic benchmark scene or a synthetic environment generator/i)).toBeInTheDocument();
    expect(screen.getByText(/camera poses, intrinsics, site notes, and any available depth or geometry artifacts/i)).toBeInTheDocument();
    expect(screen.getByText(/one hour of self-serve hosted runtime on one exact site/i)).toBeInTheDocument();
  });
});
