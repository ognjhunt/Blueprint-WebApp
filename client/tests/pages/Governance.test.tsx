import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Governance from "@/pages/Governance";

describe("Governance", () => {
  it("renders buyer-readable trust cards and boundary summaries", () => {
    render(<Governance />);

    expect(screen.getByRole("heading", { name: /Rights, privacy, provenance, and hosted access should be easy to read\./i })).toBeInTheDocument();
    expect(screen.getByText(/Sample provenance card/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample rights and restrictions/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted access boundary/i)).toBeInTheDocument();
    expect(screen.getByText(/Retention and redaction/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What Blueprint publishes today versus what it does not claim\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Security, privacy, and access controls buyers should expect to read\./i })).toBeInTheDocument();
    expect(screen.getByText(/No certification claims are implied unless Blueprint publishes them explicitly/i)).toBeInTheDocument();
  });
});
