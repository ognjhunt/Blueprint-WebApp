import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SampleDeliverables from "@/pages/SampleDeliverables";

describe("SampleDeliverables", () => {
  it("renders the simplified proof-led deliverables page", () => {
    render(<SampleDeliverables />);

    expect(
      screen.getByRole("heading", { name: /Sample deliverables from one real site\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /See the sample contract before the call\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Package and hosted paths, side by side\./i })).toBeInTheDocument();
    expect(screen.getAllByText(/Sample artifact layout/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Download sample manifest/i })).toHaveAttribute(
      "href",
      "/samples/sample-site-package-manifest.json",
    );
    expect(screen.getByRole("link", { name: /Download sample rights sheet/i })).toHaveAttribute(
      "href",
      "/samples/sample-rights-sheet.md",
    );
    expect(screen.getByRole("link", { name: /View sample listing/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
    expect(screen.queryByRole("heading", { name: /Input\/output contract/i })).not.toBeInTheDocument();
  });
});
