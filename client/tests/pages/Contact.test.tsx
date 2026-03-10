import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Contact from "@/pages/Contact";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
  }),
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => "",
  };
});

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
    if (input === "/api/csrf") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ csrfToken: "test-token" }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        ok: true,
        requestId: "req-123",
        siteSubmissionId: "req-123",
        status: "submitted",
      }),
    });
  }) as typeof fetch;
});

describe("Contact page", () => {
  it("renders the qualification-first heading and helper cards", () => {
    render(<Contact />);

    expect(
      screen.getByRole("heading", {
        name: /Tell us the site, the task, and what you need checked\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Quick Response/i)).toBeInTheDocument();
    expect(screen.getByText(/Prefer email\?/i)).toBeInTheDocument();
  });

  it("submits the qualification intake when required fields are filled", async () => {
    render(<Contact />);

    fireEvent.change(screen.getByPlaceholderText("First name*"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last name*"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByPlaceholderText("Company name*"), {
      target: { value: "Analytical Engines" },
    });
    fireEvent.change(screen.getByPlaceholderText("Work email*"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Site name*"), {
      target: { value: "Durham facility" },
    });
    fireEvent.change(screen.getByPlaceholderText("City, state, or facility address*"), {
      target: { value: "Durham, NC" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Describe the exact task Blueprint should qualify.*"),
      {
        target: { value: "Qualify a tote picking workflow." },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "$50K-$300K" }));
    fireEvent.click(screen.getByRole("button", { name: /Submit site intake/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/inbound-request",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(screen.getByText(/Submission received/i)).toBeInTheDocument();
  });
});
