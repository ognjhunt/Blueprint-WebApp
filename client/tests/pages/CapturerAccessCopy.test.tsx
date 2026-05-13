import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Capture from "@/pages/Capture";
import CaptureAppPlaceholder from "@/pages/CaptureAppPlaceholder";
import CaptureLaunchAccess from "@/pages/CaptureLaunchAccess";
import CapturerSignUpFlow from "@/pages/CapturerSignUpFlow";
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
      screen.getByRole("heading", { name: /Get paid to capture real places robots need to understand/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/assignment payout shown before you start/i)).toBeInTheDocument();
    expect(screen.getAllByText(/accepted capture/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/walk a public-facing route/i)).toBeInTheDocument();
    expect(screen.getAllByText(/upload one complete walkthrough/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/public-area-only/i)).toBeInTheDocument();
    expect(screen.getByText(/city-, invite-, and code-gated/i)).toBeInTheDocument();
    expect(screen.getByText(/Currently supported:/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$40 average/i)).not.toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: /Get paid to capture real places robots need to understand/i })).toBeInTheDocument();
    expect(screen.getAllByText(/phone first/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/smart glasses are supported only for approved repeat walkthroughs/i)).toBeInTheDocument();
    expect(screen.getAllByText(/accepted capture/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Review required/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Available launch cities/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$40 average/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$(40|45|80)\b/i)).not.toBeInTheDocument();
  });

  it("keeps launch-access copy focused on city demand and local capturer signals", () => {
    render(<CaptureLaunchAccess />);

    expect(screen.getByRole("heading", { name: /Signal demand for paid capture in your city/i })).toBeInTheDocument();
    expect(screen.getByText(/local capturer or operator signal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/approved assignments/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/public-area-only capture candidates/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$40 average/i)).not.toBeInTheDocument();
  });

  it("keeps the capturer application simple and honest about review", () => {
    render(<CapturerSignUpFlow />);

    expect(screen.getByRole("heading", { name: /Apply to get paid for approved field capture/i })).toBeInTheDocument();
    expect(screen.getByText(/phone-first walkthrough work/i)).toBeInTheDocument();
    expect(screen.getByText(/review is required before any assignment or payout eligibility/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart glasses stay optional/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$40 average/i)).not.toBeInTheDocument();
  });

  it("keeps capturers on the mobile path from the sign-in page", () => {
    render(<Login />);

    expect(screen.getByRole("heading", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Our private platform is for verified buyers and field operators/i)).toBeInTheDocument();
  });
});
