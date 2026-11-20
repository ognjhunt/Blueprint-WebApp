import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Partners from "@/pages/Partners";
import { COMPANY_RESPONSE_LABELS } from "@/lib/companyResponses";

describe("the page for deployment companies", () => {
  it("names exactly the answers the company form offers, and says no company tests anything", () => {
    render(<Partners />);
    const rows = screen.getByRole("region", { name: "How it works" });
    for (const label of Object.values(COMPANY_RESPONSE_LABELS)) expect(rows).toHaveTextContent(label);
    expect(rows).toHaveTextContent("Interested, Not a fit or Would need something; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet.");
    expect(document.body.textContent).not.toMatch(/\btest (?:it|on|in)\b|to test\b|can test\b/i);
  });
});
