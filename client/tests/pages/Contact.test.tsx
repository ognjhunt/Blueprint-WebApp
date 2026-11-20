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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Contact from "@/pages/Contact";

// Explicit unit store contract; native durability is covered by the separate browser lane.
const durability = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock("@/lib/siteCaptureDurability", () => ({
  readDurableSiteCaptureRecovery: async (key: string) => durability.rows.get(key) ?? null,
  writeDurableSiteCaptureRecovery: async (key: string, value: any) => { durability.rows.set(key, { value: JSON.parse(JSON.stringify(value)), retired: false }); },
  retireDurableSiteCaptureRecovery: async (key: string) => { durability.rows.set(key, { value: null, retired: true }); },
  durableSiteCaptureRecoveryKeys: async () => [...durability.rows.keys()],
}));
let mockLocation = "/contact/site-operator";
vi.mock("wouter", () => ({ useLocation: () => [mockLocation, vi.fn()] }));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

beforeEach(() => {
  durability.rows.clear(); localStorage.clear();
  vi.stubGlobal("navigator", { userAgent: navigator.userAgent, locks: {request: async (_key: string, action: () => unknown) => action()} });
  mockLocation = "/contact/site-operator";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, items: [] }) }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("the site page", () => {
  it("is the start form alone, with no explanations around it", async () => {
    render(<Contact />);
    const form = await screen.findByRole("form", { name: "Start a site capture" });
    expect(form).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Start a job" })).toBeInTheDocument();
    expect(screen.queryByText("How this works")).toBeNull();
    expect(screen.queryByText(/Is your job a fit\?/)).toBeNull();
  });

  it("no longer carries the six-question screen", () => {
    render(<Contact />);
    expect(screen.queryByRole("form", { name: /screening questions/i })).toBeNull();
    expect(screen.queryByText(/Want the full read first/i)).toBeNull();
    expect(document.querySelector("#gate-sceneStability")).toBeNull();
  });

  it("leads nowhere but the job: no partner or contact links beside the form", async () => {
    render(<Contact />);
    expect(await screen.findByRole("link", { name: "‹ Back" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /become a partner/i })).toBeNull();
  });
});

describe("the robot page", () => {
  const APPLY = "/partners#partner-application";

  it("points a visitor to the one application form while access is loading", async () => {
    mockLocation = "/contact/robot-team";
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<Contact />);
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute("href", APPLY);
    expect(screen.queryByRole("form", { name: "Early access application" })).toBeNull();
  });

  it("still points to the application when the task lookup fails", async () => {
    mockLocation = "/contact/robot-team";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    render(<Contact />);
    await act(async () => {});
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute("href", APPLY);
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("shows a visitor outside early access the way to apply, and points back at sites", async () => {
    mockLocation = "/contact/robot-team";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false } }),
    }));
    render(<Contact />);
    expect(await screen.findByRole("link", { name: "Apply" })).toHaveAttribute("href", APPLY);
    expect(screen.getByRole("heading", { level: 1, name: "Apply to see jobs" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Job library" })).toBeNull();
    expect(screen.getByRole("link", { name: "Start a job" })).toHaveAttribute(
      "href",
      "/contact/site-operator",
    );
    expect(screen.queryByText(/who commits the deployment engineering/i)).toBeNull();
    // Sharing is the service (2026-11-12): a company sees the jobs sites send; no site chooses whether to share.
    expect(screen.getByText("Approved deployment companies can browse jobs and respond."))
      .toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/choose to share|chooses to share/i);
    expect(screen.getAllByText(/Nothing is charged today\./)).toHaveLength(1);
  });

  it("shows an approved team the job library", async () => {
    mockLocation = "/contact/robot-team";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], access: { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false } }),
    }));
    render(<Contact />);
    expect(await screen.findByRole("heading", { name: "The first site jobs are being prepared." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Job library" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Apply" })).toBeNull();
    // An approved company is not asked to apply (journey audit, 2026-11-20), and the page says no price once.
    expect(screen.getByRole("heading", { level: 1, name: "Job library" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Apply to see jobs" })).toBeNull();
    expect(screen.getAllByText(/Nothing is charged today\./)).toHaveLength(1);
  });
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: null, loading: false }),
  useOptionalAuth: () => ({ currentUser: null, loading: false }),
}));
