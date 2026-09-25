import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import About from "@/pages/About";
import { COMPANY } from "@/data/company";

describe("About", () => {
  it("says what the company does and who is behind it", () => {
    render(<About />);
    expect(
      screen.getByRole("heading", { level: 1, name: /We help one real task reach a measured robot pilot/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /How it works/i })).toBeInTheDocument();
    expect(screen.getByText(/a simulation result is not a physical test/i)).toBeInTheDocument();
    expect(screen.getByText(COMPANY.legalName)).toBeInTheDocument();
    expect(screen.getByText(COMPANY.mailingAddress)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: COMPANY.emails.hello })).toHaveAttribute("href", `mailto:${COMPANY.emails.hello}`);
  });
});
