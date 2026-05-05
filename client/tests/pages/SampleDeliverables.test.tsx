import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SampleDeliverables from "@/pages/SampleDeliverables";

describe("SampleDeliverables", () => {
  it("renders the simplified proof-led deliverables page", () => {
    render(<SampleDeliverables />);

    expect(
      screen.getByRole("heading", { name: /Sample deliverables from one real site\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /See the sample files before the call\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Public capture can start with everyday places\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Open the sample files\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Not just facilities\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Package and hosted paths, side by side\./i })).toBeInTheDocument();
    expect(screen.getAllByText(/Sample manifest layout/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Hosted report example/i)).toBeInTheDocument();
    expect(screen.getByText(/Export tree example/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download sample manifest/i })).toHaveAttribute(
      "href",
      "/samples/sample-site-package-manifest.json",
    );
    expect(screen.getByRole("link", { name: /Download sample rights sheet/i })).toHaveAttribute(
      "href",
      "/samples/sample-rights-sheet.md",
    );
    expect(screen.getByRole("link", { name: /Download sample export bundle/i })).toHaveAttribute(
      "href",
      "/samples/sample-export-bundle.json",
    );
    expect(screen.getByRole("link", { name: /Open sample report/i })).toHaveAttribute(
      "href",
      "/samples/sample-hosted-review-report.md",
    );
    expect(screen.getByRole("link", { name: /Inspect sample evaluation/i })).toHaveAttribute(
      "href",
      "/sample-evaluation",
    );
    expect(screen.getByRole("link", { name: /Request package access/i })).toHaveAttribute(
      "href",
      expect.stringContaining("path=package-access"),
    );
    expect(screen.queryByRole("heading", { name: /Input\/output contract/i })).not.toBeInTheDocument();
  });
});
