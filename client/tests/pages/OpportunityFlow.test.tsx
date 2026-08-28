import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OpportunityAnonymous from "@/pages/internal/OpportunityAnonymous";
import OpportunityOffer from "@/pages/internal/OpportunityOffer";
import OpportunityOffers from "@/pages/internal/OpportunityOffers";
import { opportunity, submittedOffers } from "@/data/opportunityFlow";

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRoute: () => [true, { id: "ATX-007" }],
}));

describe("anonymous opportunity", () => {
  it("shows both envelopes so a team can judge feasibility and commercial reality", () => {
    render(<OpportunityAnonymous />);
    expect(screen.getByRole("heading", { level: 1, name: /Tote induct & decant/i })).toBeInTheDocument();
    // Technical
    expect(screen.getByText(/14 rigid SKUs across two tote types/i)).toBeInTheDocument();
    expect(screen.getByText(/420 moves \/ hour/i)).toBeInTheDocument();
    // Commercial — a team must know the job is real before spending on it.
    expect(screen.getByText(/Yes — allocated, with a named owner/i)).toBeInTheDocument();
    expect(screen.getByText(/Up to 30 across three sister facilities/i)).toBeInTheDocument();
  });

  it("never leaks the operator identity before award", () => {
    const { container } = render(<OpportunityAnonymous />);
    expect(container).toHaveTextContent(/Identity withheld until award/i);
    for (const withheld of opportunity.withheld) {
      expect(screen.getByText(withheld)).toBeInTheDocument();
    }
    // The one-way rule is stated on the page, not buried in terms.
    expect(container).toHaveTextContent(/One-way anonymity/i);
    expect(container).toHaveTextContent(/Publicly discoverable/i);
    expect(container).toHaveTextContent(/De-identified until award/i);
  });
});

describe("deployment offer", () => {
  it("cannot be submitted without authorising the award fee", () => {
    render(<OpportunityOffer />);
    const submit = screen.getByRole("button", { name: /Submit offer/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });

  it("asks every team the same standard fields", () => {
    render(<OpportunityOffer />);
    for (const label of [
      /Can you perform this task today\?/i,
      /Evaluation score/i,
      /Who pays whom during the pilot/i,
      /Main remaining technical risk/i,
      /Insurance and safety status/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

describe("offer comparison and award", () => {
  it("hides team names until the site shortlists", () => {
    render(<OpportunityOffers />);
    expect(screen.getByRole("columnheader", { name: /Team A/i })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Vantage Motion/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Shortlisted$/i }));
    expect(screen.getByRole("columnheader", { name: /Vantage Motion/i })).toBeInTheDocument();
    // Shortlisting also drops the team that did not make it.
    expect(screen.queryByRole("columnheader", { name: /Kestrel/i })).not.toBeInTheDocument();
  });

  it("compares every offer on the same fields", () => {
    render(<OpportunityOffers />);
    const table = within(screen.getByRole("table"));
    expect(table.getByText(/Who pays whom/i)).toBeInTheDocument();
    // Including who funds the pilot, which differs by team.
    expect(table.getByText(/Vendor-funded — Vantage pays the site \$20,000/i)).toBeInTheDocument();
    expect(table.getByText(/Site pays \$15,000 for the pilot/i)).toBeInTheDocument();
  });

  it("unlocks the identity only on award, and charges only the winner", () => {
    const { container } = render(<OpportunityOffers />);
    expect(container).toHaveTextContent(/Unlocks to the winner on award/i);

    fireEvent.click(screen.getByRole("button", { name: /Select Team A/i }));
    expect(container).toHaveTextContent(/Unlocked to Vantage Motion/i);
    // The awarded chip replaces that team's select button inside the table.
    expect(within(screen.getByRole("table")).getByText(/^Awarded$/i)).toBeInTheDocument();
    // The site is never charged.
    expect(container).toHaveTextContent(/Charged to the site/i);
    expect(container).toHaveTextContent(/\$0/);
  });

  it("keeps every submitted offer inside Blueprint", () => {
    const { container } = render(<OpportunityOffers />);
    expect(submittedOffers.length).toBeGreaterThan(1);
    expect(container).toHaveTextContent(/Messaging, offers, scoring and award records held in Blueprint/i);
    expect(container).toHaveTextContent(/Watermarked packages and access logs/i);
  });
});
