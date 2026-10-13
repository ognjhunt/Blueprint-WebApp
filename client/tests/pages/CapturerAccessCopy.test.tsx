import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
const prepareGoogleSignIn = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

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
    completeGoogleRedirect: vi.fn().mockResolvedValue(undefined),
    prepareGoogleSignIn,
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

    expect(screen.getByRole("heading", { name: /Get paid to capture the job before the robot arrives/i })).toBeInTheDocument();
    expect(screen.getAllByText(/phone first/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Accepted capture gear is a 360 camera and a smartphone/i)).toBeInTheDocument();
    expect(screen.getAllByText(/accepted capture/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Review required/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Open capture markets/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$40 average/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$(40|45|80)\b/i)).not.toBeInTheDocument();
    // The app is capture-only: it films from a capture link. The page must not
    // advertise assignments, payouts or field guidance inside it.
    expect(screen.getByText(/Blueprint Capture is a camera for iPhone/i)).toBeInTheDocument();
    expect(screen.getByText(/It does not list assignments or show payouts/i)).toBeInTheDocument();
    expect(screen.queryByText(/assignment app/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/follow app guidance/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open Blueprint Capture/i })[0]).toHaveAttribute(
      "href",
      "https://capture.blueprint.test/app",
    );
  });

  it("keeps launch-access copy focused on city demand and local capturer signals", () => {
    render(<CaptureLaunchAccess />);

    expect(screen.getByRole("heading", { name: /Signal demand for paid capture in your city/i })).toBeInTheDocument();
    expect(screen.getByText(/local capturer or operator signal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/approved assignments/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/public-area-only capture candidates/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$40 average/i)).not.toBeInTheDocument();
  });

  it("no longer sends anyone from the sign-in page to the retired capture app", async () => {
    render(<Login />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());

    expect(screen.getByRole("heading", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Capture app access" })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/capture-app"]')).toBeNull();
  });
});
