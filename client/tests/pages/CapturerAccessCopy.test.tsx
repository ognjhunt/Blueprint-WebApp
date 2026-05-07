import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Capture from "@/pages/Capture";
import CaptureAppPlaceholder from "@/pages/CaptureAppPlaceholder";
import CaptureLaunchAccess from "@/pages/CaptureLaunchAccess";
import Login from "@/pages/Login";

const launchStatusMock = vi.hoisted(() => ({
  state: {
    data: {
      ok: true,
      supportedCities: [
        { city: "Austin", stateCode: "TX", displayName: "Austin, TX", citySlug: "austin-tx" },
        {
          city: "San Francisco",
          stateCode: "CA",
          displayName: "San Francisco, CA",
          citySlug: "san-francisco-ca",
        },
      ],
      currentCity: null,
    } as any,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("@/components/SEO", () => ({
  SEO: () => null,
}));

vi.mock("@/lib/client-env", () => ({
  getCaptureAppPlaceholderUrl: () => "https://capture.blueprint.test/app",
}));

vi.mock("@/hooks/usePublicLaunchStatus", () => ({
  usePublicLaunchStatus: () => launchStatusMock.state,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
  }),
}));

describe("Capturer access copy", () => {
  beforeEach(() => {
    launchStatusMock.state = {
      data: {
        ok: true,
        supportedCities: [
          { city: "Austin", stateCode: "TX", displayName: "Austin, TX", citySlug: "austin-tx" },
          {
            city: "San Francisco",
            stateCode: "CA",
            displayName: "San Francisco, CA",
            citySlug: "san-francisco-ca",
          },
        ],
        currentCity: null,
      },
      loading: false,
      error: null,
    };
  });

  it("keeps the capture overview explicit about invite and code gating", () => {
    render(<Capture />);

    expect(
      screen.getByRole("heading", { name: /Capture real places only where Blueprint has opened access/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/invite- and code-gated/i)).toBeInTheDocument();
    expect(screen.getByText(/If you can record public-facing places, start here/i)).toBeInTheDocument();
    expect(screen.getByText(/Currently supported:/i)).toBeInTheDocument();
  });

  it("does not infer supported capture cities when launch status is unavailable", () => {
    launchStatusMock.state = {
      data: null,
      loading: false,
      error: "Failed to load launch cities",
    };

    render(<Capture />);

    expect(screen.getByText(/Launch status unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/Austin, TX/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Backend launch roster required/i)).toBeInTheDocument();
  });

  it("does not show default launch cities on the launch-access form when the API fails", () => {
    launchStatusMock.state = {
      data: null,
      loading: false,
      error: "Failed to load launch cities",
    };

    render(<CaptureLaunchAccess />);

    expect(screen.getByText(/Launch status unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/Austin, TX/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request launch access/i })).toBeInTheDocument();
  });

  it("keeps the capture app handoff explicit about approval gates", () => {
    render(<CaptureAppPlaceholder />);

    expect(screen.getByText(/Open Blueprint Capture to record public-facing places people visit every day/i)).toBeInTheDocument();
    expect(screen.getByText(/Review required/i)).toBeInTheDocument();
    expect(screen.getByText(/Available launch cities/i)).toBeInTheDocument();
  });

  it("keeps capturers on the mobile path from the sign-in page", () => {
    render(<Login />);

    expect(screen.getByRole("heading", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Our private platform is for verified buyers and field operators/i)).toBeInTheDocument();
  });
});
