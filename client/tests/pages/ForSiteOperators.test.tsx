import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForSiteOperators from "@/pages/ForSiteOperators";

describe("ForSiteOperators", () => {
  it("renders the simplified site-operator persona page", () => {
    render(<ForSiteOperators />);

    expect(screen.getAllByText(/^For Site Operators$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /Earn from your facility\. Keep control of it\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /From a facility to a controlled supply site\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Operator approval stays attached, not inferred\./i })).toBeInTheDocument();
    expect(screen.getByText(/Register the facility/i)).toBeInTheDocument();
    expect(screen.getByText(/Approve capture windows/i)).toBeInTheDocument();
    expect(screen.getByText(/Turn a facility into a captured evaluation site — and keep/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /The facilities that make strong packages\./i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Start site review/i })[0]).toHaveAttribute(
      "href",
      "/contact/site-operator?source=for-site-operators",
    );
    expect(screen.queryByText(/^Revenue share$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Any indoor facility qualifies/i)).not.toBeInTheDocument();
  });
});
