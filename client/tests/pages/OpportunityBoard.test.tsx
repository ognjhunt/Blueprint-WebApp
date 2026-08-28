import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OpportunityBoard from "@/pages/internal/OpportunityBoard";
import { boardListings } from "@/data/opportunityBoardPreview";

describe("OpportunityBoard preview", () => {
  it("labels itself as invented data before showing any listing", () => {
    render(<OpportunityBoard />);
    // The board is a design mock; the repo forbids presenting fake supply as
    // real, so this notice is part of the contract rather than decoration.
    expect(screen.getByText(/Design preview/i)).toBeInTheDocument();
    expect(screen.getByText(/not a real site, measurement, or commercial term/i)).toBeInTheDocument();
  });

  it("shows every listing with its acceptance bar and pilot band", () => {
    render(<OpportunityBoard />);
    const rows = screen.getAllByRole("row");
    // one header row + every listing
    expect(rows).toHaveLength(boardListings.length + 1);

    const totes = screen.getByRole("link", { name: "ATX-007" }).closest("tr");
    expect(totes).not.toBeNull();
    expect(within(totes as HTMLElement).getByText("≥96% @ ≤27s")).toBeInTheDocument();
    expect(within(totes as HTMLElement).getByText("$25K–35K")).toBeInTheDocument();
    expect(within(totes as HTMLElement).getByText("18s")).toBeInTheDocument();
  });

  it("keeps a site that did not qualify on the board, with the reason", () => {
    render(<OpportunityBoard />);
    // Scoped to the table: the same words also name a filter in the rail.
    const table = within(screen.getByRole("table"));
    expect(table.getByText(/DID NOT QUALIFY/i)).toBeInTheDocument();
    expect(table.getByText(/Nightly re-slotting fails the fixed-scene gate/i)).toBeInTheDocument();
    // It is a dead row, so it must not offer a way into an eval.
    expect(screen.queryByRole("link", { name: "ATX-009" })).not.toBeInTheDocument();
  });

  it("filters the board by task family without changing the metro totals", () => {
    render(<OpportunityBoard />);

    // Read the headline figure off its own term, since bare digits also appear
    // as per-filter counts in the rail.
    const evalOpenFigure = () =>
      screen.getByText("Eval open", { selector: "dt" }).nextElementSibling?.textContent;
    const openTotal = String(
      boardListings.filter((listing) => listing.status === "eval-open").length,
    );
    expect(evalOpenFigure()).toBe(openTotal);

    fireEvent.click(screen.getByRole("button", { name: /Palletizing, 1 listing$/i }));

    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "ATX-006" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ATX-007" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 9 shown/i)).toBeInTheDocument();

    // The header figures describe the metro, not the current filter.
    expect(evalOpenFigure()).toBe(openTotal);
  });

  it("clears filters back to the full board", () => {
    render(<OpportunityBoard />);

    fireEvent.click(screen.getByRole("button", { name: /Palletizing, 1 listing$/i }));
    expect(screen.getAllByRole("row")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /^Clear$/i }));
    expect(screen.getAllByRole("row")).toHaveLength(boardListings.length + 1);
  });
});
