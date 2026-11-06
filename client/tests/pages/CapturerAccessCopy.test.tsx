import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Login from "@/pages/Login";

const prepareGoogleSignIn = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/components/SEO", () => ({
  SEO: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    completeGoogleRedirect: vi.fn().mockResolvedValue(undefined),
    prepareGoogleSignIn,
  }),
}));

describe("Capturer access copy", () => {
  it("no longer sends anyone from the sign-in page to the retired capture app", async () => {
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());

    expect(screen.getByRole("heading", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Capture app access" })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/capture-app"]')).toBeNull();
  });
});
