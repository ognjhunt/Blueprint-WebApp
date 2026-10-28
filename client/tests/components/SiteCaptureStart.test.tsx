// @vitest-environment jsdom
/**
 * The country, from the address rather than beside it.
 *
 * The form used to ask "which country" as a question of its own, right under
 * "where is it", which made a legal residency decision the operator's job twice
 * over. The address answers it, so the country is not asked for at all. The
 * select opens only when a typed or picked location does not resolve to a
 * country. That fallback is visible before Start, because the country decides
 * whether we may collect footage at all.
 */
import { act, fireEvent, render as renderView, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClientEnvCacheForTests } from "@/lib/client-env";

import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { siteCaptureDraftKey } from "@/lib/siteCaptureDraft";
import { anonymizedOpportunityDraft } from "@/types/taskBrowse";
import { renderToString } from "react-dom/server";
import { SITE_CAPTURE_START_FORM, siteCaptureStartSubmission } from "../../../server/tests/helpers/siteCaptureStartSubmission";

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
// The account a guest creates with the form, held off the page's own sign-in.
const created = vi.hoisted(() => ({ create: vi.fn(), google: vi.fn(), verify: vi.fn(), current: vi.fn() }));
vi.mock("@/lib/accountAuth", () => ({ createDetachedPasswordAccount: created.create, sendAccountVerification: created.verify,
  createDetachedGoogleAccount: created.google, detachedAccountUser: created.current }));
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
    const { task, location, email, company, method, region, regionManuallySet, privateHandling, jobFrequency, purchaseReadiness } = value.draft;
    durability.rows.set(key, { retired: false, value: {
      version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
      draft: { task, location, email, company, method, region, regionManuallySet, ...(privateHandling === true ? { privateHandling } : {}), ...(jobFrequency ? { jobFrequency } : {}), ...(purchaseReadiness ? { purchaseReadiness } : {}) },
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
  resetClientEnvCacheForTests();
  durability.rows.clear();
  vi.stubGlobal("navigator", { userAgent: navigator.userAgent, locks: { request: async (_key: string, action: () => unknown) => action() } });
  window.localStorage.clear();
  window.sessionStorage.clear();
  account.user = null;
  account.loading = false;
  fetchMock.mockReset();
  upload.send.mockReset();
  upload.retry.mockReset();
  created.create.mockReset().mockResolvedValue({ uid: "new-site", email: "owner@example.com", getIdToken: async () => "new-site-token" });
  created.google.mockReset().mockResolvedValue({ uid: "google-site", email: "google-owner@example.com", getIdToken: async () => "google-site-token" });
  created.verify.mockReset().mockResolvedValue(undefined);
  created.current.mockReset().mockResolvedValue(null);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FormData", window.FormData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function region() {
  return document.querySelector("#start-region") as HTMLSelectElement | null;
}

// The country is not printed any more. A US location shows neither the country select nor the
// outside-the-US notice; a non-US one shows the notice.
const nonUsNotice = /During the beta we can only take walkthroughs/;
function expectInferredUnitedStates() {
  expect(region()).toBeNull();
  expect(screen.queryByText(nonUsNotice)).toBeNull();
}
function expectInferredOutsideUnitedStates() {
  expect(screen.getByText(nonUsNotice)).toBeInTheDocument();
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
  it("retains the filled current address across reload even when the prior address had the same country", async () => {
    fetchMock.mockResolvedValue(photon([{ housenumber: "200", street: "East Main Street", city: "Durham", state: "NC", country: "United States", countrycode: "US" }]));
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 35.9940321, longitude: -78.8986192 } } as GeolocationPosition) } });
    const view = await renderReady(<SiteCaptureStart />);
    const input = document.querySelector("#start-location")!;
    fireEvent.change(input, { target: { value: "Austin, TX" } });
    expectInferredUnitedStates();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    const address = "200 East Main Street, Durham, NC, United States";
    await waitFor(() => expect(input).toHaveValue(address));
    const key = siteCaptureDraftKey(null, "default");
    await waitFor(() => expect(durability.rows.get(key)?.value.draft).toMatchObject({ location: address, region: "us" }));
    expect(JSON.stringify(durability.rows.get(key))).not.toMatch(/"(?:latitude|longitude|lat|lng)"/);
    view.unmount();
    await renderReady(<SiteCaptureStart />);
    expect(document.querySelector("#start-location")).toHaveValue(address);
    expect(screen.getByRole("button", { name: "Use my location" })).toBeInTheDocument();
    expectInferredUnitedStates();
  });

  it.each(["Austin, TX", "austin tx", "Austin, Texas, United States", "Austin, TX 78701"])("recognizes an explicit US job location before Start (%s)", async (location) => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
    expectInferredUnitedStates();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["Paris", "Georgia", "Vancouver, CA", "Austin, TX, Germany", "123 Main St", "123 Main St.", "10 High ST", "Warehouse near us"])("asks for the country in the address at Start for unresolved geography (%s)", async (location) => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
    expect(region()).toBeNull();
    expect(screen.queryByText(nonUsNotice)).toBeNull();
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByText(/Add the country to the address/)).toBeInTheDocument();
    expect(postsTo("/api/inbound-request")).toHaveLength(0);
    expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
  });

  it.each(["Berlin, Germany", "London UK", "Toronto, Canada"])("recognizes explicit non-US geography and keeps its upload hold (%s)", async (location) => {
    await renderReady(<SiteCaptureStart />);
    chooseUploadNow();
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
    expectInferredOutsideUnitedStates();
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
    expectInferredUnitedStates();
    fireEvent.change(location, { target: { value: "Paris" } });
    expect(screen.queryByText(nonUsNotice)).toBeNull();
    fireEvent.change(location, { target: { value: "Paris, France" } });
    expectInferredOutsideUnitedStates();
    fireEvent.change(location, { target: { value: "" } });
    expect(region()).toBeNull();
    expect(screen.queryByText(nonUsNotice)).toBeNull();
  });

  it("clears the prior inferred country while a new Google pick awaits details and ignores details after another edit", async () => {
    let resolveDetails: ((place: unknown) => void) | undefined;
    try {
      signedIn({ workspaceType: "site_operator" }, []);
      const previousFetch = fetchMock.getMockImplementation()!;
      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.startsWith("/api/location-autocomplete/country")) return { ok: true, json: () => new Promise((resolve) => { resolveDetails = resolve; }) };
        if (url.startsWith("/api/location-autocomplete")) return { ok: true, json: async () => ({ suggestions: [{ label: "Berlin, Germany", placeId: "fixture-berlin" }] }) };
        return previousFetch(url, init);
      });
      await renderReady(<SiteCaptureStart />);
      await screen.findByText(/Saving to your workspace/);
      fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Slide the racks" } });
      const location = document.querySelector("#start-location")!;
      fireEvent.change(location, { target: { value: "Austin TX" } });
      expectInferredUnitedStates();
      fireEvent.click(await screen.findByText("Berlin, Germany"));
      expect((location as HTMLInputElement).value).toBe("Berlin, Germany");
      expect(screen.queryByText(nonUsNotice)).toBeNull();
      fireEvent.submit(screen.getByRole("form"));
      expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
      await waitFor(() => expect(resolveDetails).toBeTypeOf("function"));
      fireEvent.change(location, { target: { value: "Austin TX" } });
      await act(async () => { resolveDetails?.({ countryCode: "DE" }); });
      await waitFor(expectInferredUnitedStates);
    } finally { vi.unstubAllEnvs(); }
  });

  it("recovers a denied Google country lookup by correcting the address", async () => {
    let resolveDetails: ((place: unknown) => void) | undefined;
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url.startsWith("/api/location-autocomplete/country")) return { ok: true, json: () => new Promise((resolve) => { resolveDetails = resolve; }) };
      if (url.startsWith("/api/location-autocomplete")) return { ok: true, json: async () => ({ suggestions: [{ label: "Warehouse", placeId: "fixture-warehouse" }] }) };
      return init?.method === "POST"
        ? { ok: true, status: 200, json: async () => ({ captureUrl: "https://example.test/capture-upload/fixture.synthetic" }) } : photon([]);
    });
    try {
      await renderReady(<SiteCaptureStart />);
      fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
      fireEvent.change(document.querySelector("#start-email")!, { target: { value: "fixture@example.invalid" } });
      fireEvent.change(document.querySelector("#start-company")!, { target: { value: "Fixture company" } });
      const location = document.querySelector("#start-location")!;
      fireEvent.change(location, { target: { value: "Warehouse" } });
      fireEvent.click(await screen.findByText("Warehouse"));
      await waitFor(() => expect(resolveDetails).toBeTypeOf("function"));
      await act(async () => { resolveDetails!({ countryCode: null }); });
      fireEvent.submit(screen.getByRole("form"));
      expect(screen.getByText(/Add the country to the address/)).toBeInTheDocument();
      expect(postsTo("/api/inbound-request")).toHaveLength(0);
      expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
      fireEvent.change(location, { target: { value: "Austin, TX" } });
      fireEvent.submit(screen.getByRole("form"));
      await screen.findByText("Film the work area.", { selector: "h2" });
      expect(postsTo("/api/inbound-request")).toHaveLength(1);
      expect(JSON.parse(postsTo("/api/inbound-request")[0][1].body)).toMatchObject({
        siteLocation: "Austin, TX", captureRegion: "us", descriptionOnly: true, consentAttestation: null,
      });
    } finally { vi.unstubAllEnvs(); }
  });

  it("does not ask for a country up front", async () => {
    await renderReady(<SiteCaptureStart />);
    expect(region()).toBeNull();
    expect(screen.queryByText("Which country is the site in?")).toBeNull();
  });

  it("takes the country from the address that was picked", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Austin", state: "Texas", country: "United States", countrycode: "US" }]));
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "austin" } });

    fireEvent.click(await screen.findByText("Austin, Texas, United States"));

    await waitFor(expectInferredUnitedStates);
  });

  it("says up front that a site outside the US cannot be recorded yet", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "munich" } });

    fireEvent.click(await screen.findByText("Munich, Germany"));

    expect(await screen.findByText(nonUsNotice)).toBeInTheDocument();
  });

  it("asks for the country in the address and focuses it if an incomplete form is submitted", async () => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Berlin" } });

    fireEvent.submit(screen.getByRole("form"));

    expect(screen.getByText(/Add the country to the address/)).toBeInTheDocument();
    expect(document.activeElement).toBe(document.querySelector("#start-location"));
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
  });
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: account.user, loading: account.loading }) }));


it("asks where the robot would do the task, not where the video was filmed", async () => {
  await renderReady(<SiteCaptureStart />);
  const label = document.querySelector('label[for="start-location"]')!;
  expect(label).toHaveTextContent(/^Where does the work happen\?/);
  expect(label).not.toHaveTextContent(/filmed/i);
});

it("keeps location controls out of the address field's spoken label", async () => {
  await renderReady(<SiteCaptureStart />);
  const input = screen.getByRole("combobox", { name: "Where does the work happen?", exact: true });
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(screen.getByRole("status", { name: "Location preference" })).toHaveTextContent("Couldn’t find your location");
  expect(input).toHaveAccessibleName("Where does the work happen?");
  expect(input.closest("label")).toBeNull();
});

it("clears an inferred country when the address is edited", async () => {
  fetchMock.mockResolvedValue(photon([{ name: "Austin", countrycode: "US" }]));
  await renderReady(<SiteCaptureStart />);
  const location = document.querySelector("#start-location")!;
  fireEvent.change(location, { target: { value: "austin" } });
  fireEvent.click(await screen.findByText("Austin"));
  expectInferredUnitedStates();
  fireEvent.change(location, { target: { value: "Berlin" } });
  expect(screen.queryByText(nonUsNotice)).toBeNull();
  fireEvent.change(location, { target: { value: "Berlin, Germany" } });
  expectInferredOutsideUnitedStates();
});

function signedIn(setup: { ok?: boolean; workspaceType?: string | null; siteSetupAvailable?: boolean }, posts: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  account.user = { uid: "owner-1", email: "owner@example.com", getIdToken: async () => "owner-token" };
  const queue = [...posts];
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/workspace/setup") return { ok: setup.ok !== false, json: async () => ({ workspaceType: setup.workspaceType ?? null, siteSetupAvailable: setup.siteSetupAvailable === true }) };
    const next = queue.shift() ?? { ok: true };
    return { ok: next.ok, status: next.status ?? (next.ok ? 200 : 500), json: async () => next.body ?? {} };
  });
}

function fillAndSubmit() {
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.submit(screen.getByRole("form"));
}

function postsTo(url: string) {
  return fetchMock.mock.calls.filter(c => c[0] === url && c[1]?.method === "POST");
}

/**
 * Choose "Upload a video now". The video goes with the form for a signed-in
 * site account, and for a guest, who creates its account with the form.
 */
function chooseUploadNow() {
  fireEvent.click(document.querySelector("#start-method-upload")!);
}

it("prepares the phone capture with explicit description authority and no recording or fee grant", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: "/capture-upload/tok.signed" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  expect(document.querySelector("#start-description-authority")).toBeNull();
  expect(screen.getByText(/I am authorized to share this job description/)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Film the work area." });
  const payload = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(payload).toMatchObject({ descriptionOnly: true, descriptionAuthority: { granted: true, statementVersion: "2026-10-06.v1" }, consentAttestation: null });
  expect(payload.matchFee).toBeUndefined();
  expect(upload.send).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Open your job page" })).toHaveAttribute("href", "/capture-upload/tok.signed");
  expect(screen.queryByRole("link", { name: "Open your job and assessment" })).not.toBeInTheDocument();
});

it("prepares the phone capture without a written description and waits for the video", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: "/capture-upload/tok.signed" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  expect(document.querySelector("#start-task")).not.toBeRequired();
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Film the work area." });
  expect(JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body)).toMatchObject({
    taskStatement: "", taskDescription: "", captureMode: "self_capture", hasExistingFootage: false,
    descriptionOnly: true, consentAttestation: null,
  });
  expect(screen.getByText(/Assessment starts once we receive the video/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Open your job and assessment" })).not.toBeInTheDocument();
  expect(upload.send).not.toHaveBeenCalled();
});

it("asks one question about the video and offers no separate rights step", async () => {
  await renderReady(<SiteCaptureStart />);
  const videoChoices = screen.getByRole("group", { name: "How will we see the task?" });
  expect(videoChoices.closest("details")).toBeNull();
  expect(document.querySelector("#start-task")!.closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText(/We use it to draft the description/)).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Film it on a phone · Right after this form" })).toBeChecked();
  expect(document.querySelector("#start-filmer")).toBeNull();
  expect(document.querySelector("#start-name")).toBeNull();
  expect(document.querySelector("#start-rights")).toBeNull();

  fireEvent.click(screen.getByRole("radio", { name: "Upload a video now" }));
  expect(document.querySelector("#start-rights")).toBeNull();
  // A guest creates its account with the form, so the video is asked for here.
  expect(document.querySelector("#start-footage")).toBeRequired();
  expect(document.querySelector("#start-password")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use email and password instead" }));
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "fixture@example.invalid" } });
  fireEvent.change(document.querySelector("#start-company")!, { target: { value: "Fixture company" } });
  expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
  expect(upload.send).not.toHaveBeenCalled();
  const key = siteCaptureDraftKey(null, "default");
  await waitFor(() => {
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ pending: null });
    expect(durability.rows.get(key)?.value).toMatchObject({ pending: null });
  });
});

it.each([["phone", "self_capture"], ["visit", "site_visit"]])("sends the capture mode for the chosen way (%s)", async (method, captureMode) => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: null } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  fireEvent.click(document.querySelector(`#start-method-${method}`)!);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("link", { name: "Saved in your workspace" });
  const payload = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(payload.filmerContact).toBeUndefined();
  expect(payload.captureMode).toBe(captureMode);
  expect(payload.consentAttestation).toBeNull();
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
  expect(JSON.parse(calls[0][1].body).consentAttestation).toBeNull();
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

it("lets a signed-in account with no workspace type yet send the job and its video with the form", async () => {
  signedIn({ workspaceType: null, siteSetupAvailable: true }, [{ ok: true, body: { captureUrl: "https://tryblueprint.io/capture-upload/tok.signed" } }]);
  upload.send.mockResolvedValue({ status: "done" });
  const file = new File(["frames"], "cycle.mov", { type: "video/quicktime" });
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
  chooseUploadNow();
  fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [file] } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Your recording is in.", { selector: "h2" });
  expect(postsTo("/api/workspace/capture-start")).toHaveLength(1);
  expect(postsTo("/api/inbound-request")).toHaveLength(0);
  expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
});

// A legacy-role account (a capturer, say) has no workspace type but is never
// set up as a site by the form, so it is not offered an upload that would wait.
it("tells a legacy-role account up front that its video waits, rather than offering the upload", async () => {
  signedIn({ workspaceType: null, siteSetupAvailable: false }, [{ ok: true, body: { captureUrl: "https://example.test/capture" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Signed in as owner@example.com, which is not a site workspace/);
  chooseUploadNow();
  expect(document.querySelector("#start-footage")).toBeNull();
  expect(screen.getByRole("note", { name: "Save this job to an account first" })).toBeInTheDocument();
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
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Film the work area.", { selector: "h2" });
  expect(screen.getByRole("link", { name: "Open your job page" })).toHaveAttribute("href", captureUrl);
  expect(screen.queryByRole("link", { name: "Open your job and assessment" })).toBeNull();
  expect(screen.getByText(/Assessment starts once we receive the video/)).toBeInTheDocument();
  expect(screen.queryByText(/No app and nothing to install/)).toBeNull();

  received = true;
  await screen.findByText("Your recording is in.", { selector: "h2" }, { timeout: 10_000 });
  expect(fetchMock).toHaveBeenCalledWith("/api/self-capture/uploads/tok.signed/status");
  expect(fetchMock).not.toHaveBeenCalledWith("/api/self-capture/uploads/tok.signed");
  expect(screen.getByRole("link", { name: "Open your job and assessment" })).toHaveAttribute("href", captureUrl);
  expect(screen.queryByRole("link", { name: "Open your job page" })).toBeNull();
  expect(screen.queryByRole("img", { name: "Point your phone at this to film" })).toBeNull();
}, 15_000);

/**
 * The video goes with the form only for a signed-in site account, which owns
 * the job from the start: footage waits for a saved job (owner decision
 * 2026-10-18), so a guest's video waits for the account instead.
 */
describe("SiteCaptureStart and a video that already exists", () => {
  const captureUrl = "https://tryblueprint.io/capture-upload/tok.signed";
  const video = () => new File(["frames"], "cycle.mov", { type: "video/quicktime" });
  const SITE_SETUP = { ok: true, json: async () => ({ workspaceType: "site_operator" }) };

  beforeEach(() => {
    account.user = { uid: "owner-1", email: "owner@example.com", getIdToken: async () => "owner-token" };
    fetchMock.mockImplementation(async (url: string) => String(url) === "/api/workspace/setup" ? SITE_SETUP : photon([]));
  });

  async function renderAsSiteAccount() {
    await renderReady(<SiteCaptureStart />);
    await screen.findByText(/Saving to your workspace as owner@example.com/);
  }

  function answerPosts(body: Record<string, unknown>) {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url) === "/api/workspace/setup") return SITE_SETUP;
      if (String(url).startsWith("/api/site-task-brief/") && String(url).endsWith("/status")) return { ok: true, json: async () => ({ status: { headline: "", stage: null }, captureReceived: false }) };
      if (init?.method === "POST") return { ok: true, status: 200, json: async () => body };
      return photon([]);
    });
  }

  function fillFor(video: File | null) {
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
    chooseUploadNow();
    if (video) fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
    fireEvent.submit(screen.getByRole("form"));
  }

  it("asks for the upload only when that is the chosen way, and offers video only", async () => {
    await renderAsSiteAccount();
    expect(document.querySelector("#start-footage")).toBeNull();

    chooseUploadNow();

    const input = document.querySelector("#start-footage") as HTMLInputElement;
    expect(input).toBeRequired();
    expect(input.accept).toContain(".mp4");
    expect(input.accept).not.toMatch(/image/);
    expect(screen.queryByText(/photos/i)).toBeNull();

    fireEvent.click(document.querySelector("#start-method-phone")!);
    expect(document.querySelector("#start-footage")).toBeNull();
  });

  it("refuses a file that is not a .mov or .mp4 before anything is sent", async () => {
    await renderAsSiteAccount();
    chooseUploadNow();
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [new File(["x"], "site.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/not a \.mov or \.mp4/);
  });

  it("does not ask for the upload from a site outside the US", async () => {
    fetchMock.mockImplementation(async (url: string) => String(url) === "/api/workspace/setup" ? SITE_SETUP
      : photon([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    await renderAsSiteAccount();
    chooseUploadNow();
    expect(document.querySelector("#start-footage")).not.toBeNull();

    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "munich" } });
    fireEvent.click(await screen.findByText("Munich, Germany"));

    await screen.findByText(/Hold on to the video for now/);
    expect(document.querySelector("#start-footage")).toBeNull();
  });

  it("creates the task, then sends the video through the capture link", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    const file = video();
    await renderAsSiteAccount();
    fillFor(file);

    await screen.findByText("Your recording is in.", { selector: "h2" });
    const [, init] = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(JSON.parse(init.body)).toMatchObject({ captureMode: "self_capture", hasExistingFootage: true, captureRegion: "us" });
    expect(JSON.parse(init.body).filmerContact).toBeUndefined();
    expect(JSON.parse(init.body)).not.toHaveProperty("budgetBucket");
    expect(JSON.parse(init.body).consentAttestation).toEqual({ granted: true, statementVersion: "2026-09-18.v1" });
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
    expect(screen.getByRole("link", { name: "Open your job and assessment" })).toHaveAttribute("href", captureUrl);
  });

  it("starts from authorized footage without requiring a written description or inventing a target", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    const file = video();
    await renderAsSiteAccount();
    chooseUploadNow();
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [file] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("Your recording is in.", { selector: "h2" });
    const submitted = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
    expect(submitted).toMatchObject({ taskStatement: "", taskDescription: "", descriptionOnly: false,
      hasExistingFootage: true, siteTaskGates: {}, siteTaskSpec: {},
      publicTaskListing: { details: { title: "Work assessment opportunity" } } });
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
  });

  // The server journey that proves an approved robot team can request an
  // evaluation on this job starts from this exact body, never a hand-built record.
  // It is a new site's body: the account is created with the form, and the job
  // and its video are sent under it.
  it("sends the exact body the request-step journey starts from", async () => {
    account.user = null;
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: SITE_CAPTURE_START_FORM.task } });
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.click(screen.getByRole("button", { name: "Use email and password instead" }));
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video()] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: SITE_CAPTURE_START_FORM.location } });
    fireEvent.change(document.querySelector("#start-email")!, { target: { value: SITE_CAPTURE_START_FORM.email } });
    fireEvent.change(document.querySelector("#start-company")!, { target: { value: SITE_CAPTURE_START_FORM.company } });
    fireEvent.change(document.querySelector("#start-password")!, { target: { value: "correct horse" } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("heading", { name: "Your recording is in." });
    const sent = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
    expect(sent).toEqual(siteCaptureStartSubmission({ requestId: sent.requestId, retryToken: sent.retryToken,
      sourcePageUrl: window.location.href }));
  });

  it("keeps the job when the video does not send, and links to the uploader", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "failed", message: "The connection dropped before the video finished." });
    await renderAsSiteAccount();
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
    await renderAsSiteAccount(); const original = video(); fillFor(original);
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
    await renderAsSiteAccount();
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
    await renderAsSiteAccount(); fillFor(video());
    await screen.findByText(/current consent is confirmed/);
    expect(screen.queryByRole("button", { name: "Retry processing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /film/i })).not.toBeInTheDocument();
  });

  it("does not create a job or freeze recording consent when upload mode has no file", async () => {
    answerPosts({ captureUrl }); await renderAsSiteAccount();
    fillFor(null);
    expect((document.querySelector("#start-footage") as HTMLInputElement).files).toHaveLength(0);
    expect(screen.queryByText(/Add the country to the address/)).toBeNull();
    expect(upload.send).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
    const key = siteCaptureDraftKey("owner-1", "default");
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ pending: null });
      expect(durability.rows.get(key)?.value).toMatchObject({ pending: null });
    });
  });

  it("guards a repeated Start while the first intake is still saving", async () => {
    let intakeCalls = 0;
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url) === "/api/workspace/setup") return SITE_SETUP;
      if (init?.method === "POST") { intakeCalls++; return new Promise(() => undefined); }
      return photon([]);
    });
    await renderAsSiteAccount(); fillFor(video());
    fireEvent.submit(screen.getByRole("form"));
    await vi.waitFor(() => expect(intakeCalls).toBe(1));
    expect(upload.send).not.toHaveBeenCalled();
  });

  it("does not send the video when no camera link comes back", async () => {
    answerPosts({ captureUrl: null });
    await renderAsSiteAccount();
    fillFor(video());

    await screen.findByRole("heading", { level: 2 });
    expect(upload.send).not.toHaveBeenCalled();
  });
});

describe("SiteCaptureStart identity fields", () => {
  it("needs an email for a recording link and defers the company profile", async () => {
    await renderReady(<SiteCaptureStart />);
    expect(document.querySelector("#start-name")).toBeNull();
    expect(document.querySelector("#start-email")).toBeRequired();
    expect(document.querySelector("#start-company")).not.toBeRequired();
    expect(document.querySelector('label[for="start-company"]')!.textContent).toMatch(/optional/i);
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
  await screen.findByRole("heading", { name: "Film the work area." });
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


it("replays uncertain original answers, ignoring later edits", async () => {
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
  chooseUploadNow();
  fireEvent.click(screen.getByRole("button", { name: "Use email and password instead" }));
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "other@example.invalid" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Film the work area." });
  // The original answers replay as sent: no account is created and no file goes.
  expect(created.create).not.toHaveBeenCalled();
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
  expectInferredUnitedStates();
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Berlin, Germany" } });
  expectInferredOutsideUnitedStates();
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

it("preserves optional job frequency and buying stage across reload and submits them without requiring a budget", async () => {
  fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => ({ ok: true,
    json: async () => init?.method === "POST" ? { captureUrl: "/capture-upload/buying-context.signed" } : { features: [] } }));
  const first = await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Move sealed cartons"], ["start-location", "Austin TX"],
    ["start-email", "qa@example.invalid"], ["start-company", "Owned QA"],
    ["start-frequency", "200 cartons each weekday"], ["start-readiness", "ready_for_proposals"]]) {
    fireEvent.change(document.querySelector(`#${id}`)!, { target: { value } });
  }
  const key = siteCaptureDraftKey(null, "default");
  await waitFor(() => expect(durability.rows.get(key)?.value.draft).toMatchObject({
    jobFrequency: "200 cartons each weekday", purchaseReadiness: "ready_for_proposals",
  }));
  first.unmount();
  await renderReady(<SiteCaptureStart />);
  expect(document.querySelector("#start-frequency")).toHaveValue("200 cartons each weekday");
  expect(document.querySelector("#start-readiness")).toHaveValue("ready_for_proposals");
  expect(document.querySelector('[name*="Budget"]')).toBeNull();
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Film the work area." });
  expect(JSON.parse(postsTo("/api/inbound-request")[0][1].body)).toMatchObject({
    siteTaskSpec: { jobFrequency: "200 cartons each weekday", purchaseReadiness: "ready_for_proposals" },
    descriptionOnly: true,
  });
  expect(upload.send).not.toHaveBeenCalled();
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
  await screen.findByRole("heading", { name: "Film the work area." });
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
  await screen.findByRole("heading", {name: "Film the work area."});
  expect(postsTo("/api/inbound-request")).toHaveLength(1);
  expect(JSON.parse(postsTo("/api/inbound-request")[0][1].body)).toMatchObject({requestId: previous.requestId,
    retryToken: previous.retryToken, taskStatement: "Restored task"});
});

// Every job is shown to approved robot teams as an anonymized card, generated by
// the same function the server checks the grant against. There is no private
// option at start (owner direction 2026-10-22); the site hides it from its job page.
it("lists every job as an anonymized card and offers no private option", async () => {
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ captureUrl: "https://tryblueprint.io/capture-upload/fixture", captureRegion: "us" }) }));
  await renderReady(<SiteCaptureStart />);
  const task = "Acme at 123 High Street slides dishwasher racks";
  fireEvent.change(document.querySelector("#start-task")!, { target: { value: task } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.test" } });
  expect(screen.queryByRole("checkbox", { name: /private/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Sharing your job")).not.toBeInTheDocument();
  expect(screen.getByText(/Approved robot teams see an anonymized summary of the job; your video, address and contacts stay private\./)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Film the work area." });
  const body = JSON.parse(postsTo("/api/inbound-request")[0][1].body);
  expect(body.publicTaskListing).toEqual({ consent: true, statementVersion: "public-task-card-v1", details: anonymizedOpportunityDraft(task) });
});

it("tells a site uploading footage that people seen or heard must know, and that sound is removed", async () => {
  signedIn({ workspaceType: "site_operator" }, []);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  expect(screen.queryByText(/People seen or heard in it must know/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Upload a video now" }));
  expect(screen.getByText("Only upload footage you may share. People seen or heard in it must know it is shared with Blueprint, "
    + "so avoid clips with conversations. We remove sound before any automated review.")).toBeInTheDocument();
});

it("offers account setup only after the site and job have been saved", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ captureUrl: "/capture-upload/job.saved", claimUrl: "/claim/job.signed" }) });
  await renderReady(<SiteCaptureStart />);
  expect(screen.queryByRole("link", { name: "Create an account for this job" })).not.toBeInTheDocument();
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } }); fillAndSubmit();
  expect(await screen.findByRole("link", { name: "Create an account for this job" })).toHaveAttribute("href", "/claim/job.signed");
  expect(screen.getByRole("link", { name: "Sign in to save this job" })).toHaveAttribute("href", "/claim/job.signed?mode=signin");
  // Not optional: the scene robot teams evaluate is built only for a saved job.
  const account = screen.getByRole("region", { name: "Save this job to your account" });
  expect(account).toHaveTextContent("Save the job to an account with owner@example.com before sending video or preparing a site-specific evaluation.");
  expect(account).not.toHaveTextContent(/optional/i);
  expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  expect(postsTo("/api/inbound-request")).toHaveLength(1);
});

/**
 * Audit P1-8: the Pipeline refuses to prepare footage whose owner changed after
 * upload (`website_preparation_status.py`), and the scene robot teams evaluate
 * is built only for a claimed site. So a guest sending video creates its
 * account with the form (owner decision 2026-10-22): the job is born owned and
 * the video goes with it, in one step, without signing this page in.
 */
describe("SiteCaptureStart creates a guest's account with the form so its video goes now", () => {
  const captureUrl = "https://tryblueprint.io/capture-upload/tok.signed";
  const video = () => new File(["frames"], "cycle.mov", { type: "video/quicktime" });
  function answer(body: Record<string, unknown>, status = 200) {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).startsWith("/api/site-task-brief/") && String(url).endsWith("/status")) return { ok: true, json: async () => ({ status: { headline: "", stage: null }, captureReceived: false }) };
      if (String(url).endsWith("/api/self-capture/uploads/tok.signed/status")) return { ok: true, json: async () => ({ state: "ready", captureReceived: false, uploadState: "not_received" }) };
      if (init?.method === "POST") return { ok: status < 400, status, json: async () => body };
      return photon([]);
    });
  }
  function fillGuest(password = "correct horse") {
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.click(screen.getByRole("button", { name: "Use email and password instead" }));
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video()] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: SITE_CAPTURE_START_FORM.location } });
    fireEvent.change(document.querySelector("#start-email")!, { target: { value: "Owner@Example.com" } });
    fireEvent.change(document.querySelector("#start-company")!, { target: { value: SITE_CAPTURE_START_FORM.company } });
    fireEvent.change(document.querySelector("#start-password")!, { target: { value: password } });
  }

  it("offers password-free ownership first and keeps email sign-up as an explicit alternative", async () => {
    await renderReady(<SiteCaptureStart />);
    expect(document.querySelector("#start-password")).toBeNull();
    fireEvent.click(document.querySelector("#start-method-upload")!);
    expect(document.querySelector("#start-footage")).toBeRequired();
    expect(document.querySelector("#start-password")).toBeNull();
    expect(document.querySelector("#start-email")).toBeNull();
    expect(document.querySelector("#start-company")).not.toBeRequired();
    fireEvent.click(screen.getByRole("button", { name: "Use email and password instead" }));
    const password = document.querySelector("#start-password") as HTMLInputElement;
    expect(password).toBeRequired();
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByRole("link", { name: "Sign in first" })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByRole("note", { name: "Save this job to an account first" })).not.toBeInTheDocument();
    // Filming later on a phone or by Blueprint asks for no account here.
    fireEvent.click(document.querySelector("#start-method-phone")!);
    expect(document.querySelector("#start-password")).toBeNull();
  });

  it("remembers the form when the guest signs in first", async () => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.click(screen.getByRole("button", { name: "Use email and password instead" }));
    fireEvent.click(screen.getByRole("link", { name: "Sign in first" }));
    expect(window.sessionStorage.getItem("redirectAfterAuth")).toBe(`${window.location.pathname}${window.location.search}`);
  });

  it("saves an owned job and sends its video without company details or a password", async () => {
    answer({ captureUrl }); upload.send.mockResolvedValue({ status: "done" });
    await renderReady(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: SITE_CAPTURE_START_FORM.location } });
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video()] } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("heading", { name: "Your recording is in." });
    expect(created.google).toHaveBeenCalledOnce(); expect(created.create).not.toHaveBeenCalled();
    const saved = postsTo("/api/workspace/capture-start")[0][1];
    expect(saved.headers).toMatchObject({ Authorization: "Bearer google-site-token" });
    expect(JSON.parse(saved.body)).toMatchObject({ email: "google-owner@example.com", company: "" });
    expect(created.verify).not.toHaveBeenCalled();
    expect(upload.send).toHaveBeenCalledWith("tok.signed", expect.any(File), expect.any(Function));
  });
  it("creates an optional password account, saves the job under it and sends the video in one step", async () => {
    answer({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    await renderReady(<SiteCaptureStart />);
    fillGuest();
    fireEvent.submit(screen.getByRole("form"));

    await screen.findByRole("heading", { name: "Your recording is in." });
    expect(created.create).toHaveBeenCalledWith("owner@example.com", "correct horse");
    expect(created.verify).toHaveBeenCalledWith(expect.objectContaining({ uid: "new-site" }), `${window.location.origin}/app`);
    const [[, request]] = postsTo("/api/workspace/capture-start");
    expect(request.headers).toMatchObject({ Authorization: "Bearer new-site-token" });
    expect(postsTo("/api/inbound-request")).toHaveLength(0);
    expect(upload.send).toHaveBeenCalledWith("tok.signed", expect.any(File), expect.any(Function));
    // The password never reaches a draft or a recovery body.
    expect(request.body).not.toContain("correct horse");
    expect(JSON.stringify([...durability.rows.values()])).not.toContain("correct horse");
    expect(Object.values({ ...localStorage }).join("")).not.toContain("correct horse");
  });

  it("retries an uncertain save under the account it just created, without creating another", async () => {
    let saves = 0;
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (init?.method !== "POST") return photon([]);
      saves += 1;
      return saves === 1 ? { ok: false, status: 503, json: async () => ({ message: "Uncertain save" }) }
        : { ok: true, status: 201, json: async () => ({ captureUrl }) };
    });
    await renderReady(<SiteCaptureStart />);
    fillGuest();
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("Uncertain save");
    created.current.mockResolvedValue({ uid: "new-site", email: "owner@example.com", getIdToken: async () => "new-site-token" });
    fireEvent.click(screen.getByRole("button", { name: "Recover saved job" }));
    await screen.findByRole("link", { name: "Saved in your workspace" });
    const saved = postsTo("/api/workspace/capture-start");
    expect(saved).toHaveLength(2);
    expect(saved[1][1].headers).toMatchObject({ Authorization: "Bearer new-site-token" });
    expect(saved[1][1].body).toBe(saved[0][1].body);
    expect(created.create).toHaveBeenCalledTimes(1);
  });

  it("asks an existing account holder to sign in, and saves nothing", async () => {
    answer({ captureUrl });
    created.create.mockRejectedValue(Object.assign(new Error("Firebase: Error (auth/email-already-in-use)."), { code: "auth/email-already-in-use" }));
    await renderReady(<SiteCaptureStart />);
    fillGuest();
    fireEvent.submit(screen.getByRole("form"));
    expect(await screen.findByRole("alert")).toHaveTextContent("An account already uses this email. Sign in first to upload the video here.");
    expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
    expect(upload.send).not.toHaveBeenCalled();
  });

  it("asks for a longer password before creating anything", async () => {
    answer({ captureUrl });
    await renderReady(<SiteCaptureStart />);
    fillGuest("short");
    fireEvent.submit(screen.getByRole("form"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a password of 8 characters or more.");
    expect(created.create).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
  });

  it("gives a filled honeypot no account", async () => {
    answer({ captureUrl: null });
    await renderReady(<SiteCaptureStart />);
    fillGuest();
    fireEvent.change(document.querySelector("#start-website-hp")!, { target: { value: "https://spam.example" } });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(postsTo("/api/inbound-request")).toHaveLength(1));
    expect(created.create).not.toHaveBeenCalled();
  });

  it("sends the video with the form for a signed-in site account, which owns the job from the start", async () => {
    signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl } }]);
    upload.send.mockResolvedValue({ status: "done" });
    const file = video();
    await renderReady(<SiteCaptureStart />);
    await screen.findByText(/Saving to your workspace as owner@example.com/);
    fireEvent.click(document.querySelector("#start-method-upload")!);
    expect(screen.queryByRole("note", { name: "Save this job to an account first" })).not.toBeInTheDocument();
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [file] } });
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("link", { name: "Saved in your workspace" });
    expect(postsTo("/api/workspace/capture-start")).toHaveLength(1);
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
  });
});

it("says when we reply, right above the start button", async () => {
  const { REPLY_TIMELINE } = await import("@/data/betaTimelines");
  await renderReady(<SiteCaptureStart />);
  const note = screen.getByRole("note", { name: "How long it takes" });
  expect(note).toHaveTextContent(REPLY_TIMELINE);
  expect(note.nextElementSibling).toBe(screen.getByRole("button", { name: "Start free assessment" }));
});
