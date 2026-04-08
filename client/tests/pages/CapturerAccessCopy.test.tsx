import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Capture from "@/pages/Capture";
import CaptureAppPlaceholder from "@/pages/CaptureAppPlaceholder";
import Login from "@/pages/Login";

vi.mock("@/components/SEO", () => ({
  SEO: () => null,
}));

vi.mock("@/lib/client-env", () => ({
  getCaptureAppPlaceholderUrl: () => "https://capture.blueprint.test/app",
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
  }),
}));

describe("Capturer access copy", () => {
  it("keeps the capture overview explicit about invite and code gating", () => {
    render(<Capture />);

    expect(screen.getByText(/invite- and code-gated/i)).toBeInTheDocument();
    expect(screen.getByText(/approval is not guaranteed/i)).toBeInTheDocument();
  });

  it("keeps the capture app handoff explicit about approval gates", () => {
    render(<CaptureAppPlaceholder />);

    expect(screen.getByText(/invite- and code-gated/i)).toBeInTheDocument();
    expect(screen.getByText(/approval is not guaranteed/i)).toBeInTheDocument();
  });

  it("keeps capturers on the mobile path from the sign-in page", () => {
    render(<Login />);

    expect(screen.getByText(/invite- and code-gated/i)).toBeInTheDocument();
    expect(screen.getByText(/approval is not guaranteed/i)).toBeInTheDocument();
  });
});
