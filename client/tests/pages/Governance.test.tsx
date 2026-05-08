import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Governance from "@/pages/Governance";

describe("Governance", () => {
  it("renders the simplified public trust page", () => {
    render(<Governance />);

    expect(
      screen.getByRole("heading", {
        name: /Proof stays attached\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(/^Rights stay explicit$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Hosted access stays bounded$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^No trust claims beyond the listing$/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", { name: /What a buyer can read before access\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Provenance and freshness/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights and restrictions/i)).toBeInTheDocument();
    expect(screen.getByText(/Hosted-access boundary/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Redaction and retention/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Public-facing capture/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /The rules are practical, not just legal copy\./i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: /What Blueprint shows and what it does not claim\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Published today/i)).toBeInTheDocument();
    expect(screen.getByText(/Not claimed/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Any certification or compliance posture Blueprint has not published explicitly/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /What proof is included with every public world-model listing\?/i }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /Open sample listing/i })
        .some((link) => link.getAttribute("href") === "/world-models"),
    ).toBe(true);

    expect(
      screen.getByRole("heading", {
        name: /The trust details become files and fields, not vague promises\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Operator participation sheet/i)).toBeInTheDocument();
  });
});
