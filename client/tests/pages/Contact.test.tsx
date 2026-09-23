// @vitest-environment jsdom
/**
 * The two front doors, after the screens came down.
 *
 * The site page used to carry a six-question screen behind a disclosure and
 * three paragraphs before the first field; the robot page carried a six-question
 * application. Both are gone: the brief reads the description, the plan form
 * asks the two facts matching needs, and everything else belongs to the pilot
 * conversation. These pin the order of what remains: the form first, the
 * explanation closed, and each persona pointing at the other.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Contact from "@/pages/Contact";

let mockLocation = "/contact/site-operator";
vi.mock("wouter", () => ({ useLocation: () => [mockLocation, vi.fn()] }));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

beforeEach(() => {
  mockLocation = "/contact/site-operator";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, items: [] }) }),
  );
});

describe("the site page", () => {
  it("leads with the capture form and keeps the explanation behind a closed disclosure", () => {
    render(<Contact />);
    const form = screen.getByRole("form", { name: "Start a site capture" });
    const how = screen.getByText("How this works");
    expect(form.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((how.closest("details") as HTMLDetailsElement).open).toBe(false);
  });

  it("no longer carries the six-question screen", () => {
    render(<Contact />);
    expect(screen.queryByRole("form", { name: /screening questions/i })).toBeNull();
    expect(screen.queryByText(/Want the full read first/i)).toBeNull();
    expect(document.querySelector("#gate-sceneStability")).toBeNull();
  });

  it("points at the other persona and at a person", () => {
    render(<Contact />);
    expect(screen.getByRole("link", { name: /building robots\? apply for early access/i })).toHaveAttribute(
      "href",
      "/contact/robot-team",
    );
    expect(screen.getByRole("link", { name: /talk to a person/i })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/),
    );
  });
});

describe("the robot page", () => {
  it("shows a visitor outside early access the application, and points back at sites", async () => {
    mockLocation = "/contact/robot-team";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false } }),
    }));
    render(<Contact />);
    expect(await screen.findByRole("form", { name: "Early access application" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Task library" })).toBeNull();
    expect(screen.getByRole("link", { name: /operate a site\? start here/i })).toHaveAttribute(
      "href",
      "/contact/site-operator",
    );
    expect(screen.queryByText(/who commits the deployment engineering/i)).toBeNull();
  });

  it("shows an approved team the task library", async () => {
    mockLocation = "/contact/robot-team";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], access: { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false } }),
    }));
    render(<Contact />);
    expect(await screen.findByRole("heading", { name: "The first site tasks are being prepared." })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Early access application" })).toBeNull();
  });
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: null, loading: false }),
  useOptionalAuth: () => ({ currentUser: null, loading: false }),
}));
