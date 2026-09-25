import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const googleSignIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase", () => ({ signInWithGoogle: googleSignIn }));
vi.mock("@/lib/operatorQaAuth", () => ({ resolveOperatorQaAuth: () => ({ enabled: false }) }));

function GoogleButton() {
  const { prepareGoogleSignIn, signInWithGoogle } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void prepareGoogleSignIn().then(() => setReady(true));
  }, [prepareGoogleSignIn]);
  return <button disabled={!ready} onClick={() => { void signInWithGoogle().catch(() => {}); }}>Google</button>;
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
});
