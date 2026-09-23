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
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("sends the site a team would test at, and says so when a clear fit is approved on the spot", async () => {
    mockLocation = "/contact/robot-team";
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes("/apply")
        ? { status: "approved" }
        : { items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false } },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Contact />);
    const form = await screen.findByRole("form", { name: "Early access application" });
    const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill(/your name/i, "Ada Lovelace");
    fill(/work email/i, "ada@arm.example");
    fill(/^company/i, "Arm Co");
    fill(/what does your robot do/i, "Fixed arm");
    fill(/what work do you want/i, "Tote picking");
    fill(/a site or customer you would want to test at/i, "Our pilot warehouse");
    fireEvent.submit(form);
    expect(await screen.findByRole("heading", { name: "You are approved." })).toBeInTheDocument();
    const apply = fetchMock.mock.calls.find(([url]) => String(url).includes("/apply"))!;
    expect(JSON.parse(String((apply[1] as RequestInit).body))).toMatchObject({ testSite: "Our pilot warehouse" });
  });
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: null, loading: false }),
  useOptionalAuth: () => ({ currentUser: null, loading: false }),
}));
