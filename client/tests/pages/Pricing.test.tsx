import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Pricing from "@/pages/Pricing";

describe("Pricing", () => {
  it("aligns public pricing with the current catalog ranges", () => {
    render(<Pricing />);

    expect(screen.getByText(/\$2,100-\$3,400 per site package/i)).toBeInTheDocument();
    expect(screen.getByText(/\$16 and \$29 per session-hour/i)).toBeInTheDocument();
    expect(screen.getByText(/\$2,100 - \$3,400/i)).toBeInTheDocument();
  });
});
