// @vitest-environment jsdom
/**
 * The country, from the address rather than beside it.
 *
 * The form used to ask "which country" as a question of its own, right under
 * "where is it", which made a legal residency decision the operator's job twice
 * over. The address answers it for almost everyone, so the country is a line to
 * confirm under the address; the select only opens to correct it, or when a
 * typed address never resolved to one, because it decides whether we may
 * collect footage at all.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";

vi.mock("@/lib/analytics", () => ({ analyticsEvents: { contactFormSubmit: vi.fn(), contactFormError: vi.fn() } }));
vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers,
}));
const upload = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/selfCaptureVideo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/selfCaptureVideo")>()),
  uploadSelfCaptureVideo: upload.send,
}));

const account = vi.hoisted(() => ({ user: null as any }));
const fetchMock = vi.fn();

function photon(properties: Record<string, unknown>[]) {
  return { ok: true, json: async () => ({ features: properties.map((props) => ({ properties: props })) }) };
}

beforeEach(() => {
  account.user = null;
  fetchMock.mockReset();
  upload.send.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FormData", window.FormData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function region() {
  return document.querySelector("#start-region") as HTMLSelectElement | null;
}

it.each(["gpt-6.1-sol-agents-api", "gpt-6-sol-agents-api"])(
  "keeps %s entry links on the upgraded Sol disclosure",
  (authoring) => {
    const previousUrl = window.location.href;
    window.history.replaceState(null, "", `?authoring=${authoring}`);
    try {
      render(<SiteCaptureStart />);
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
  it("does not ask for a country up front", () => {
    render(<SiteCaptureStart />);
    expect(region()).toBeNull();
    expect(screen.queryByText("Which country is the site in?")).toBeNull();
  });

  it("takes the country from the address that was picked, and offers a correction", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Austin", state: "Texas", country: "United States", countrycode: "US" }]));
    render(<SiteCaptureStart />);
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
    render(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "munich" } });

    fireEvent.mouseDown(await screen.findByText("Munich, Germany"));

    expect(await screen.findByText(/Country: Outside the United States\./)).toBeInTheDocument();
    expect(screen.getByText(/During the beta we can only take walkthroughs/)).toBeInTheDocument();
  });

  it("asks once, on Start, when a typed address never resolved to a country", async () => {
    render(<SiteCaptureStart />);
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Berlin" } });
    fireEvent.click(document.querySelector("#start-rights")!);

    fireEvent.submit(screen.getByRole("form"));

    expect(region()).not.toBeNull();
    expect(region()!.value).toBe("");
    expect(document.activeElement).toBe(region());
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(0);
  });
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: account.user, loading: false }) }));


it("clears an inferred country when the address is edited, but preserves an explicit correction", async () => {
  fetchMock.mockResolvedValue(photon([{ name: "Austin", countrycode: "US" }]));
  render(<SiteCaptureStart />);
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
  // A typed address has no country yet: the first Start asks for it.
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.change(region()!, { target: { value: "us" } });
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
  fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
  fireEvent.click(document.querySelector("#start-rights")!);
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.change(region()!, { target: { value: "us" } });
  fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Film the work area.", { selector: "h2" });
  expect(screen.getByRole("link", { name: "Open your job page" })).toHaveAttribute("href", captureUrl);
  expect(screen.getByText(/On an iPhone the link opens a small Blueprint camera when that is available/)).toBeInTheDocument();
  expect(screen.queryByText(/No app and nothing to install/)).toBeNull();

  received = true;
  await screen.findByText("Your recording is in.", { selector: "h2" }, { timeout: 10_000 });
  expect(screen.getByRole("link", { name: "Review your job brief" })).toHaveAttribute("href", captureUrl);
  expect(screen.queryByRole("link", { name: "Open your job page" })).toBeNull();
  expect(screen.queryByRole("img", { name: "Point your phone at this to film" })).toBeNull();
}, 15_000);

describe("SiteCaptureStart and a video that already exists", () => {
  const captureUrl = "https://tryblueprint.io/capture-upload/tok.signed";
  const video = () => new File(["frames"], "cycle.mov", { type: "video/quicktime" });

  function answerPosts(body: Record<string, unknown>) {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).includes("/status")) return { ok: true, json: async () => ({ status: { headline: "", stage: null }, captureReceived: false }) };
      if (init?.method === "POST") return { ok: true, status: 200, json: async () => body };
      return photon([]);
    });
  }

  function fillFor(video: File | null) {
    fireEvent.change(document.querySelector("#start-task")!, { target: { value: "Pack cartons" } });
    fireEvent.click(document.querySelector("#start-existing-footage")!);
    if (video) fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [video] } });
    fireEvent.change(document.querySelector("#start-location")!, { target: { value: "Austin" } });
    fireEvent.change(document.querySelector("#start-email")!, { target: { value: "owner@example.com" } });
    fireEvent.change(document.querySelector("#start-name")!, { target: { value: "Pat Lee" } });
    fireEvent.change(document.querySelector("#start-company")!, { target: { value: "Acme Foods" } });
    fireEvent.click(document.querySelector("#start-rights")!);
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.change(region()!, { target: { value: "us" } });
    fireEvent.submit(screen.getByRole("form"));
  }

  it("swaps the filming options for an upload, and offers video only", () => {
    render(<SiteCaptureStart />);
    expect(document.querySelector("#start-self-recording")).not.toBeNull();
    expect(document.querySelector("#start-footage")).toBeNull();

    fireEvent.click(document.querySelector("#start-existing-footage")!);

    expect(document.querySelector("#start-self-recording")).toBeNull();
    expect(document.querySelector("#start-filmer")).toBeNull();
    const input = document.querySelector("#start-footage") as HTMLInputElement;
    expect(input).toBeRequired();
    expect(input.accept).toContain(".mp4");
    expect(input.accept).not.toMatch(/image/);
    expect(screen.getByText("I already have a video of this job")).toBeInTheDocument();
    expect(screen.queryByText(/photos/i)).toBeNull();

    fireEvent.click(document.querySelector("#start-existing-footage")!);
    expect(document.querySelector("#start-self-recording")).not.toBeNull();
    expect(document.querySelector("#start-footage")).toBeNull();
  });

  it("refuses a file that is not a .mov or .mp4 before anything is sent", () => {
    render(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-existing-footage")!);
    fireEvent.change(document.querySelector("#start-footage")!, { target: { files: [new File(["x"], "site.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/not a \.mov or \.mp4/);
  });

  it("does not ask for the upload from a site outside the US", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    render(<SiteCaptureStart />);
    fireEvent.click(document.querySelector("#start-existing-footage")!);
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
    render(<SiteCaptureStart />);
    fillFor(file);

    await screen.findByText("Your recording is in.", { selector: "h2" });
    const [, init] = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(JSON.parse(init.body)).toMatchObject({ captureMode: "self_capture", hasExistingFootage: true, captureRegion: "us", firstName: "Pat", company: "Acme Foods" });
    expect(JSON.parse(init.body).filmerContact).toBeUndefined();
    expect(upload.send).toHaveBeenCalledWith("tok.signed", file, expect.any(Function));
    expect(screen.getByRole("link", { name: "Review your job brief" })).toHaveAttribute("href", captureUrl);
  });

  it("keeps the job when the video does not send, and links to the uploader", async () => {
    answerPosts({ captureUrl });
    upload.send.mockResolvedValue({ status: "failed", message: "The connection dropped before the video finished." });
    render(<SiteCaptureStart />);
    fillFor(video());

    await screen.findByText("Your job is saved. The video did not send.", { selector: "h2" });
    expect(screen.getByText(/The connection dropped before the video finished\. Nothing was lost/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the uploader" })).toHaveAttribute("href", captureUrl);
  });

  it("does not send the video when no camera link comes back", async () => {
    answerPosts({ captureUrl: null });
    render(<SiteCaptureStart />);
    fillFor(video());

    await screen.findByRole("heading", { level: 2 });
    expect(upload.send).not.toHaveBeenCalled();
  });
});

describe("SiteCaptureStart identity fields", () => {
  it("asks for a name and a company, and calls neither optional", () => {
    render(<SiteCaptureStart />);
    expect(document.querySelector("#start-name")).toBeRequired();
    expect(document.querySelector("#start-company")).toBeRequired();
    expect(screen.getByText("Your name")).toBeInTheDocument();
    expect(screen.getByText("Site or company")).toBeInTheDocument();
    for (const id of ["start-name", "start-company"]) {
      expect(document.querySelector(`label[for="${id}"]`)!.textContent).not.toMatch(/optional/i);
    }
  });

  it("asks a signed-in account for neither, since the account has both", () => {
    account.user = { uid: "owner-1", email: "owner@example.com", getIdToken: async () => "owner-token" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ workspaceType: "site_operator" }) });
    render(<SiteCaptureStart />);
    expect(document.querySelector("#start-name")).toBeNull();
    expect(document.querySelector("#start-company")).toBeNull();
  });
});
