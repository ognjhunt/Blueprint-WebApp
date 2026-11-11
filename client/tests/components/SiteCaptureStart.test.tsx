// @vitest-environment jsdom
/**
 * Country permission is explicit when no optional address establishes it.
 * An inferred country is not asked twice; no street address is required
 * (Blueprint filming visits are retired, 2026-11-11).
 */
import { act, fireEvent, render as renderView, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClientEnvCacheForTests } from "@/lib/client-env";

import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { siteCaptureDraftKey } from "@/lib/siteCaptureDraft";
import { RECORDING_RIGHTS_STATEMENT } from "@/lib/recordingRightsStatement";
import { SITE_START_CONSENT_NO_VIDEO, SITE_START_CONSENT_WITH_VIDEO } from "@/lib/siteStartConsent";
import { TASK_CONFIRMATION_STATEMENT, TASK_CONFIRMATION_VERSION } from "@/lib/taskConfirmationStatement";
const SHARE_LABEL = "Also share an anonymised summary of this job with robot companies Blueprint has approved (optional)";
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
const created = vi.hoisted(() => ({ create: vi.fn(), verify: vi.fn(), current: vi.fn() }));
vi.mock("@/lib/accountAuth", () => ({ createDetachedPasswordAccount: created.create, sendAccountVerification: created.verify,
  detachedAccountUser: created.current }));
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
    const { task, location, email, method, region, regionManuallySet, privateHandling, jobFrequency, purchaseReadiness } = value.draft;
    durability.rows.set(key, { retired: false, value: {
      version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
      draft: { task, location, email, method, region, regionManuallySet, ...(privateHandling === true ? { privateHandling } : {}), ...(jobFrequency ? { jobFrequency } : {}), ...(purchaseReadiness ? { purchaseReadiness } : {}) },
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
  // A sub-screen lives in the URL's hash; every test starts on the form itself.
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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
  created.verify.mockReset().mockResolvedValue(undefined);
  created.current.mockReset().mockResolvedValue(null);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FormData", window.FormData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The optional sentence in the site's words; typing it is the confirmation (owner direction 2026-11-11). */
function describeTask(task: string, root: ParentNode = document) {
  fireEvent.change(root.querySelector("#start-task")!, { target: { value: task } });
}

/** The optional details live on their own screen (bare bones, 2026-11-11), one quiet link away. */
function openDetails() {
  fireEvent.click(screen.getByRole("button", { name: "Add details (optional) ›" }));
}

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

  it.each(["Paris", "Georgia", "Vancouver, CA", "Austin, TX, Germany", "123 Main St", "123 Main St.", "10 High ST", "Warehouse near us"])("asks for country permission without requiring a fuller address (%s)", async (location) => {
    await renderReady(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
    expect(region()).toBeInTheDocument();
    expect(screen.queryByText(nonUsNotice)).toBeNull();
    fireEvent.submit(screen.getByRole("form"));
    expect(screen.getByText(/Choose the site country so/)).toBeInTheDocument();
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
    describeTask("Slide the dishwasher racks");
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
    expect(region()).toBeInTheDocument();
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
      describeTask("Slide the racks");
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
      describeTask("Pack cartons");
      fireEvent.change(document.querySelector("#start-email")!, { target: { value: "fixture@example.invalid" } });
      const location = document.querySelector("#start-location")!;
      fireEvent.change(location, { target: { value: "Warehouse" } });
      fireEvent.click(await screen.findByText("Warehouse"));
      await waitFor(() => expect(resolveDetails).toBeTypeOf("function"));
      await act(async () => { resolveDetails!({ countryCode: null }); });
      fireEvent.submit(screen.getByRole("form"));
      expect(screen.getByText(/Choose the site country so/)).toBeInTheDocument();
      expect(postsTo("/api/inbound-request")).toHaveLength(0);
      expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
      fireEvent.change(location, { target: { value: "Austin, TX" } });
      fireEvent.submit(screen.getByRole("form"));
      await screen.findByText("Now film the job.", { selector: "h1" });
      expect(postsTo("/api/inbound-request")).toHaveLength(1);
      expect(JSON.parse(postsTo("/api/inbound-request")[0][1].body)).toMatchObject({
        siteLocation: "Austin, TX", captureRegion: "us", descriptionOnly: true, consentAttestation: null,
      });
    } finally { vi.unstubAllEnvs(); }
  });

  it("offers country permission without requiring an address or guessing a country", async () => {
    await renderReady(<SiteCaptureStart />);
    expect(region()).toHaveValue("");
    expect(document.querySelector("#start-location")).not.toBeRequired();
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

  it("focuses country permission if no country was supplied", async () => {
    await renderReady(<SiteCaptureStart />);
    describeTask("Pack cartons");
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Berlin" } });

    fireEvent.submit(screen.getByRole("form"));

    expect(screen.getByText(/Choose the site country so/)).toBeInTheDocument();
    expect(document.activeElement).toBe(region());
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
  });
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: account.user, loading: account.loading }) }));


it("asks where the job is, not for a street address", async () => {
  await renderReady(<SiteCaptureStart />);
  const label = document.querySelector('label[for="start-location"]')!;
  expect(label).toHaveTextContent(/^Where is the job\?/);
  expect(document.querySelector("#start-location")).not.toBeRequired();
  expect(screen.getByText("Street address or city.")).toBeInTheDocument();
});

it("keeps location controls out of the address field's spoken label", async () => {
  await renderReady(<SiteCaptureStart />);
  const input = screen.getByRole("combobox", { name: "Where is the job?", exact: true });
  fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
  expect(screen.getByRole("status", { name: "Location preference" })).toHaveTextContent("Couldn’t find your location");
  expect(input).toHaveAccessibleName("Where is the job?");
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
  describeTask("Pack cartons");
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
  { const toUpload = document.querySelector("#start-method-upload"); if (toUpload) fireEvent.click(toUpload); };
}

it("prepares the phone capture with explicit description authority and no recording or fee grant", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: "/capture-upload/tok.signed" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  describeTask("Pack cartons");
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  expect(document.querySelector("#start-description-authority")).toBeNull();
  // The line under the button is the one the site agrees to; the full statement is one tap away.
  expect(document.querySelector("[data-consent-line]")).toHaveTextContent(SITE_START_CONSENT_NO_VIDEO);
  expect(screen.getByText(/I am authorized to share this job description/)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Now film the job." });
  const payload = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(payload).toMatchObject({ descriptionOnly: true, descriptionAuthority: { granted: true, statementVersion: "2026-11-11.v3" }, consentAttestation: null });
  expect(payload.matchFee).toBeUndefined();
  expect(upload.send).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Open my job page ›" })).toHaveAttribute("href", "/capture-upload/tok.signed");
  expect(screen.queryByRole("link", { name: "Open my job" })).not.toBeInTheDocument();
});

// Owner direction 2026-11-11: a site sends an email and a video; Blueprint drafts the job
// description from the video. The sentence is optional; typing one is the confirmation.
it("leaves the task optional, has no task box, and sends a typed sentence as the confirmation", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: "/capture-upload/tok.signed" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  const task = document.querySelector<HTMLTextAreaElement>("#start-task")!;
  expect(task).not.toBeRequired();
  expect(task.closest("details")).toBeNull();
  openDetails();
  expect(screen.getByLabelText(/The job in one sentence/)).toBe(task);
  // Typing the sentence is the confirmation, so its recorded statement is shown under the field, word for word.
  expect(document.querySelector("#start-task-help")).toHaveTextContent(`Typing here confirms: “${TASK_CONFIRMATION_STATEMENT}”`);
  expect(document.querySelector("#start-task-confirmation")).toBeNull();
  expect(document.querySelector("#start-success")).not.toBeRequired();
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(task, { target: { value: "Pack cartons into the shipping box" } });
  fireEvent.change(document.querySelector("#start-success")!, { target: { value: "Every carton is sealed and upright" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Now film the job." });
  const sent = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(sent).toMatchObject({
    taskStatement: "Pack cartons into the shipping box", taskDescription: "Pack cartons into the shipping box",
    taskConfirmation: { granted: true, statementVersion: TASK_CONFIRMATION_VERSION },
    successCriteria: { successDefinition: "Every carton is sealed and upright" },
    captureMode: "self_capture", hasExistingFootage: false, descriptionOnly: true, consentAttestation: null,
  });
  expect(sent).not.toHaveProperty("publicTaskListing");
  expect(screen.getByText(/One full round of the job, about 30 seconds/)).toBeInTheDocument();
  expect(upload.send).not.toHaveBeenCalled();
});

it("starts the film-on-a-phone path with only a country and an email", async () => {
  fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => ({ ok: true, status: 201,
    json: async () => init?.method === "POST" ? { captureUrl: "/capture-upload/phone.signed" } : { features: [] } }));
  await renderReady(<SiteCaptureStart />);
  fireEvent.change(region()!, { target: { value: "us" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.test" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Now film the job." });
  const sent = JSON.parse(postsTo("/api/inbound-request")[0][1].body);
  expect(sent).toMatchObject({ taskStatement: "", captureMode: "self_capture", captureRegion: "us", descriptionOnly: true,
    descriptionAuthority: { granted: true, statementVersion: "2026-11-11.v3" }, consentAttestation: null, acceptedTerms: true });
  expect(sent).not.toHaveProperty("taskConfirmation");
  expect(sent).not.toHaveProperty("publicTaskListing");
});

it("asks no typed task and no street address, and says it will reply when no job link comes back", async () => {
  fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => ({ ok: true, status: 201,
    json: async () => init?.method === "POST" ? { captureUrl: null } : { features: [] } }));
  await renderReady(<SiteCaptureStart />);
  expect(document.querySelector("#start-task")).not.toBeRequired();
  expect(document.querySelector("#start-location")).not.toBeRequired();
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "100 Congress Ave, Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.test" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "We have your site." });
  expect(screen.getByText("We will reply to owner@example.test with the link to film or upload the video.")).toBeInTheDocument();
  const sent = JSON.parse(postsTo("/api/inbound-request")[0][1].body);
  expect(sent).toMatchObject({ taskStatement: "", captureMode: "self_capture", descriptionOnly: true, consentAttestation: null,
    siteLocation: "100 Congress Ave, Austin, TX" });
  expect(sent).not.toHaveProperty("taskConfirmation");
});

it("asks one question about the video and sets the consent in one line under the button, with the full statements one tap away", async () => {
  await renderReady(<SiteCaptureStart />);
  expect(document.querySelector("#start-task")!.closest("details")).toBeNull();
  // Filming later is the default; the video is one quiet link away.
  expect(screen.getByText("You film it on your phone, right after this.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next: film the job" })).toBeInTheDocument();
  expect(document.querySelector("#start-filmer")).toBeNull();
  expect(document.querySelector("#start-name")).toBeNull();
  expect(document.querySelector("#start-rights")).toBeNull();
  expect(document.querySelector("[data-consent-line]")).toHaveTextContent(SITE_START_CONSENT_NO_VIDEO);
  // Filming later attests nothing here: the job link asks for permission first.
  expect(screen.queryByText(`“${RECORDING_RIGHTS_STATEMENT}”`)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "I have a video ›" }));
  // Sending the video is the grant, so no separate box: one line under the button, and the full statements,
  // word for word, on "What you're agreeing to".
  expect(document.querySelector("#start-rights")).toBeNull();
  // The one box on the form is the optional, unticked sharing choice, on the details screen.
  expect(Array.from(document.querySelectorAll("input[type=checkbox]")).map(box => box.id)).toEqual(["start-share-listing"]);
  const start = screen.getByRole("button", { name: "Send video" });
  const line = document.querySelector("[data-consent-line]")!;
  expect(line).toHaveTextContent(SITE_START_CONSENT_WITH_VIDEO);
  expect(start.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(start).toHaveAttribute("aria-describedby", line.parentElement!.id);
  fireEvent.click(screen.getByRole("button", { name: "What you're agreeing to ›" }));
  expect(screen.getByRole("heading", { name: "What you're agreeing to" })).toBeInTheDocument();
  expect(screen.getByText(`“${RECORDING_RIGHTS_STATEMENT}”`)).toBeVisible();
  expect(screen.getByText("“I am authorized to share this job description with Blueprint on behalf of the site.”")).toBeVisible();
  // A guest's account comes from its email, so the video is asked for here.
  expect(document.querySelector("#start-footage")).toBeRequired();
  expect(document.querySelector("#start-password")).toBeNull();
  describeTask("Pack cartons");
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "fixture@example.invalid" } });
  expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(0);
  expect(upload.send).not.toHaveBeenCalled();
  const key = siteCaptureDraftKey(null, "default");
  await waitFor(() => {
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ pending: null });
    expect(durability.rows.get(key)?.value).toMatchObject({ pending: null });
  });
});

it("offers no Blueprint filming visit and sends self-capture (visits retired 2026-11-11)", async () => {
  const [method, captureMode] = ["phone", "self_capture"];
  signedIn({ workspaceType: "site_operator" }, [{ ok: true, body: { captureUrl: null } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  expect(document.querySelector("#start-method-visit")).toBeNull();
  expect(screen.queryByText(/Have Blueprint film it|Austin metro only|sending someone to film/i)).toBeNull();
  { const toMethod = document.querySelector(`#start-method-${method}`); if (toMethod) fireEvent.click(toMethod); }
  describeTask("Pack cartons");
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
  describeTask("Pack cartons");
  chooseUploadNow();
  fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [file] } });
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("We have your video.", { selector: "h1" });
  expect(postsTo("/api/workspace/capture-start")).toHaveLength(1);
  expect(postsTo("/api/inbound-request")).toHaveLength(0);
  expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
});

// A legacy-role account (a capturer, say) has no workspace type but is never
// set up as a site by the form, so it is not offered an upload that would wait.
it("lets a legacy-role account send footage through its private job link", async () => {
  signedIn({ workspaceType: null, siteSetupAvailable: false }, [{ ok: true, body: { captureUrl: "https://example.test/capture" } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Signed in as owner@example.com, which is not a site workspace/);
  chooseUploadNow();
  expect(document.querySelector("#start-footage")).toBeRequired();
  expect(screen.queryByRole("note", { name: "Save this job to an account first" })).toBeNull();
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
      return { ok: true, json: async () => ({ status: { headline: received ? "We have your recording." : "Now film the job.", stage: null }, captureReceived: received }) };
    }
    if (String(url).endsWith("/api/self-capture/uploads/tok.signed/status")) {
      return { ok: true, json: async () => ({ state: "ready", captureReceived: received, uploadState: received ? "processing_ready" : "not_received" }) };
    }
    if (init?.method === "POST") return { ok: true, status: 200, json: async () => ({ captureUrl }) };
    return photon([]);
  });
  await renderReady(<SiteCaptureStart />);
  describeTask("Pack cartons");
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Now film the job.", { selector: "h1" });
  expect(screen.getByRole("link", { name: "Open my job page ›" })).toHaveAttribute("href", captureUrl);
  expect(screen.queryByRole("link", { name: "Open my job" })).toBeNull();
  expect(screen.getByText(/The recorder opens in your browser/)).toBeInTheDocument();
  expect(screen.queryByText(/No app and nothing to install/)).toBeNull();

  received = true;
  await screen.findByText("We have your video.", { selector: "h1" }, { timeout: 10_000 });
  expect(fetchMock).toHaveBeenCalledWith("/api/self-capture/uploads/tok.signed/status");
  expect(fetchMock).not.toHaveBeenCalledWith("/api/self-capture/uploads/tok.signed");
  expect(screen.getByRole("link", { name: "Open my job" })).toHaveAttribute("href", captureUrl);
  expect(screen.queryByRole("link", { name: "Open my job page ›" })).toBeNull();
  expect(screen.queryByRole("img", { name: "Point your phone's camera at this code to film" })).toBeNull();
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
    describeTask("Pack cartons");
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

    { const toPhone = document.querySelector("#start-method-phone"); if (toPhone) fireEvent.click(toPhone); };
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
    expect(screen.getByText(`“${RECORDING_RIGHTS_STATEMENT}”`)).toBeInTheDocument();

    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "munich" } });
    fireEvent.click(await screen.findByText("Munich, Germany"));

    await screen.findByText(/Hold on to the video for now/);
    expect(document.querySelector("#start-footage")).toBeNull();
    expect(screen.queryByText(`“${RECORDING_RIGHTS_STATEMENT}”`)).toBeNull();
  });

  it("creates the task, then sends the video through the capture link", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    const file = video();
    await renderAsSiteAccount();
    fillFor(file);

    await screen.findByText("We have your video.", { selector: "h1" });
    const [, init] = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(JSON.parse(init.body)).toMatchObject({ captureMode: "self_capture", hasExistingFootage: true, captureRegion: "us" });
    expect(JSON.parse(init.body).filmerContact).toBeUndefined();
    expect(JSON.parse(init.body)).not.toHaveProperty("budgetBucket");
    expect(JSON.parse(init.body).consentAttestation).toEqual({ granted: true, statementVersion: "2026-11-11.v3" });
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
    expect(screen.getByRole("link", { name: "Open my job" })).toHaveAttribute("href", captureUrl);
  });

  // Owner direction 2026-11-11: a video, the country and the account are enough. Nothing is
  // typed, so nothing is confirmed or shared; Blueprint drafts the description from the video.
  it("starts from the video alone: no sentence, no confirmation and no listing are sent", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    const file = video();
    await renderAsSiteAccount();
    chooseUploadNow();
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [file] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("We have your video.", { selector: "h1" });
    const submitted = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
    expect(submitted).toMatchObject({ taskStatement: "", descriptionOnly: false, hasExistingFootage: true,
      siteTaskGates: {}, siteTaskSpec: {}, consentAttestation: { granted: true, statementVersion: "2026-11-11.v3" } });
    expect(submitted).not.toHaveProperty("taskConfirmation");
    expect(submitted).not.toHaveProperty("publicTaskListing");
    expect(submitted).not.toHaveProperty("successCriteria");
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
  });

  // The server journey that proves an approved robot team can request an
  // evaluation on this job starts from this exact body, never a hand-built record.
  // It is a new guest site's body; the signed private job link authorizes upload.
  it("sends the exact body the request-step journey starts from", async () => {
    account.user = null;
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "done" });
    await renderReady(<SiteCaptureStart />);
    describeTask(SITE_CAPTURE_START_FORM.task);
    { const toUpload = document.querySelector("#start-method-upload"); if (toUpload) fireEvent.click(toUpload); };
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video()] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: SITE_CAPTURE_START_FORM.location } });
    fireEvent.change(document.querySelector("#start-email")!, { target: { value: SITE_CAPTURE_START_FORM.email } });
    // The journey is a shared job, so this site chose to share its card.
    openDetails();
    fireEvent.click(screen.getByRole("checkbox", { name: SHARE_LABEL }));
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("heading", { name: "We have your video." });
    const sent = JSON.parse(postsTo("/api/inbound-request")[0][1].body);
    expect(sent).toEqual(siteCaptureStartSubmission({ requestId: sent.requestId, retryToken: sent.retryToken,
      sourcePageUrl: window.location.href }));
  });

  it("keeps the job when the video does not send, and links to the uploader", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "failed", message: "The connection dropped before the video finished." });
    await renderAsSiteAccount();
    fillFor(video());

    await screen.findByText("Your job is saved. Check your video upload.", { selector: "h1" });
    expect(screen.getByText(/Keep your original video and open your job page/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing was lost|Film the work, not the worker/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the uploader ›" })).toHaveAttribute("href", `${captureUrl}?video=existing`);
    expect(screen.queryByRole("img", { name: "Point your phone's camera at this code to film" })).not.toBeInTheDocument();
  });

  it("retries the selected original file without creating a second job after metadata failure", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValueOnce({ status: "failed", message: "This browser could not read the video's frame rate. Keep your original video." })
      .mockResolvedValueOnce({ status: "done" });
    await renderAsSiteAccount(); const original = video(); fillFor(original);
    fireEvent.click(await screen.findByRole("button", { name: "Try the selected video again" }));
    await screen.findByRole("heading", { name: "We have your video." });
    expect(upload.send.mock.calls[1][1]).toBe(original);
    expect(fetchMock.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1);
  });

  it("keeps processing recovery optional after receipt and retries without another file upload", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "processing_pending", message: "Your video is saved. We could not confirm that processing started.", processingRetryAvailable: true });
    let finishRetry!: (result: { status: "done" }) => void;
    upload.retry.mockImplementation(() => new Promise((resolve) => { finishRetry = resolve; }));
    await renderAsSiteAccount();
    fillFor(video());
    await screen.findByRole("heading", { name: "We have your video." });
    expect(screen.getByText(/Blueprint will continue from this saved recording/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry processing" })).not.toBeVisible();
    expect(upload.retry).not.toHaveBeenCalled();
    expect(screen.queryByText(/The video did not send|Nothing was lost/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /film/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Processing details (optional)"));
    const button = screen.getByRole("button", { name: "Retry processing" });
    fireEvent.click(button); fireEvent.click(button);
    expect(upload.retry).toHaveBeenCalledTimes(1);
    expect(upload.retry).toHaveBeenCalledWith("tok.signed");
    finishRetry({ status: "done" });
    await screen.findByRole("heading", { name: "We have your video." });
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

    await screen.findByRole("heading", { level: 1, name: "We have your site." });
    expect(upload.send).not.toHaveBeenCalled();
  });
});

describe("SiteCaptureStart identity fields", () => {
  it("requires an email without a company or password ceremony", async () => {
    await renderReady(<SiteCaptureStart />);
    { const toUpload = document.querySelector("#start-method-upload"); if (toUpload) fireEvent.click(toUpload); };
    expect(document.querySelector("#start-name")).toBeNull();
    expect(document.querySelector("#start-email")).toBeRequired();
    expect(document.querySelector("#start-company")).toBeNull();
    expect(document.querySelector("#start-password")).toBeNull();
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
  await screen.findByRole("heading", { name: "Now film the job." });
  expect(postsTo("/api/workspace/capture-start")[1][1].body).toBe(original);
});


// Visits are retired (2026-11-11), so their ten cases are gone with the option.
const intakeCases = ["phone", "upload"].flatMap(method => ["Austin, TX", "London UK", "Berlin, Germany", "Toronto, Canada", "Austin TX 78701"]
  .flatMap(location => ["rejected", "saved"].map(outcome => ({ method, location, outcome }))))
  .map((parameters, index) => ({ caseId: `A-I-${String(index + 1).padStart(3, "0")}`, ...parameters }));
it.each(intakeCases)("$caseId $method intake $location $outcome", async ({ method, location, outcome }) => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: outcome === "saved", status: outcome === "saved" ? 201 : 422,
    body: outcome === "saved" ? { captureUrl: "/capture-upload/tok.signed" } : { message: "Correct the task description" } }]);
  upload.send.mockResolvedValue({ status: "done" });
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  { const toMethod = document.querySelector(`#start-method-${method}`); if (toMethod) fireEvent.click(toMethod); }
  describeTask("Move sealed cartons");
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: location } });
  const file = document.querySelector("#start-footage");
  if (file) fireEvent.change(file, { target: { files: [new File(["synthetic"], "original.mp4", { type: "video/mp4" })] } });
  fireEvent.submit(screen.getByRole("form"));
  if (outcome === "rejected") await screen.findByText("Correct the task description");
  else await screen.findByRole("link", { name: "Saved in your workspace" });
  const post = JSON.parse(postsTo("/api/workspace/capture-start")[0][1].body);
  expect(post.captureMode).toBe("self_capture");
  expect(post.captureRegion).toBe(location.startsWith("Austin") ? "us" : "non_us");
  if (!location.startsWith("Austin")) expect(upload.send).not.toHaveBeenCalled();
});

it("allows corrected fields after a proven validation rejection", async () => {
  signedIn({ workspaceType: "site_operator" }, [{ ok: false, status: 422, body: { message: "Correct task" } }, { ok: true, body: { captureUrl: null } }]);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  fillAndSubmit();
  await screen.findByText("Correct task");
  describeTask("Corrected task");
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
  describeTask("Original task");
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "original@example.invalid" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Uncertain save");
  chooseUploadNow();
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "other@example.invalid" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Now film the job." });
  // The original answers replay as sent: no account is created and no file goes.
  expect(created.create).not.toHaveBeenCalled();
  expect(upload.send).not.toHaveBeenCalled();
  expect(screen.getByText(/emailed this private link to original@example.invalid/)).toBeInTheDocument();
  const posts = postsTo("/api/inbound-request");
  expect(posts[1][1].body).toBe(posts[0][1].body);
});

it("isolates account drafts after an authenticated account switch", async () => {
  signedIn({ workspaceType: "site_operator" }, []);
  const view = await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace/);
  describeTask("Account A private task");
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
  expect(screen.queryByRole("link", { name: "Open my job" })).not.toBeInTheDocument();
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
  for (const [id, value] of [["start-task", "Move sealed cartons"], ["start-location", "Austin TX"], ["start-email", "qa@example.invalid"]]) {
    fireEvent.change(document.querySelector(`#${id}`)!, { target: { value } });
  }
  first.unmount();
  await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Move sealed cartons"], ["start-location", "Austin TX"], ["start-email", "qa@example.invalid"]]) {
    expect(document.querySelector<HTMLInputElement>(`#${id}`)!.value).toBe(value);
  }
});

it("preserves optional job frequency and buying stage across reload and submits them without requiring a budget", async () => {
  fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => ({ ok: true,
    json: async () => init?.method === "POST" ? { captureUrl: "/capture-upload/buying-context.signed" } : { features: [] } }));
  const first = await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Move sealed cartons"], ["start-location", "Austin TX"],
    ["start-email", "qa@example.invalid"],
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
  await screen.findByRole("heading", { name: "Now film the job." });
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
  for (const [id, value] of [["start-task", "Original task"], ["start-location", "Austin TX"], ["start-email", "qa@example.invalid"]]) {
    fireEvent.change(first.container.querySelector(`#${id}`)!, { target: { value } });
  }
  const second = await renderReady(<SiteCaptureStart />);
  fireEvent.change(second.container.querySelector("#start-task")!, { target: { value: "Other task in stale tab" } });
  fireEvent.submit(first.container.querySelector("form")!);
  await screen.findByText("Uncertain save");
  fireEvent.change(second.container.querySelector("#start-email")!, { target: { value: "another-edit@example.invalid" } });
  fireEvent.submit(second.container.querySelector("form")!);
  await screen.findByRole("heading", { name: "Now film the job." });
  const posts = postsTo("/api/inbound-request");
  expect(posts).toHaveLength(2);
  expect(posts[1][1].body).toBe(posts[0][1].body);
});
it("RETURN-PERSISTED-RELOAD-001 keeps restored fields in both stores before submitting the same intake", async () => {
  fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => ({ok: true, status: 201,
    json: async () => init?.method === "POST" ? {captureUrl: "/capture-upload/fixture.signed"} : {features: []}}));
  const first = await renderReady(<SiteCaptureStart />);
  for (const [id, value] of [["start-task", "Restored task"], ["start-location", "Austin TX"],
    ["start-email", "fixture@example.invalid"]]) {
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
  await screen.findByRole("heading", {name: "Now film the job."});
  expect(postsTo("/api/inbound-request")).toHaveLength(1);
  expect(JSON.parse(postsTo("/api/inbound-request")[0][1].body)).toMatchObject({requestId: previous.requestId,
    retryToken: previous.retryToken, taskStatement: "Restored task"});
});

// Sharing is the site's explicit choice (owner direction 2026-11-11): one unticked box. The card is
// generated by the same function the server checks the grant against; the job page can change it later.
it("shares an anonymised card only when the site ticks the box, and the note is true either way", async () => {
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ captureUrl: "https://tryblueprint.io/capture-upload/fixture", captureRegion: "us" }) }));
  const first = await renderReady(<SiteCaptureStart />);
  const task = "Acme at 123 High Street slides dishwasher racks";
  describeTask(task);
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.test" } });
  openDetails();
  const share = screen.getByRole("checkbox", { name: SHARE_LABEL });
  expect(share).not.toBeChecked();
  expect(share).not.toBeRequired();
  expect(screen.getByText(/Your video, address and contacts stay private\./)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Now film the job." });
  expect(JSON.parse(postsTo("/api/inbound-request")[0][1].body)).not.toHaveProperty("publicTaskListing");
  first.unmount();
  localStorage.clear(); durability.rows.clear();
  window.history.replaceState(null, "", window.location.pathname);

  await renderReady(<SiteCaptureStart />);
  describeTask(task);
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.test" } });
  openDetails();
  fireEvent.click(screen.getByRole("checkbox", { name: SHARE_LABEL }));
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByRole("heading", { name: "Now film the job." });
  const body = JSON.parse(postsTo("/api/inbound-request")[1][1].body);
  expect(body.publicTaskListing).toEqual({ consent: true, statementVersion: "public-task-card-v1", details: anonymizedOpportunityDraft(task) });
});

it("tells a site uploading footage that people seen or heard must know, and that sound is removed", async () => {
  signedIn({ workspaceType: "site_operator" }, []);
  await renderReady(<SiteCaptureStart />);
  await screen.findByText(/Saving to your workspace as owner@example.com/);
  fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin, TX" } });
  expect(screen.queryByText(/People seen or heard in it must know/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "I have a video ›" }));
  expect(screen.getByText("Only upload footage you may share. People seen or heard in it must know it is shared with Blueprint, "
    + "so avoid clips with conversations. We remove sound before any automated review.")).toBeInTheDocument();
});

it("offers account setup only after the site and job have been saved", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ captureUrl: "/capture-upload/job.saved", claimUrl: "/claim/job.signed" }) });
  await renderReady(<SiteCaptureStart />);
  expect(screen.queryByRole("link", { name: "Save to an account ›" })).not.toBeInTheDocument();
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } }); fillAndSubmit();
  // The private link already supports this job; an account stays one optional, quiet link.
  const optional = await screen.findByRole("link", { name: "Save to an account ›" });
  expect(optional).toHaveAttribute("href", "/claim/job.signed");
  expect(screen.getByText(/We also emailed this private link to owner@example.com/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  expect(postsTo("/api/inbound-request")).toHaveLength(1);
});

describe("guest intake without account ceremony", () => {
  const captureUrl="https://tryblueprint.io/capture-upload/tok.signed";
  const video=()=>new File(["frames"],"cycle.mov",{type:"video/quicktime"});
  function answer() { fetchMock.mockImplementation(async (url:string, init?:{method?:string})=> {
    if(init?.method==="POST") return {ok:true,status:201,json:async()=>({captureUrl,claimUrl:"/claim/job.signed"})};
    if(url.includes("/status")) return {ok:true,json:async()=>({captureReceived:false,uploadState:"not_received"})};
    return photon([]);
  }); }
  function fillGuest() {
    { const toUpload = document.querySelector("#start-method-upload"); if (toUpload) fireEvent.click(toUpload); };
    fireEvent.change(document.querySelector("#start-footage")!,{target:{files:[video()]}});
    fireEvent.change(document.querySelector("#start-location")!,{target:{value:"Austin, TX"}});
    fireEvent.change(document.querySelector("#start-email")!,{target:{value:"Owner@Example.com"}});
    describeTask("Pack cartons");
  }
  it("uploads with email and country permission while leaving the site address unknown", async () => {
    answer(); upload.send.mockResolvedValue({ status: "done" });
    await renderReady(<SiteCaptureStart />);
    chooseUploadNow();
    fireEvent.change(region()!, { target: { value: "us" } });
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video()] } });
    fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
    describeTask("Pack cartons");
    expect(document.querySelector("#start-location")).not.toBeRequired();
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("heading", { name: "We have your video." });
    const [[, request]] = postsTo("/api/inbound-request");
    expect(JSON.parse(request.body)).toMatchObject({ siteName: "", siteLocation: "", captureRegion: "us",
      email: "owner@example.com", taskStatement: "Pack cartons", accountSignup: false });
    expect(created.create).not.toHaveBeenCalled();
    expect(upload.send).toHaveBeenCalledWith("tok.signed", expect.any(File), expect.any(Function));
  });
  it("retains country permission across reload without manufacturing an address", async () => {
    answer();
    const view = await renderReady(<SiteCaptureStart />);
    fireEvent.change(region()!, { target: { value: "us" } });
    const key = siteCaptureDraftKey(null, "default");
    await waitFor(() => expect(durability.rows.get(key)?.value.draft).toMatchObject({ location: "", region: "us", regionManuallySet: true }));
    view.unmount();
    await renderReady(<SiteCaptureStart />);
    expect(region()).toHaveValue("us");
    expect(document.querySelector("#start-location")).toHaveValue("");
  });
  it("keeps the outside-US recording hold without requiring a city or address", async () => {
    await renderReady(<SiteCaptureStart />);
    chooseUploadNow();
    fireEvent.change(region()!, { target: { value: "non_us" } });
    expectInferredOutsideUnitedStates();
    expect(document.querySelector("#start-footage")).toBeNull();
    expect(upload.send).not.toHaveBeenCalled();
  });
  it("sends the video under the signed private job link without company or password",async()=>{
    answer(); upload.send.mockResolvedValue({status:"done"}); await renderReady(<SiteCaptureStart/>);fillGuest();
    expect(document.querySelector("#start-password")).toBeNull();
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("heading",{name:"We have your video."});
    expect(created.create).not.toHaveBeenCalled();expect(created.verify).not.toHaveBeenCalled();
    expect(postsTo("/api/workspace/capture-start")).toHaveLength(0);
    const [[,request]]=postsTo("/api/inbound-request");
    expect(JSON.parse(request.body)).toMatchObject({email:"owner@example.com",accountSignup:false});
    expect(JSON.parse(request.body)).not.toHaveProperty("company");
    expect(upload.send).toHaveBeenCalledWith("tok.signed",expect.any(File),expect.any(Function));
  });
  it("does not require an existing email account holder to leave intake to sign in",async()=>{
    answer();created.create.mockRejectedValue({code:"auth/email-already-in-use"});upload.send.mockResolvedValue({status:"done"});
    await renderReady(<SiteCaptureStart/>);fillGuest();fireEvent.submit(screen.getByRole("form"));
    await screen.findByRole("heading",{name:"We have your video."});
    expect(created.create).not.toHaveBeenCalled();expect(upload.send).toHaveBeenCalledTimes(1);
  });
  it("recovers an uncertain guest save with the same private retry authority",async()=>{
    let saves=0;fetchMock.mockImplementation(async (_url:string,init?:{method?:string})=>init?.method==="POST"
      ?{ok:++saves>1,status:saves>1?201:503,json:async()=>saves>1?{captureUrl}:{message:"Uncertain save"}}:photon([]));
    await renderReady(<SiteCaptureStart/>);fillGuest();fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("Uncertain save");fireEvent.click(screen.getByRole("button",{name:"Recover saved job"}));
    await screen.findByRole("link",{name:/^Open the uploader/});
    const posts=postsTo("/api/inbound-request");expect(posts).toHaveLength(2);expect(posts[1][1].body).toBe(posts[0][1].body);
    expect(created.create).not.toHaveBeenCalled();expect(upload.send).not.toHaveBeenCalled();
  });
});

it("keeps the form to the fields it needs, and the reply time off it", async () => {
  const { REPLY_TIMELINE } = await import("@/data/betaTimelines");
  await renderReady(<SiteCaptureStart />);
  expect(screen.queryByText(REPLY_TIMELINE)).toBeNull();
  const start = screen.getByRole("button", { name: "Next: film the job" });
  expect(start.nextElementSibling).toHaveTextContent(SITE_START_CONSENT_NO_VIDEO);
});
