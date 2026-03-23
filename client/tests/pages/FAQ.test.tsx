import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FAQ from "@/pages/FAQ";

describe("FAQ", () => {
  it("covers technical and buyer questions", () => {
    render(<FAQ />);

    expect(screen.getByText(/not a synthetic environment generator/i)).toBeInTheDocument();
    expect(screen.getByText(/Common outputs include walkthrough video, camera poses/i)).toBeInTheDocument();
    expect(screen.getByText(/managed browser path into one exact site/i)).toBeInTheDocument();
  });
});
