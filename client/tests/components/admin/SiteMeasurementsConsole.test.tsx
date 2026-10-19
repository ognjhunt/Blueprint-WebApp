// @vitest-environment jsdom
/**
 * The job console's measurements section: what the site recorded, what those
 * readings cannot fill, and the source-document export an operator retains as
 * the qualification request's `measurement` artifact.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => ({ ...headers, "X-CSRF-Token": "csrf" }),
}));
vi.mock("@/lib/firebaseAuthHeaders", () => ({
  withFirebaseAuthHeaders: async (_user: unknown, headers: Record<string, string>) => ({ ...headers, Authorization: "Bearer token" }),
}));

import { SiteMeasurementsConsole } from "@/components/admin/SiteMeasurementsConsole";

const SHA = (digit: string) => `sha256:${digit.repeat(64)}`;
const BINDING = {
  scene_request_id: "job-a", site_id: "site-job-a", task_id: "task-1", capture_id: "walkthrough-job-a",
  source_capture_digest: SHA("1"), testbed_digest_sha256: SHA("2"), scene_revision_digest: SHA("3"),
  task_spec_digest: SHA("4"), success_contract_digest: SHA("5"), robot_model_digest: SHA("6"),
  policy_interface_id: "blueprint_policy_https.v1",
};

const MEASUREMENTS = {
  requestId: "job-a", family: "rigid_pick_place", articulation: null, referencePaper: "letter", revision: 2,
  updatedAtIso: "2026-10-17T09:00:00.000Z", note: "Totes vary a little.",
  readings: [
    { sampleId: "pick_surface_height", label: "Height of the surface where the object starts", value: 30, unit: "in",
      si: 0.762, siUnit: "m", basis: "tape", recordedAtIso: "2026-10-17T09:00:00.000Z", recordedByScope: "film",
      recordedByName: "Sam" },
    { sampleId: "reference_sheet_long_edge", label: "Long edge of the sheet", value: null, unit: null, si: 0.2794,
      siUnit: "m", basis: "paper_standard", recordedAtIso: "2026-10-17T09:00:00.000Z", recordedByScope: "owner",
      recordedByName: null },
  ],
  coverage: { complete: false, missingDimensions: ["collision", "task_dynamics", "task_state"], checks: [] },
};

const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function open() {
  const { container } = render(<SiteMeasurementsConsole requestId="job-a" currentUser={null} />);
  const details = container.querySelector("details")!;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  return container;
}

const createObjectURL = vi.fn((_blob: Blob) => "blob:measurements");
const originalUrl = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
const originalClick = HTMLAnchorElement.prototype.click;

beforeEach(() => {
  fetchMock.mockReset();
  createObjectURL.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  // jsdom implements neither blob URLs nor download navigation.
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  URL.createObjectURL = originalUrl.create;
  URL.revokeObjectURL = originalUrl.revoke;
  HTMLAnchorElement.prototype.click = originalClick;
});

describe("the readings", () => {
  it("loads nothing until opened, then shows SI values, provenance and what cannot be filled", async () => {
    fetchMock.mockResolvedValueOnce(json({ measurements: MEASUREMENTS }));
    const { container } = render(<SiteMeasurementsConsole requestId="job-a" currentUser={null} />);
    expect(fetchMock).not.toHaveBeenCalled();
    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Height of the surface where the object starts")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/jobs/job-a/site-measurements");
    expect(screen.getByText("30 inches")).toBeInTheDocument();
    expect(screen.getByText("0.762 m")).toBeInTheDocument();
    expect(screen.getByText("US Letter standard")).toBeInTheDocument();
    expect(screen.getByText(/Film link · Sam/)).toBeInTheDocument();
    expect(screen.getByText("Readings cannot fill: collision, task dynamics, task state.")).toBeInTheDocument();
    expect(screen.getByText("Totes vary a little.")).toBeInTheDocument();
  });

  it("says so when the site recorded nothing", async () => {
    fetchMock.mockResolvedValueOnce(json({ measurements: null }));
    await open();
    expect(await screen.findByText("No measurements recorded for this job yet.")).toBeInTheDocument();
  });
});

describe("the source document export", () => {
  async function ready() {
    fetchMock.mockResolvedValueOnce(json({ measurements: MEASUREMENTS }));
    await open();
    await screen.findByRole("table");
  }

  it("refuses a binding that is not JSON without calling the server", async () => {
    await ready();
    fireEvent.change(screen.getByLabelText("Qualification request binding (JSON)"), { target: { value: "{not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Build source document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts the binding, the site's producer identity and calibration readings, then offers the bytes", async () => {
    await ready();
    fireEvent.change(screen.getByLabelText("Qualification request binding (JSON)"), {
      target: { value: JSON.stringify({ schema_version: "blueprint.site_task_qualification_request.v1", binding: BINDING }) },
    });
    expect(screen.getByLabelText("Measurement producer")).toHaveValue("site_job:job-a");
    fireEvent.click(screen.getByLabelText("Long edge of the sheet set the scene's metric scale"));
    fetchMock.mockResolvedValueOnce(json({ json: "{\n}\n", sha256: SHA("9"), sizeBytes: 4,
      fileName: "site-task-measurements-job-a-r2.json", sampleCount: 1,
      coverage: { complete: false, missingDimensions: ["collision", "observation", "task_dynamics", "task_state"], checks: [] } }));
    fireEvent.click(screen.getByRole("button", { name: "Build source document" }));
    expect(await screen.findByText(SHA("9"))).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/admin/jobs/job-a/site-measurements/source-document");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token", "X-CSRF-Token": "csrf" });
    expect(JSON.parse(init.body)).toEqual({ binding: BINDING, producerId: "site_job:job-a",
      calibrationSampleIds: ["reference_sheet_long_edge"] });
    expect(screen.getByText(/1 sample, 4 bytes\./)).toBeInTheDocument();
    expect(screen.getByText(/Cannot fill: collision, observation, task dynamics, task state\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download site-task-measurements-job-a-r2.json" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect([blob.type, blob.size]).toEqual(["application/json", 4]);
  });

  it("shows the server's reason for a refused export", async () => {
    await ready();
    fireEvent.change(screen.getByLabelText("Qualification request binding (JSON)"), {
      target: { value: JSON.stringify({ ...BINDING, scene_request_id: "job-b" }) },
    });
    fetchMock.mockResolvedValueOnce(json({ code: "binding_job_mismatch",
      error: "That binding names a different site job." }, 400));
    fireEvent.click(screen.getByRole("button", { name: "Build source document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That binding names a different site job.");
  });
});
