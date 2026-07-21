import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CaptureAppPlaceholder from "@/pages/CaptureAppPlaceholder";

const authStateMock = vi.hoisted(() => ({
  state: {
    currentUser: null as { uid: string } | null,
    userData: null as Record<string, unknown> | null,
  },
}));

vi.mock("@/components/SEO", () => ({
  SEO: () => null,
}));

vi.mock("@/lib/client-env", () => ({
  getCaptureAppPlaceholderUrl: () => "/capture-app",
}));

vi.mock("@/hooks/usePublicLaunchStatus", () => ({
  usePublicLaunchStatus: () => ({
    data: { ok: true, supportedCities: [], currentCity: null },
    loading: false,
    error: null,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authStateMock.state,
}));

describe("CaptureAppPlaceholder capturer status ladder", () => {
  beforeEach(() => {
    authStateMock.state = { currentUser: null, userData: null };
  });

  it("hides the ladder for signed-out visitors", () => {
    render(<CaptureAppPlaceholder />);

    expect(screen.queryByText(/Your Capturer Application/i)).not.toBeInTheDocument();
  });

  it("hides the ladder for signed-in users without a capturer application", () => {
    authStateMock.state = {
      currentUser: { uid: "buyer-1" },
      userData: { role: "buyer" },
    };

    render(<CaptureAppPlaceholder />);

    expect(screen.queryByText(/Your Capturer Application/i)).not.toBeInTheDocument();
  });

  it("shows the in-review rung for pending_review applicants", () => {
    authStateMock.state = {
      currentUser: { uid: "capturer-1" },
      userData: { capturerApplicationStatus: "pending_review" },
    };

    render(<CaptureAppPlaceholder />);

    expect(screen.getAllByText(/Your Capturer Application/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/in review — we'll email you when there's a decision/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Applied$/)).toBeInTheDocument();
    // Appears as both the header badge and the ladder rung label.
    expect(screen.getAllByText(/^In review$/).length).toBeGreaterThan(1);
    expect(screen.getByText(/^First assignment$/)).toBeInTheDocument();
  });

  it("shows the first-assignment rung as current for approved capturers, honestly", () => {
    authStateMock.state = {
      currentUser: { uid: "capturer-1" },
      userData: { capturerApplicationStatus: "approved" },
    };

    render(<CaptureAppPlaceholder />);

    expect(screen.getByText(/You're approved/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /First assignments are coordinated by the Blueprint ops team after approval/i
      )
    ).toBeInTheDocument();
    // The existing app access content stays available for approved capturers.
    expect(
      screen.getByRole("heading", {
        name: /Get paid to capture real places robots need to understand/i,
      })
    ).toBeInTheDocument();
  });

  it("shows an honest note and contact link for rejected applicants", () => {
    authStateMock.state = {
      currentUser: { uid: "capturer-1" },
      userData: { capturerApplicationStatus: "rejected" },
    };

    render(<CaptureAppPlaceholder />);

    expect(
      screen.getByText(/Your application wasn't approved this time/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Contact the Blueprint team/i })
    ).toHaveAttribute("href", "/contact");
  });
});
