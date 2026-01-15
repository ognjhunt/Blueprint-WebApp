import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import ProtectedRoute from "@/components/ProtectedRoute";

const setLocation = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/marketplace", setLocation],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: null,
    userData: null,
    loading: false,
  }),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    setLocation.mockClear();
    sessionStorage.clear();
    window.history.pushState({}, "", "/marketplace?test=true");
  });

  it("redirects unauthenticated users to /login even with test query params", async () => {
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(setLocation).toHaveBeenCalledWith("/login");
    });
  });
});
