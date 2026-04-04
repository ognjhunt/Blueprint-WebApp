import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CapturerSignUpFlow from "@/pages/CapturerSignUpFlow";

const setLocationMock = vi.hoisted(() => vi.fn());
const createUserWithEmailAndPasswordMock = vi.hoisted(() => vi.fn());
const setDocMock = vi.hoisted(() => vi.fn());
const analyticsEventsMock = vi.hoisted(() => ({
  capturerSignupStarted: vi.fn(),
  capturerSignupStepViewed: vi.fn(),
  capturerSignupStepCompleted: vi.fn(),
  capturerSignupSubmitted: vi.fn(),
  capturerSignupCompleted: vi.fn(),
  capturerSignupFailed: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/signup/capturer", setLocationMock],
}));

vi.mock("@/lib/analytics", () => ({
  analyticsEvents: analyticsEventsMock,
  getSafeErrorType: vi.fn(() => "unknown"),
}));

vi.mock("@/lib/client-env", () => ({
  getCaptureAppPlaceholderUrl: () => "https://capture.blueprint.test/app",
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => "users/doc"),
  setDoc: setDocMock,
  serverTimestamp: vi.fn(() => "timestamp"),
}));

vi.mock("@/lib/firebase", () => ({
  db: {},
  signInWithGoogle: vi.fn(),
}));

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
}));

describe("CapturerSignUpFlow analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createUserWithEmailAndPasswordMock.mockResolvedValue({
      user: { uid: "capturer-uid" },
    });
    setDocMock.mockResolvedValue(undefined);
  });

  it("tracks the funnel start and initial step view on render", () => {
    render(<CapturerSignUpFlow />);

    expect(analyticsEventsMock.capturerSignupStarted).toHaveBeenCalledTimes(1);
    expect(analyticsEventsMock.capturerSignupStepViewed).toHaveBeenCalledWith(
      1,
      "account_basics",
    );
  });

  it("tracks a validation failure when step 1 is incomplete", () => {
    render(<CapturerSignUpFlow />);

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(analyticsEventsMock.capturerSignupFailed).toHaveBeenCalledWith({
      stage: "step_validation",
      stepNumber: 1,
      errorType: "missing_full_name",
    });
  });

  it("tracks submit and completion for a successful capturer signup", async () => {
    render(<CapturerSignUpFlow />);

    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: "Jordan Lee" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "jordan@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "strongpass123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), {
      target: { value: "strongpass123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(analyticsEventsMock.capturerSignupStepCompleted).toHaveBeenCalledWith(
      1,
      "account_basics",
      "password",
    );

    await screen.findByRole("button", { name: /Create capturer account/i });

    fireEvent.change(screen.getByLabelText(/Home market/i), {
      target: { value: "Raleigh-Durham, NC" },
    });
    fireEvent.change(screen.getByLabelText(/Phone number/i), {
      target: { value: "(555) 555-5555" },
    });

    fireEvent.click(screen.getByRole("radio", { name: /^Search$/i }));

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    fireEvent.click(screen.getByRole("button", { name: /Create capturer account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Account created\./i)).toBeInTheDocument();
    });

    expect(analyticsEventsMock.capturerSignupSubmitted).toHaveBeenCalledWith({
      authMethod: "password",
      equipmentCount: 1,
      availability: "flexible",
      referralSource: "search",
    });
    expect(analyticsEventsMock.capturerSignupCompleted).toHaveBeenCalledWith({
      authMethod: "password",
      equipmentCount: 1,
      availability: "flexible",
      referralSource: "search",
    });
  });
});
