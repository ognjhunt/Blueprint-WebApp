import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Partners from "@/pages/Partners";

describe("the page for deployment companies", () => {
  it("explains the offer and gives new and approved companies their own next step", () => {
    render(<Partners />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find jobs for the robots you deploy.");
    expect(screen.getByText(/When a site asks to meet, we introduce you/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse jobs" })).toHaveAttribute("href", "/contact/robot-team");
    expect(screen.getByRole("form", { name: "Deployment company application" })).toBeVisible();
    expect(document.body.textContent).not.toMatch(/\btest (?:it|on|in)\b|to test\b|can test\b/i);
  });
});
