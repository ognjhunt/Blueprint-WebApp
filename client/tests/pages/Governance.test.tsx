import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Governance from "@/pages/Governance";

describe("Governance", () => {
  it("renders the simplified buyer-readable trust page", () => {
    render(<Governance />);

    expect(
      screen.getByRole("heading", {
        name: /Trust should be readable before purchase\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Rights stay explicit$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted access stays bounded$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^No trust claims beyond the listing$/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", { name: /What a buyer should be able to read\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Provenance and freshness/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights and restrictions/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted-access boundary/i)).toBeInTheDocument();
    expect(screen.getByText(/Redaction and retention/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /What Blueprint shows and what it does not claim\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Published today/i)).toBeInTheDocument();
    expect(screen.getByText(/Not claimed/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /No certification or compliance claim is implied unless Blueprint publishes it explicitly\./i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /How the boundary stays controlled\./i }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Inspect sample listing/i })
        .some((link) => link.getAttribute("href") === "/world-models/siteworld-f5fd54898cfb"),
    ).toBe(true);

    expect(screen.queryByText(/Operational control matrix/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Public listing policy/i)).not.toBeInTheDocument();
  });
});
