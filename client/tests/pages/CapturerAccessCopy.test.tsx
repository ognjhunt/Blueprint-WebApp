import { fireEvent, render, screen } from "@testing-library/react";
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

  it("renders an assignment-gated capturer path without invented public jobs or payout bands", () => {
    render(<Capture />);

    expect(
      screen.getByRole("heading", { name: /Capture real sites for robot evaluation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Blueprint publishes assignments only after review/i)).toBeInTheDocument();
    expect(screen.getByText(/Review first\. Assignment second\. Payout after QA\./i)).toBeInTheDocument();
    expect(screen.getByText(/No public payout promises/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Apply to capture/i })[0]).toHaveAttribute(
      "href",
      "/signup/capturer?source=capture",
    );
    expect(screen.getAllByRole("link", { name: /Check city status/i })[0]).toHaveAttribute(
      "href",
      "/capture-app/launch-access?role=capturer&source=capture",
    );
    expect(screen.queryByText(/Northfield Distribution Dock/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Commonwealth Pharmacy Supply Annex/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mock capture jobs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$300-\$700/i)).not.toBeInTheDocument();
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
    expect(screen.getByText(/Google\/Meta smart glasses are supported only for approved repeat walkthroughs/i)).toBeInTheDocument();
    expect(screen.getAllByText(/accepted capture/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Review required/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Open capture markets/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Google\/Meta smart glasses stay optional/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$40 average/i)).not.toBeInTheDocument();
  });

  it("keeps capturers on the mobile path from the sign-in page", () => {
    render(<Login />);

    expect(screen.getByRole("heading", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Our private platform is for verified buyers and field operators/i)).toBeInTheDocument();
  });
});
