import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SampleDeliverables from "@/pages/SampleDeliverables";

describe("SampleDeliverables", () => {
  it("surfaces sample artifacts, contracts, and export layouts", () => {
    render(<SampleDeliverables />);

    expect(screen.getByRole("heading", { name: /What a buyer actually gets\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sample manifest layout/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sample export bundle/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Input\/output contract/i })).toBeInTheDocument();
    expect(screen.getByText(/Sample artifact layout/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View sample listing/i })).toHaveAttribute(
      "href",
      "/world-models/siteworld-f5fd54898cfb",
    );
  });
});
