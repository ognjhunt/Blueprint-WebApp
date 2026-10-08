// @vitest-environment jsdom
/**
 * The country, from the address rather than beside it.
 *
 * The form used to ask "which country" as a question of its own, right under
 * "where is it", which made a legal residency decision the operator's job twice
 * over. The address answers it for almost everyone, so the country is a line to
 * confirm under the address; the select only opens to correct it, or when a
 * typed location remains ambiguous. That fallback is visible before Start,
 * because the country decides whether we may collect footage at all.
 */
import { act, fireEvent, render as renderView, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/analytics", () => ({ analyticsEvents: { contactFormSubmit: vi.fn(), contactFormError: vi.fn() } }));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));
const upload = vi.hoisted(() => ({ send: vi.fn(), retry: vi.fn() }));
vi.mock("@/lib/selfCaptureVideo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/selfCaptureVideo")>()),
  uploadSelfCaptureVideo: upload.send,
  retrySelfCaptureProcessing: upload.retry,
}));

const account = vi.hoisted(() => ({ user: null as any, loading: false }));
// Explicit unit durability contract fake; native storage is exercised separately.
// Native strict IndexedDB execution is a separate layer.
const durability = vi.hoisted(() => ({ rows: new Map<string, { value: any; retired: boolean }>() }));
vi.mock("@/lib/siteCaptureDurability", () => ({
  readDurableSiteCaptureRecovery: async (key: string) => {
    const row = durability.rows.get(key);
    return row ? JSON.parse(JSON.stringify(row)) : null;
  },
  writeDurableSiteCaptureRecovery: async (key: string, value: any, replaceIdentity = false) => {
    const current = durability.rows.get(key);
    if (!replaceIdentity && current && (current.retired || current.value?.requestId !== value.requestId
      || current.value?.retryToken !== value.retryToken)) throw new Error("Fixture durability transaction aborted");
    const { task, location, email, company, method, region, regionManuallySet } = value.draft;
    durability.rows.set(key, { retired: false, value: {
      version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
      draft: { task, location, email, company, method, region, regionManuallySet },
      pending: value.pending ? { body: value.pending.body, endpoint: value.pending.endpoint, acknowledged: value.pending.acknowledged } : null,
    } });
  },
  retireDurableSiteCaptureRecovery: async (key: string) => { durability.rows.set(key, { value: null, retired: true }); },
  durableSiteCaptureRecoveryKeys: async () => [...durability.rows.keys()],
}));

async function renderReady(ui: React.ReactElement) {
  let result!: ReturnType<typeof renderView>;
  await act(async () => { result = renderView(ui); });
  return result;
}
const fetchMock = vi.fn();

function photon(properties: Record<string, unknown>[]) {
  return { ok: true, json: async () => ({ features: properties.map((props) => ({ properties: props })) }) };
}

beforeEach(() => {
  durability.rows.clear();
  vi.stubGlobal("navigator", { userAgent: navigator.userAgent, locks: { request: async (_key: string, action: () => unknown) => action() } });
  window.localStorage.clear();
  window.sessionStorage.clear();
  account.user = null;
  account.loading = false;
  fetchMock.mockReset();
  upload.send.mockReset();
  upload.retry.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FormData", window.FormData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function region() {
  return document.querySelector("#start-region") as HTMLSelectElement | null;
}

it("keeps the prerendered form inactive until handlers attach and never defaults to a GET of contact details", () => {
  const document = new DOMParser().parseFromString(renderToString(<SiteCaptureStart />), "text/html");
  expect(document.querySelector("form")).toBeNull();
  expect(document.querySelector("[role=status]")?.textContent).toContain("Loading");
});

it.each(["gpt-6.1-sol-agents-api", "gpt-6-sol-agents-api"])(
  "keeps %s entry links on the upgraded Sol disclosure",
  async (authoring) => {
    const previousUrl = window.location.href;
    window.history.replaceState(null, "", `?authoring=${authoring}`);
    try {
      await renderReady(<SiteCaptureStart />);
      const disclosure = screen.getByRole("checkbox", { name: /GPT-6\.1 Sol managed-agent 3D authoring/ });
      expect(disclosure).not.toBeChecked();
      fireEvent.click(disclosure);
      expect(disclosure).toBeChecked();
    } finally {
      window.history.replaceState(null, "", previousUrl);
    }
  },
);

describe("SiteCaptureStart and the country", () => {
  it.each(["Austin, TX", "austin tx", "Austin, Texas, United States", "Austin, TX 78701"])("recognizes an explicit US job location before Start (%s)", async (location) => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
    expect(screen.getByText(/Country: United States\./)).toBeInTheDocument();
    expect(region()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["Paris", "Georgia", "Vancouver, CA", "Austin, TX, Germany", "123 Main St", "123 Main St.", "10 High ST", "Warehouse near us"])("shows the country fallback before Start for unresolved geography (%s)", async (location) => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
    expect(region()).not.toBeNull();
    expect(region()!.value).toBe("");
    expect(postsTo("/api/inbound-request")).toHaveLength(0);
  });

  it.each(["Berlin, Germany", "London UK", "Toronto, Canada"])("recognizes explicit non-US geography and keeps its upload hold (%s)", async (location) => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
    expect(screen.getByText(/Country: Outside the United States\./)).toBeInTheDocument();
    expect(screen.getByText(/Outside the US we set up the data-transfer terms/)).toBeInTheDocument();
    expect(document.querySelector("#start-footage")).toBeNull();
    expect(upload.send).not.toHaveBeenCalled();
  });

  it("posts a typed Austin TX description on the first Start with the existing country contract", async () => {
    signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: null } }]);
    await renderReady(<SiteCaptureStart />);
    await screen.findByText(/Saving to your workspace/);
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Slide the dishwasher racks" } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin TX" } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("link", { name: "Saved in your workspace" });
    const calls = postsTo("/api/workspace/capture-start");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body)).toMatchObject({ siteLocation: "Austin TX", captureRegion: "us", descriptionOnly: true, consentAttestation: null });
    expect(upload.send).not.toHaveBeenCalled();
  });

  it("invalidates typed inference on an ambiguous edit and resolves explicit non-US edits", async () => {
    await renderReady(<SiteCaptureStart />);
    const location = document.querySelector("#start-location")!;
    fireEvent.change(location, { target: { value: "Austin TX" } });
    expect(screen.getByText(/Country: United States\./)).toBeInTheDocument();
    fireEvent.change(location, { target: { value: "Paris" } });
    expect(region()!.value).toBe("");
    fireEvent.change(location, { target: { value: "Paris, France" } });
    expect(screen.getByText(/Country: Outside the United States\./)).toBeInTheDocument();
    fireEvent.change(location, { target: { value: "" } });
    expect(region()).toBeNull();
    expect(screen.queryByText(/Country:/)).toBeNull();
  });

  it("clears the prior inferred country while a new Google pick awaits details and ignores details after another edit", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    let resolveDetails: ((place: unknown, status: string) => void) | undefined;
    vi.stubGlobal("google", { maps: { places: {
      AutocompleteService: class {
        getPlacePredictions(_request: unknown, callback: Function) {
          callback([{ description: "Berlin, Germany", place_id: "berlin-id" }], "OK");
        }
      },
      PlacesService: class {
        getDetails(_request: unknown, callback: typeof resolveDetails) { resolveDetails = callback; }
      },
    } } });
    try {
      signedIn({ workspaceType: "site_operator" }, []);
      await renderReady(<SiteCaptureStart />);
      await screen.findByText(/Saving to your workspace/);
      fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Slide the racks" } });
      const location = document.querySelector("#start-location")!;
      fireEvent.change(location, { target: { value: "Austin TX" } });
      expect(screen.getByText(/Country: United States\./)).toBeInTheDocument();
      fireEvent.mouseDown(await screen.findByText("Berlin, Germany"));
      expect((location as HTMLInputElement).value).toBe("Berlin, Germany");
      expect(region()!.value).toBe("");
      fireEvent.submit(screen.getByRole("form"));
      expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
      fireEvent.change(location, { target: { value: "Austin TX" } });
      resolveDetails?.({ address_components: [{ short_name: "DE", types: ["country"] }] }, "OK");
      expect(await screen.findByText(/Country: United States\./)).toBeInTheDocument();
      expect(region()).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });

  it("preserves an explicit country correction made while Google details are pending", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    let resolveDetails: ((place: unknown, status: string) => void) | undefined;
    vi.stubGlobal("google", { maps: { places: {
      AutocompleteService: class {
        getPlacePredictions(_request: unknown, callback: Function) {
          callback([{ description: "Berlin, Germany", place_id: "berlin-id" }], "OK");
        }
      },
      PlacesService: class {
        getDetails(_request: unknown, callback: typeof resolveDetails) { resolveDetails = callback; }
      },
    } } });
    try {
      await renderReady(<SiteCaptureStart />);
      fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin TX" } });
      fireEvent.mouseDown(await screen.findByText("Berlin, Germany"));
      fireEvent.change(region()!, { target: { value: "us" } });
      await act(async () => resolveDetails?.({ address_components: [{ short_name: "DE", types: ["country"] }] }, "OK"));
      expect(region()!.value).toBe("us");
      expect(screen.queryByText(/Country: Outside the United States\./)).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });

  it("does not ask for a country up front", async () => {
    await renderReady(<SiteCaptureStart />);
    expect(region()).toBeNull();
    expect(screen.queryByText("Which country is the site in?")).toBeNull();
  });

  it("takes the country from the address that was picked, and offers a correction", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Austin", state: "Texas", country: "United States", countrycode: "US" }]));
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "austin" } });

    fireEvent.mouseDown(await screen.findByText("Austin, Texas, United States"));

    expect(await screen.findByText(/Country: United States\./)).toBeInTheDocument();
    expect(region()).toBeNull();
    expect(screen.queryByText(/During the beta we can only take walkthroughs/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(region()!.value).toBe("us");
  });

  it("says up front that a site outside the US cannot be recorded yet", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "munich" } });

    fireEvent.mouseDown(await screen.findByText("Munich, Germany"));

    expect(await screen.findByText(/Country: Outside the United States\./)).toBeInTheDocument();
    expect(screen.getByText(/During the beta we can only take walkthroughs/)).toBeInTheDocument();
  });

  it("shows unresolved country before Start and focuses it if an incomplete form is submitted", async () => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Berlin" } });
    expect(region()).not.toBeNull();
    expect(region()!.value).toBe("");
    fireEvent.click(document.querySelector("#start-rights")!);

    fireEvent.submit(screen.getByRole("form"));

    expect(region()).not.toBeNull();
    expect(region()!.value).toBe("");
    expect(document.activeElement).toBe(region());
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
  });
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: account.user, loading: account.loading }) }));


it("asks where the robot would do the task, not where the video was filmed", async () => {
  await renderReady(<SiteCaptureStart />);
  const label = document.querySelector('label[for="start-location"]')!;
  expect(label).toHaveTextContent(/^Where would the robot do this task\?/);
  expect(label).not.toHaveTextContent(/filmed/i);
});

it("clears an inferred country when the address is edited, but preserves an explicit correction", async () => {
  fetchMock.mockResolvedValue(photon([{ name: "Austin", countrycode: "US" }]));
  await renderReady(<SiteCaptureStart />);
  const location = document.querySelector("#start-location")!;
  fireEvent.change(location, { target: { value: "austin" } });
  fireEvent.mouseDown(await screen.findByText("Austin"));
  fireEvent.click(await screen.findByRole("button", { name: "Change" }));
  expect(region()!.value).toBe("us");
  fireEvent.change(location, { target: { value: "Berlin" } });
  expect(region()!.value).toBe("");
  fireEvent.change(region()!, { target: { value: "non_us" } });
  fireEvent.change(location, { target: { value: "Berlin Mitte" } });
  expect(region()!.value).toBe("non_us");
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
  fireEvent.click(document.querySelector("#start-rights")!);
  // A bare city is ambiguous: its visible country fallback still needs a choice.
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.change(region()!, { target: { value: "us" } });
  fireEvent.submit(screen.getByRole("form"));
}

function postsTo(url: string) {
  return fetchMock.mock.calls.filter(c => c[0] === url && c[1]?.method === "POST");
}

it("saves a description with explicit site authority and no recording or fee grant", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: "/capture-upload/tok.signed" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
  expect(document.querySelector("#start-description-authority")).toBeNull();
  expect(screen.getByText(/I am authorized to share this job description/)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.change(region()!, { target: { value: "us" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Open your job and assessment" });
  const payload = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(payload).toMatchObject({ descriptionOnly: true, descriptionAuthority: { granted: true, statementVersion: "2026-10-06.v1" }, consentAttestation: null });
  expect(payload.matchFee).toBeUndefined();
  expect(upload.send).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /camera|uploader/i })).not.toBeInTheDocument();
});

it("does not require a description or goal, but asks for usable work before a prose-only submission", async () => {
  signedIn({ workspaceType: "site_operator" }, []);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  expect(document.querySelector("#start-task")).not.toBeRequired();
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.submit(screen.getByRole("form"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Add a video or a short explanation of the work.");
  expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
});

it("asks one question about the video and asks for recording rights only when a video is involved", async () => {
  await renderReady(<SiteCaptureStart />);
  expect(screen.getByRole("group", { name: "How will we see the task?" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Film it later on a phone" })).toBeChecked();
  expect(document.querySelector("#start-filmer")).toBeNull();
  expect(document.querySelector("#start-name")).toBeNull();
  expect(document.querySelector("#start-rights")).not.toBeRequired();

  fireEvent.click(screen.getByRole("radio", { name: "Upload a video now" }));
  expect(document.querySelector("#start-rights")).toBeRequired();

  fireEvent.click(screen.getByRole("radio", { name: "Have Blueprint film it" }));
  expect(document.querySelector("#start-rights")).toBeNull();
});

it.each([["phone", "self_capture"], ["visit", "site_visit"]])("sends the capture mode for the chosen way (%s)", async (method, captureMode) => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: null } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  fireEvent.click(document.querySelector(`#start-method-${method}`)!);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
  if (method === "phone") fireEvent.click(document.querySelector("#start-rights")!);
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.change(region()!, { target: { value: "us" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Saved in your workspace" });
  const payload = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(payload.filmerContact).toBeUndefined();
  expect(payload.captureMode).toBe(captureMode);
  expect(payload.consentAttestation?.granted ?? null).toBe(method === "phone" ? true : null);
});

it("saves signed-in captures to the authenticated workspace and reuses the request on retry", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: false, body: { message: "Try again" } }, { ok: true, body: { captureUrl: null } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  fillAndSubmit();
  await screen.findByRole("alert");
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Saved in your workspace" });
  const calls = postsTo("/api/workspace/capture-start");
  expect(calls).toHaveLength(2);
  expect(calls[0][1].headers.Authorization).toBe("Bearer owner-token");
  expect(JSON.parse(calls[0][1].body).requestId).toBe(JSON.parse(calls[1][1].body).requestId);
  expect(JSON.parse(calls[0][1].body).retryToken).toMatch(/^[a-zA-Z0-9_-]{32,128}$/);
  expect(JSON.parse(calls[0][1].body).retryToken).toBe(JSON.parse(calls[1][1].body).retryToken);
  expect(JSON.parse(calls[0][1].body).consentAttestation.granted).toBe(true);
  expect(postsTo("/api/inbound-request")).toHaveLength(0);
  expect(document.querySelector("#start-email")).toBeNull();
});

it("tells a robot-team account up front that the site goes to the emailed link, and never blocks it", async () => {
  signedIn({ workspaceType: "robot_team" }, [{ ok: true, body: { captureUrl: "https://example.test/capture" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Signed in as owner@example.com, which is not a site workspace/);
  fillAndSubmit();
  await screen.findByText(/saved to the link we email owner@example.com/);
  expect(screen.queryByRole("link", { name: "Saved in your workspace" })).toBeNull();
  expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
  expect(postsTo("/api/inbound-request")).toHaveLength(1);
});

it("falls back to the emailed link with the same answers when the workspace refuses the account", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: false, status: 403, body: { error: "This action requires a site account." } }, { ok: true, body: { captureUrl: null } }]);
  await renderReady(<SiteCaptureStart />);
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
    if (String(url).startsWith("/api/site-task-brief/") && String(url).endsWith("/status")) {
      return { ok: true, json: async () => ({ status: { headline: received ? "We have your recording." : "Film the work area.", stage: null }, captureReceived: received }) };
    }
    if (String(url).endsWith("/api/self-capture/uploads/tok.signed/status")) {
      return { ok: true, json: async () => ({ state: "ready", captureReceived: received, uploadState: received ? "processing_ready" : "not_received" }) };
    }
    if (init?.method === "POST") return { ok: true, status: 200, json: async () => ({ captureUrl }) };
    return photon([]);
  });
  await renderReady(<SiteCaptureStart />);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
  fireEvent.click(document.querySelector("#start-rights")!);
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.change(region()!, { target: { value: "us" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Your job description is saved.", { selector: "h2" });
  expect(screen.getByRole("link", { name: "Open your job and assessment" })).toHaveAttribute("href", captureUrl);
  expect(screen.getByText(/add footage only when it resolves a missing fact/)).toBeInTheDocument();
  expect(screen.queryByText(/No app and nothing to install/)).toBeNull();

  received = true;
  await screen.findByText("Your recording is in.", { selector: "h2" }, { timeout: 10_000 });
  expect(fetchMock).toHaveBeenCalledWith("/api/self-capture/uploads/tok.signed/status");
  expect(fetchMock).not.toHaveBeenCalledWith("/api/self-capture/uploads/tok.signed");
  expect(screen.getByRole("link", { name: "Open your job and assessment" })).toHaveAttribute("href", captureUrl);
  expect(screen.queryByRole("link", { name: "Open your job page" })).toBeNull();
  expect(screen.queryByRole("img", { name: "Point your phone at this to film" })).toBeNull();
}, 15_000);

describe("SiteCaptureStart and a video that already exists", () => {
  const captureUrl = "https://tryblueprint.io/capture-upload/tok.signed";
  const video = () => new File(["frames"], "cycle.mov", { type: "video/quicktime" });

  function answerPosts(body: Record<string, unknown>) {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).startsWith("/api/site-task-brief/") && String(url).endsWith("/status")) return { ok: true, json: async () => ({ status: { headline: "", stage: null }, captureReceived: false }) };
      if (init?.method === "POST") return { ok: true, status: 200, json: async () => body };
      return photon([]);
    });
  }

  function fillFor(video: File | null) {
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
    fireEvent.click(document.querySelector("#start-method-upload")!);
    if (video) fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
    fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
    fireEvent.change(document.querySelector("#start-company")!, { target: { value: "Acme Foods" } });
  fireEvent.click(document.querySelector("#start-rights")!);
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.change(region()!, { target: { value: "us" } });
    fireEvent.submit(screen.getByRole("form"));
  }

  it("asks for the upload only when that is the chosen way, and offers video only", async () => {
    await renderReady(<SiteCaptureStart />);
    expect(document.querySelector("#start-footage")).toBeNull();

    fireEvent.click(document.querySelector("#start-method-upload")!);

    const input = document.querySelector("#start-footage") as HTMLInputElement;
    expect(input).toBeRequired();
    expect(input.accept).toContain(".mp4");
    expect(input.accept).not.toMatch(/image/);
    expect(screen.queryByText(/photos/i)).toBeNull();

    fireEvent.click(document.querySelector("#start-method-phone")!);
    expect(document.querySelector("#start-footage")).toBeNull();
  });

  it("refuses a file that is not a .mov or .mp4 before anything is sent", async () => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [new File(["x"], "site.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/not a \.mov or \.mp4/);
  });

  it("does not ask for the upload from a site outside the US", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    await renderReady(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    expect(document.querySelector("#start-footage")).not.toBeNull();

    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "munich" } });
    fireEvent.mouseDown(await screen.findByText("Munich, Germany"));

    await screen.findByText(/Hold on to the video for now/);
    expect(document.querySelector("#start-footage")).toBeNull();
  });

  it("creates the task, then sends the video through the capture link", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    const file = video();
    await renderReady(<SiteCaptureStart />);
    fillFor(file);

    await screen.findByText("Your recording is in.", { selector: "h2" });
    const [, init] = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(JSON.parse(init.body)).toMatchObject({ captureMode: "self_capture", hasExistingFootage: true, captureRegion: "us", firstName: "", company: "Acme Foods" });
    expect(JSON.parse(init.body).filmerContact).toBeUndefined();
    expect(JSON.parse(init.body)).not.toHaveProperty("budgetBucket");
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
    expect(screen.getByRole("link", { name: "Open your job and assessment" })).toHaveAttribute("href", captureUrl);
  });

  it("starts from authorized footage without requiring a written description or inventing a target", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    const file = video();
    await renderReady(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [file] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
    fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
    fireEvent.change(document.querySelector("#start-company")!, { target: { value: "Acme Foods" } });
    fireEvent.click(document.querySelector("#start-rights")!);
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("Your recording is in.", { selector: "h2" });
    const submitted = JSON.parse(postsTo("/api/inbound-request")[0][1].body);
    expect(submitted).toMatchObject({ taskStatement: "", taskDescription: "", descriptionOnly: false,
      hasExistingFootage: true, siteTaskGates: {}, siteTaskSpec: {},
      publicTaskListing: { details: { title: "Work assessment opportunity" } } });
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
  });

  it("keeps the job when the video does not send, and links to the uploader", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "failed", message: "The connection dropped before the video finished." });
    await renderReady(<SiteCaptureStart />);
    fillFor(video());

    await screen.findByText("Your job is saved. Check your video upload.", { selector: "h2" });
    expect(screen.getByText(/Keep your original video and open your job page/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing was lost|Film the work, not the worker/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the uploader" })).toHaveAttribute("href", `${captureUrl}?video=existing`);
    expect(screen.queryByRole("img", { name: "Point your phone at this to film" })).not.toBeInTheDocument();
    expect(screen.getByText("Open this job on another device (optional)").closest("details")).not.toHaveAttribute("open");
  });

  it("retries the selected original file without creating a second job after metadata failure", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValueOnce({ status: "failed", message: "This browser could not read the video's frame rate. Keep your original video." })
      .mockResolvedValueOnce({ status: "done" });
    await renderReady(<SiteCaptureStart />); const original = video(); fillFor(original);
    fireEvent.click(await screen.findByRole("button", { name: "Try the selected video again" }));
    await screen.findByRole("heading", { name: "Your recording is in." });
    expect(upload.send.mock.calls[1][1]).toBe(original);
    expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  });

  it("shows a retained processing failure and retries without another file upload", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "processing_pending", message: "Your video is saved. We could not confirm that processing started.", processingRetryAvailable: true });
    let finishRetry!: (result: { status: "done" }) => void;
    upload.retry.mockImplementation(() => new Promise((resolve) => { finishRetry = resolve; }));
    await renderReady(<SiteCaptureStart />);
    fillFor(video());
    await screen.findByRole("heading", { name: "Video received. Processing is not confirmed." });
    expect(screen.queryByText(/The video did not send|Nothing was lost/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /film/i })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Retry processing" });
    fireEvent.click(button); fireEvent.click(button);
    expect(upload.retry).toHaveBeenCalledTimes(1);
    expect(upload.retry).toHaveBeenCalledWith("tok.signed");
    finishRetry({ status: "done" });
    await screen.findByRole("heading", { name: "Your recording is in." });
    expect(upload.send).toHaveBeenCalledTimes(1);
  });

  it("offers no processing retry for a current consent or authorization hold", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "held", message: "Processing is on hold until current consent is confirmed." });
    await renderReady(<SiteCaptureStart />); fillFor(video());
    await screen.findByText(/current consent is confirmed/);
    expect(screen.queryByRole("button", { name: "Retry processing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /film/i })).not.toBeInTheDocument();
  });

  it("does not create a job or upload existing footage without rights consent", async () => {
    answerPosts({ captureUrl }); await renderReady(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video()] } });
    fireEvent.submit(screen.getByRole("form"));
    expect(upload.send).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
  });

  it("guards a repeated Start while the first intake is still saving", async () => {
    let intakeCalls = 0;
    fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "POST") { intakeCalls++; return new Promise(() => undefined); }
      return photon([]);
    });
    await renderReady(<SiteCaptureStart />); fillFor(video());
    fireEvent.submit(screen.getByRole("form"));
    await vi.waitFor(() => expect(intakeCalls).toBe(1));
    expect(upload.send).not.toHaveBeenCalled();
  });

  it("does not send the video when no camera link comes back", async () => {
    answerPosts({ captureUrl: null });
    await renderReady(<SiteCaptureStart />);
    fillFor(video());

    await screen.findByRole("heading", { level: 2 });
    expect(upload.send).not.toHaveBeenCalled();
  });
});

describe("SiteCaptureStart identity fields", () => {
  it("asks for an email and a company, not a name", async () => {
    await renderReady(<SiteCaptureStart />);
    expect(document.querySelector("#start-name")).toBeNull();
    expect(document.querySelector("#start-email")).toBeRequired();
    expect(document.querySelector("#start-company")).toBeRequired();
    expect(document.querySelector('label[for="start-company"]')!.textContent).not.toMatch(/optional/i);
  });

  it("asks a signed-in account for neither, since the account has both", async () => {
    account.user = { uid: "owner-1", email: "owner@example.com", getIdToken: async () => "owner-token" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ workspaceType: "site_operator" }) });
    await renderReady(<SiteCaptureStart />);
    expect(document.querySelector("#start-name")).toBeNull();
    expect(document.querySelector("#start-company")).toBeNull();
  });
});


it("recovers the same intake identity and draft after a lost response and reload", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: false, body: { message: "Connection lost after save" } }, { ok: true, body: { captureUrl: "/capture-upload/tok.signed" } }]);
  const first = await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  fillAndSubmit();
  await screen.findByRole("alert");
  const original = postsTo("/api/workspace/capture-start")[0][1].body;
  first.unmount();
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  expect(document.querySelector<HTMLTextAreaElement>("#start-task")!.value).toBe("Pack cartons");
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Open your job and assessment" });
  expect(postsTo("/api/workspace/capture-start")[1][1].body).toBe(original);
});


const intakeCases = ["phone", "upload", "visit"].flatMap(method => ["Austin, TX", "London UK", "Berlin, Germany", "Toronto, Canada", "Austin TX 78701"]
  .flatMap(location => ["rejected", "saved"].map(outcome => ({ method, location, outcome }))))
  .map((parameters, index) => ({ caseId: `A-I-${String(index + 1).padStart(3, "0")}`, ...parameters }));
it.each(intakeCases)("$caseId $method intake $location $outcome", async ({ method, location, outcome }) => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: outcome === "saved", status: outcome === "saved" ? 201 : 422,
    body: outcome === "saved" ? { captureUrl: "/capture-upload/tok.signed" } : { message: "Correct the task description" } }]);
  upload.send.mockResolvedValue({ status: "done" });
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  fireEvent.click(document.querySelector(`#start-method-${method}`)!);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Move sealed cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
  const rights = document.querySelector("#start-rights");
  if (rights) fireEvent.click(rights);
  const file = document.querySelector("#start-footage");
  if (file) fireEvent.change(file, { target: { files: [new File(["synthetic"], "original.mp4", { type: "video/mp4" })] } });
  fireEvent.submit(screen.getByRole("form"));
  if (outcome === "rejected") await screen.findByText("Correct the task description");
  else await screen.findByRole("link", { name: "Saved in your workspace" });
  const post = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(post.captureMode).toBe(method === "visit" ? "site_visit" : "self_capture");
  expect(post.captureRegion).toBe(location.startsWith("Austin") ? "us" : "non_us");
  if (!location.startsWith("Austin")) expect(upload.send).not.toHaveBeenCalled();
});

it("allows corrected fields after a proven validation rejection", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: false, status: 422, body: { message: "Correct task" } }, { ok: true, body: { captureUrl: null } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  fillAndSubmit();
  await screen.findByText("Correct task");
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Corrected task" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Saved in your workspace" });
  const posts = postsTo("/api/workspace/capture-start").map(call => JSON.parse(call[1].body));
  expect(posts[1].taskDescription).toBe("Corrected task");
  expect(posts[1].requestId).toBe(posts[0].requestId);
});


it("replays uncertain original answers without attaching newly selected footage", async () => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/self-capture")) return { ok: true, json: async () => ({ captureReceived: false }) };
    const count = postsTo("/api/inbound-request").length;
    return count === 1 ? { ok: false, status: 503, json: async () => ({ message: "Uncertain save" }) }
      : { ok: true, status: 201, json: async () => ({ captureUrl: "/capture-upload/tok.signed" }) };
  });
  await renderReady(<SiteCaptureStart />);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Original task" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "original@example.invalid" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Uncertain save");
  fireEvent.click(document.querySelector("#start-method-upload")!);
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "other@example.invalid" } });
  fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [new File(["synthetic"], "new.mp4")] } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Open your job and assessment" });
  expect(upload.send).not.toHaveBeenCalled();
  expect(screen.getByText(/email it to original@example.invalid/)).toBeInTheDocument();
  const posts = postsTo("/api/inbound-request");
  expect(posts[1][1].body).toBe(posts[0][1].body);
});

it("isolates account drafts after an authenticated account switch", async () => {
  signedIn({ workspaceType: "site_operator" }, []);
  const view = await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Account A private task" } });
  account.user = { uid: "owner-2", email: "other@example.invalid", getIdToken: async () => "other-token" };
  view.rerender(<SiteCaptureStart />);
  await screen.findByText(/other@example.invalid/);
  expect(document.querySelector<HTMLTextAreaElement>("#start-task")!.value).toBe("");
});


it("waits for auth resolution before reading a private anonymous draft", async () => {
  window.localStorage.setItem("bp-site-capture-draft-v1:anonymous", JSON.stringify({
    version: 1, createdAt: Date.now(), requestId: "capture-1234567890123456", retryToken: "12345678901234567890123456789012ab",
    fields: {}, method: "phone", region: "us", saved: { status: "done", email: "qa@example.invalid", regionApproved: true,
      hasFootage: false, selfRecording: true, uploaded: "none", processingRetryAvailable: false, linkOnlyNote: null, uploadMessage: null, captureUrl: "/capture-upload/private-synthetic", workspaceUrl: null },
  }));
  account.loading = true;
  await renderReady(<SiteCaptureStart />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your account");
  expect(screen.queryByRole("link", { name: "Open your job and assessment" })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});


it("recomputes an inferred country after restoring and editing a draft", async () => {
  const first = await renderReady(<SiteCaptureStart />);
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin TX" } });
  first.unmount();
  await renderReady(<SiteCaptureStart />);
  expect(screen.getByText(/Country: United States/)).toBeInTheDocument();
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Berlin, Germany" } });
  expect(screen.getByText(/Country: Outside the United States/)).toBeInTheDocument();
});


it("restores all anonymous required fields before the first create attempt", async () => {
  const first = await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Move sealed cartons"], ["start-location", "Austin TX"], ["start-email", "qa@example.invalid"], ["start-company", "Owned QA"]]) {
    fireEvent.change(document.querySelector(`#${id}`)!, { target: { value } });
  }
  first.unmount();
  await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Move sealed cartons"], ["start-location", "Austin TX"], ["start-email", "qa@example.invalid"], ["start-company", "Owned QA"]]) {
    expect(document.querySelector<HTMLInputElement>(`#${id}`)!.value).toBe(value);
  }
});

it("A-R-033 v2 a pre-mounted tab replays the same uncertain request despite edited answers", async () => {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/self-capture")) return { ok: true, json: async () => ({ captureReceived: false }) };
    return postsTo("/api/inbound-request").length === 1
      ? { ok: false, status: 503, json: async () => ({ message: "Uncertain save" }) }
      : { ok: true, status: 201, json: async () => ({ captureUrl: "/capture-upload/tok.signed" }) };
  });
  const first = await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Original task"], ["start-location", "Austin TX"], ["start-email", "qa@example.invalid"], ["start-company", "Owned QA"]]) {
    fireEvent.change(first.container.querySelector(`#${id}`)!, { target: { value } });
  }
  const second = await renderReady(<SiteCaptureStart />);
  fireEvent.change(second.container.querySelector("#start-task")!, { target: { value: "Other task in stale tab" } });
  fireEvent.submit(first.container.querySelector("form")!);
  await screen.findByText("Uncertain save");
  fireEvent.change(second.container.querySelector("#start-company")!, { target: { value: "Another edit after dispatch" } });
  fireEvent.submit(second.container.querySelector("form")!);
  await screen.findByRole("link", { name: "Open your job and assessment" });
  const posts = postsTo("/api/inbound-request");
  expect(posts).toHaveLength(2);
  expect(posts[1][1].body).toBe(posts[0][1].body);
});
it("RETURN-PERSISTED-RELOAD-001 keeps restored fields in both stores before submitting the same intake", async () => {
  fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => ({ok: true, status: 201,
    json: async () => init?.method === "POST" ? {captureUrl: "/capture-upload/fixture.signed"} : {features: []}}));
  const first = await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Restored task"], ["start-location", "Austin TX"],
    ["start-email", "fixture@example.invalid"], ["start-company", "Owned fixture"]]) {
    fireEvent.change(document.querySelector(`#${id}`)!, {target: {value}});
  }
  await act(async () => {});
  const key = "bp-site-capture:v1:anonymous:default";
  const previous = JSON.parse(localStorage.getItem(key)!);
  expect(previous.draft.task).toBe("Restored task");
  first.unmount(); await renderReady(<SiteCaptureStart />);
  expect(document.querySelector("#start-task")).toHaveValue("Restored task");
  const restored = JSON.parse(localStorage.getItem(key)!);
  expect(restored.draft).toEqual(previous.draft);
  expect(durability.rows.get(key)?.value?.draft).toEqual(previous.draft);
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", {name: "Your job description is saved."});
  expect(postsTo("/api/inbound-request")).toHaveLength(1);
  expect(JSON.parse(postsTo("/api/inbound-request")[0][1].body)).toMatchObject({requestId: previous.requestId,
    retryToken: previous.retryToken, taskStatement: "Restored task"});
});

it.each([true, false])("discloses the generated public summary and honors private handling (private: %s)", async privateHandling => {
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ captureUrl: "https://tryblueprint.io/capture-upload/fixture", captureRegion: "us" }) }));
  await renderReady(<SiteCaptureStart />);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Acme at 123 High Street slides dishwasher racks" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.test" } });
  expect(screen.getByLabelText("Generated public summary")).not.toHaveTextContent(/Acme|123 High/);
  if (privateHandling) fireEvent.click(screen.getByLabelText(/keep this job private instead/i));
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Open your job and assessment" });
  const submitted = postsTo("/api/inbound-request")[0];
  const body = JSON.parse(submitted[1].body);
  expect(Boolean(body.publicTaskListing)).toBe(!privateHandling);
  if (!privateHandling) expect(body.publicTaskListing).toMatchObject({ consent: true, statementVersion: "public-task-card-v1", details: { title: "Dish handling opportunity" } });
});
