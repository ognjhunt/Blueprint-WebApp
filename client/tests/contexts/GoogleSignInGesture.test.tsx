import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const googleSignIn = vi.hoisted(() => vi.fn());
const googleRedirect = vi.hoisted(() => vi.fn());
const getGoogleRedirectUser = vi.hoisted(() => vi.fn());
const getUserData = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase", () => ({
  auth: {},
  browserLocalPersistence: {},
  firebasePersistence: vi.fn(async () => {}),
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithGoogle: googleSignIn,
  startGoogleSignInRedirect: googleRedirect,
  getGoogleRedirectUser,
  getUserData,
  canUseGoogleRedirect: true,
}));
vi.mock("@/lib/operatorQaAuth", () => ({ resolveOperatorQaAuth: () => ({ enabled: false }) }));

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  googleSignIn.mockReset();
  googleRedirect.mockReset();
  getGoogleRedirectUser.mockReset();
  getUserData.mockReset();
});

function GoogleButton() {
  const { prepareGoogleSignIn, signInWithGoogle } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void prepareGoogleSignIn().then(() => setReady(true));
  }, [prepareGoogleSignIn]);
  return <button disabled={!ready} onClick={() => { void signInWithGoogle().catch(() => {}); }}>Google</button>;
}

function CompleteRedirectButton() {
  const { completeGoogleRedirect } = useAuth();
  return <button onClick={() => { void completeGoogleRedirect(); }}>Finish Google sign-in</button>;
}

describe("Google sign-in user gesture", () => {
  it("starts Firebase popup sign-in within the button click", async () => {
    let inClick = false;
    let startedInClick = false;
    googleSignIn.mockImplementation(() => {
      startedInClick = inClick;
      return Promise.reject(new Error("cancelled"));
    });
    render(<AuthProvider><GoogleButton /></AuthProvider>);
    const button = screen.getByRole("button", { name: "Google" });
    await waitFor(() => expect(button).toBeEnabled());
    inClick = true;
    fireEvent.click(button);
    inClick = false;
    expect(startedInClick).toBe(true);
  });
  it("starts same-origin redirect sign-in on iPhone without opening a popup", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
    googleRedirect.mockResolvedValue(undefined);
    render(<AuthProvider><GoogleButton /></AuthProvider>);
    const button = screen.getByRole("button", { name: "Google" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(googleRedirect).toHaveBeenCalledTimes(1);
    expect(googleSignIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("googleRedirectPending")).toBe("1");
  });
  it("returns to the emailed result after the redirect completes", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fapp%2Fresults%2Fcapture-run-123");
    sessionStorage.setItem("googleRedirectPending", "1");
    sessionStorage.setItem("redirectAfterAuth", "/app/results/capture-run-123");
    getGoogleRedirectUser.mockResolvedValue({ uid: "google-user", getIdTokenResult: async () => ({ claims: {} }) });
    getUserData.mockResolvedValue({ uid: "google-user", finishedOnboarding: true });
    render(<AuthProvider><CompleteRedirectButton /></AuthProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Finish Google sign-in" }));
    await waitFor(() => expect(window.location.pathname).toBe("/app/results/capture-run-123"));
    expect(sessionStorage.getItem("googleRedirectPending")).toBeNull();
    expect(sessionStorage.getItem("redirectAfterAuth")).toBeNull();
  });
});
