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

it("saves signed-in captures to the authenticated workspace and reuses the request on retry", async () => {
  account.user = { uid: "owner-1", email: "owner@example.com", getIdToken: async () => "owner-token" };
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ message: "Try again" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ captureUrl: null }) });
  render(<SiteCaptureStart />);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
  fireEvent.change(region(), { target: { value: "us" } });
  fireEvent.click(document.querySelector("#start-rights")!);
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("alert");
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Saved in your workspace" });
  const calls = fetchMock.mock.calls.filter(c => c[0] === "/api/workspace/capture-start");
  expect(calls).toHaveLength(2);
  expect(calls[0][1].headers.Authorization).toBe("Bearer owner-token");
  expect(JSON.parse(calls[0][1].body).requestId).toBe(JSON.parse(calls[1][1].body).requestId);
  expect(JSON.parse(calls[0][1].body).consentAttestation.granted).toBe(true);
  expect(document.querySelector("#start-email")).toBeNull();
});
