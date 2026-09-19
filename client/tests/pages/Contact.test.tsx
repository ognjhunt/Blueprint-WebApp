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
    expect(screen.getByRole("link", { name: /building robots\? find a task/i })).toHaveAttribute(
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
  it("leads with the task library, points back at sites, and asks for no application", () => {
    mockLocation = "/contact/robot-team";
    render(<Contact />);
    expect(screen.getByRole("region", { name: "Task library" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /operate a site\? start here/i })).toHaveAttribute(
      "href",
      "/contact/site-operator",
    );
    expect(screen.queryByRole("button", { name: "Send application" })).toBeNull();
    expect(screen.queryByText(/who commits the deployment engineering/i)).toBeNull();
  });
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: null, loading: false }) }));
