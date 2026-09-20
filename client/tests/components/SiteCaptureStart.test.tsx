// @vitest-environment jsdom
/**
 * The country, from the address rather than ahead of it.
 *
 * The form used to ask "which country" before "where is it", which made a
 * legal residency decision the operator's first job. The address answers it
 * for almost everyone; the control stays visible as one tap to correct,
 * because it decides whether we may collect footage at all.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";

vi.mock("@/lib/analytics", () => ({ analyticsEvents: { contactFormSubmit: vi.fn(), contactFormError: vi.fn() } }));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));

const account = vi.hoisted(() => ({ user: null as any }));
const fetchMock = vi.fn();

function photon(properties: Record<string, unknown>[]) {
  return { ok: true, json: async () => ({ features: properties.map((props) => ({ properties: props })) }) };
}

beforeEach(() => {
  account.user = null;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FormData", window.FormData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function region() {
  return document.querySelector("#start-region") as HTMLSelectElement;
}

describe("SiteCaptureStart and the country", () => {
  it("asks where the site is before which country it is in", () => {
    render(<SiteCaptureStart />);
    const location = document.querySelector("#start-location")!;
    expect(location.compareDocumentPosition(region()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region().value).toBe("");
  });

  it("sets the country from the address that was picked", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    render(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "munich" } });

    fireEvent.mouseDown(await screen.findByText("Munich, Germany"));

    expect(region().value).toBe("non_us");
  });

  it("keeps the country on the United States for a US address", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Austin", state: "Texas", country: "United States", countrycode: "US" }]));
    render(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "austin" } });

    fireEvent.mouseDown(await screen.findByText("Austin, Texas, United States"));

    expect(region().value).toBe("us");
  });
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: account.user, loading: false }) }));


it("clears an inferred country when the address is edited, but preserves an explicit correction", async () => {
  fetchMock.mockResolvedValue(photon([{ name: "Austin", countrycode: "US" }]));
  render(<SiteCaptureStart />);
  const location = document.querySelector("#start-location")!;
  fireEvent.change(location, { target: { value: "austin" } });
  fireEvent.mouseDown(await screen.findByText("Austin"));
  expect(region().value).toBe("us");
  fireEvent.change(location, { target: { value: "Berlin" } });
  expect(region().value).toBe("");
  fireEvent.change(region(), { target: { value: "non_us" } });
  fireEvent.change(location, { target: { value: "Berlin Mitte" } });
  expect(region().value).toBe("non_us");
});

function signedIn(setup: { ok?: boolean; workspaceType?: string | null }, posts: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  account.user = { uid: "owner-1", email: "owner@example.com", getIdToken: async () => "owner-token" };
  const queue = [...posts];
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/workspace/setup") return { ok: setup.ok !== false, json: async () => ({ workspaceType: setup.workspaceType ?? null }) };
    const next = queue.shift() ?? { ok: true };
    return { ok: next.ok, status: next.status ?? (next.ok ? 200 : 500), json: async () => next.body ?? {} };
  });
}

function fillAndSubmit() {
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
  fireEvent.change(region(), { target: { value: "us" } });
  fireEvent.click(document.querySelector("#start-rights")!);
  fireEvent.submit(screen.getByRole("form"));
}

function postsTo(url: string) {
  return fetchMock.mock.calls.filter(c => c[0] === url && c[1]?.method === "POST");
}

it("saves signed-in captures to the authenticated workspace and reuses the request on retry", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: false, body: { message: "Try again" } }, { ok: true, body: { captureUrl: null } }]);
  render(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  fillAndSubmit();
  await screen.findByRole("alert");
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Saved in your workspace" });
  const calls = postsTo("/api/workspace/capture-start");
  expect(calls).toHaveLength(2);
  expect(calls[0][1].headers.Authorization).toBe("Bearer owner-token");
  expect(JSON.parse(calls[0][1].body).requestId).toBe(JSON.parse(calls[1][1].body).requestId);
  expect(JSON.parse(calls[0][1].body).consentAttestation.granted).toBe(true);
  expect(postsTo("/api/inbound-request")).toHaveLength(0);
  expect(document.querySelector("#start-email")).toBeNull();
});

it("tells a robot-team account up front that the site goes to the emailed link, and never blocks it", async () => {
  signedIn({ workspaceType: "robot_team" }, [{ ok: true, body: { captureUrl: "https://example.test/capture" } }]);
  render(<SiteCaptureStart />);
  await screen.findByText(/Signed in as owner@example.com, which is not a site workspace/);
  fillAndSubmit();
  await screen.findByText(/saved to the link we email owner@example.com/);
  expect(screen.queryByRole("link", { name: "Saved in your workspace" })).toBeNull();
  expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
  expect(postsTo("/api/inbound-request")).toHaveLength(1);
});

it("falls back to the emailed link with the same answers when the workspace refuses the account", async () => {
  signedIn({ ok: false }, [{ ok: false, status: 403, body: { error: "This action requires a site account." } }, { ok: true, body: { captureUrl: null } }]);
  render(<SiteCaptureStart />);
  fillAndSubmit();
  await screen.findByText(/saved to the link we email owner@example.com/);
  expect(screen.queryByRole("alert")).toBeNull();
  const refused = postsTo("/api/workspace/capture-start"), fallback = postsTo("/api/inbound-request");
  expect(refused).toHaveLength(1);
  expect(fallback).toHaveLength(1);
  expect(fallback[0][1].body).toBe(refused[0][1].body);
});

it("moves the laptop from the QR code to the brief once the phone's recording lands", async () => {
  const captureUrl = "https://tryblueprint.io/capture-upload/tok.signed";
  let received = false;
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (String(url).includes("/status")) {
      return { ok: true, json: async () => ({ status: { headline: received ? "We have your recording." : "Film the work area.", stage: null }, captureReceived: received }) };
    }
    if (init?.method === "POST") return { ok: true, status: 200, json: async () => ({ captureUrl }) };
    return photon([]);
  });
  render(<SiteCaptureStart />);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
  fireEvent.change(region(), { target: { value: "us" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
  fireEvent.click(document.querySelector("#start-rights")!);
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Film the work area.", { selector: "h2" });
  expect(screen.getByRole("link", { name: "Open your task page" })).toHaveAttribute("href", captureUrl);

  received = true;
  await screen.findByText("Your recording is in.", { selector: "h2" }, { timeout: 10_000 });
  expect(screen.getByRole("link", { name: "Review your task brief" })).toHaveAttribute("href", captureUrl);
  expect(screen.queryByRole("link", { name: "Open your task page" })).toBeNull();
  expect(screen.queryByRole("img", { name: "Point your phone at this to film" })).toBeNull();
}, 15_000);
