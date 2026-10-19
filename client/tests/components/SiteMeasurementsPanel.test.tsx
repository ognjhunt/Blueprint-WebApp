// @vitest-environment jsdom
/**
 * The measurements step on the job page, from the side of whoever holds the
 * tape. It asks what the job does before any reading, follows the kind of
 * front for a door or drawer, saves exactly what was typed with its unit, and
 * never silently overwrites a newer save. A film-only link sees the same form.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers ?? {},
}));

import { SiteMeasurementsDisclosure, SiteMeasurementsPanel } from "@/components/site/SiteMeasurementsPanel";

const fetchMock = vi.fn();

const EMPTY = { ok: true, scope: "owner", revision: 0, family: null, articulation: null, referencePaper: null,
  referenceSheetLongEdge: null, readings: {}, measuredBy: null, note: null, updatedAtIso: null };

function respond(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastPut() {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
  expect(call).toBeTruthy();
  expect(String(call![0])).toBe("/api/site-task-brief/tok/measurements");
  return JSON.parse(String(call![1].body));
}

describe("what the panel asks", () => {
  it("asks what the job does before it shows any reading", async () => {
    fetchMock.mockResolvedValueOnce(respond(EMPTY));
    render(<SiteMeasurementsPanel token="tok" />);
    expect(await screen.findByRole("radio", { name: "Moves an object from one place to another" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Height of the surface where the object starts")).toBeNull();
    expect(screen.queryByText(/robot/i)).toBeNull();
  });

  it("follows the kind of front for a door, drawer or lid", async () => {
    fetchMock.mockResolvedValueOnce(respond(EMPTY));
    render(<SiteMeasurementsPanel token="tok" />);
    expect(screen.queryByText(/confirms a door, drawer or lid job/)).toBeNull();
    fireEvent.click(await screen.findByRole("radio", { name: "Opens or closes a door, drawer or lid" }));
    // The current website route evaluates rigid pick and place; articulated jobs are confirmed first.
    expect(screen.getByText(/Blueprint confirms a door, drawer or lid job with you before any evaluation/)).toBeInTheDocument();
    expect(screen.getByLabelText("Height of the handle")).toBeInTheDocument();
    expect(screen.queryByLabelText("How far it opens")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "It slides out, like a drawer" }));
    expect(screen.getByLabelText("How far it pulls out")).toBeInTheDocument();
    expect(screen.queryByLabelText("Handle distance from the hinge side")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "On hinges, like a door or lid" }));
    expect(screen.getByLabelText("How far it opens")).toBeInTheDocument();
    expect(screen.getByLabelText("Handle distance from the hinge side")).toBeInTheDocument();
    expect(screen.queryByLabelText("How far it pulls out")).toBeNull();
  });

  it("offers the same form to a film-only link", async () => {
    fetchMock.mockResolvedValueOnce(respond({ ...EMPTY, scope: "film" }));
    render(<SiteMeasurementsPanel token="tok" />);
    fireEvent.click(await screen.findByRole("radio", { name: "Moves an object from one place to another" }));
    expect(screen.getByRole("button", { name: "Save measurements" })).toBeEnabled();
  });
});

describe("saving", () => {
  it("sends what was typed, in the unit it was typed in, with the revision it read", async () => {
    fetchMock.mockResolvedValueOnce(respond(EMPTY));
    render(<SiteMeasurementsPanel token="tok" />);
    fireEvent.click(await screen.findByRole("radio", { name: "Moves an object from one place to another" }));
    fireEvent.change(screen.getByLabelText("Height of the surface where the object starts"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Unit for Height of the surface where the object starts"), { target: { value: "in" } });
    fireEvent.change(screen.getByLabelText("Object weight"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Unit for Object weight"), { target: { value: "kg" } });
    fireEvent.click(screen.getByRole("radio", { name: "Yes, US Letter" }));
    fireEvent.change(screen.getByLabelText("Your name (optional)"), { target: { value: "Dana" } });
    fetchMock.mockResolvedValueOnce(respond({ ...EMPTY, revision: 1, family: "rigid_pick_place", referencePaper: "letter",
      readings: { pick_surface_height: { value: 30, unit: "in", recordedAtIso: "2026-10-19T10:00:00.000Z", recordedByScope: "owner" } },
      updatedAtIso: "2026-10-19T10:00:00.000Z" }));
    fireEvent.click(screen.getByRole("button", { name: "Save measurements" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Measurements saved.");
    expect(lastPut()).toEqual({
      revision: 0,
      family: "rigid_pick_place",
      articulation: null,
      readings: { pick_surface_height: { value: 30, unit: "in" }, object_mass: { value: 1.5, unit: "kg" } },
      referencePaper: "letter",
      referenceSheetLongEdge: null,
      measuredBy: "Dana",
      note: null,
    });
  });

  it("asks for the long edge of a sheet that is not a standard size", async () => {
    fetchMock.mockResolvedValueOnce(respond(EMPTY));
    render(<SiteMeasurementsPanel token="tok" />);
    fireEvent.click(await screen.findByRole("radio", { name: "Moves an object from one place to another" }));
    fireEvent.click(screen.getByRole("radio", { name: "Yes, another size" }));
    fireEvent.change(screen.getByLabelText("Long edge of the sheet"), { target: { value: "35" } });
    fireEvent.change(screen.getByLabelText("Unit for Long edge of the sheet"), { target: { value: "cm" } });
    fetchMock.mockResolvedValueOnce(respond({ ...EMPTY, revision: 1, family: "rigid_pick_place", referencePaper: "other",
      referenceSheetLongEdge: { value: 35, unit: "cm" } }));
    fireEvent.click(screen.getByRole("button", { name: "Save measurements" }));
    await screen.findByRole("status");
    expect(lastPut()).toMatchObject({ referencePaper: "other", referenceSheetLongEdge: { value: 35, unit: "cm" } });
  });

  it("catches an impossible value before it is sent", async () => {
    fetchMock.mockResolvedValueOnce(respond(EMPTY));
    render(<SiteMeasurementsPanel token="tok" />);
    fireEvent.click(await screen.findByRole("radio", { name: "Moves an object from one place to another" }));
    fireEvent.change(screen.getByLabelText("Height of the surface where the object starts"), { target: { value: "400" } });
    fireEvent.change(screen.getByLabelText("Unit for Height of the surface where the object starts"), { target: { value: "cm" } });
    fireEvent.click(screen.getByRole("button", { name: "Save measurements" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the units");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("loads the newer save instead of overwriting it", async () => {
    fetchMock.mockResolvedValueOnce(respond(EMPTY));
    render(<SiteMeasurementsPanel token="tok" />);
    fireEvent.click(await screen.findByRole("radio", { name: "Moves an object from one place to another" }));
    fireEvent.change(screen.getByLabelText("Height of the surface where the object starts"), { target: { value: "31" } });
    fetchMock.mockResolvedValueOnce(respond({ ...EMPTY, code: "measurements_changed", revision: 2, family: "rigid_pick_place",
      readings: { pick_surface_height: { value: 30, unit: "in", recordedAtIso: "2026-10-19T10:00:00.000Z", recordedByScope: "owner" } } }, 409));
    fireEvent.click(screen.getByRole("button", { name: "Save measurements" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else saved measurements for this job");
    expect(screen.getByLabelText("Height of the surface where the object starts")).toHaveValue(30);
    expect(screen.getByLabelText("Unit for Height of the surface where the object starts")).toHaveValue("in");
  });

  it("shows a saved job's readings as they were typed", async () => {
    fetchMock.mockResolvedValueOnce(respond({ ...EMPTY, revision: 3, family: "articulated_open_close", articulation: "sliding",
      referencePaper: "none", readings: { opening_travel: { value: 18, unit: "in", recordedAtIso: "2026-10-19T10:00:00.000Z",
        recordedByScope: "film" } }, measuredBy: "Sam", note: "Bottom drawer." }));
    render(<SiteMeasurementsPanel token="tok" />);
    expect(await screen.findByLabelText("How far it pulls out")).toHaveValue(18);
    expect(screen.getByRole("radio", { name: "No" })).toBeChecked();
    expect(screen.getByLabelText("Your name (optional)")).toHaveValue("Sam");
  });
});

describe("the disclosure on the job page", () => {
  it("loads nothing until it is opened", async () => {
    fetchMock.mockResolvedValue(respond(EMPTY));
    const { container } = render(<SiteMeasurementsDisclosure token="tok" />);
    expect(screen.getByText("Add measurements (optional)")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/site-task-brief/tok/measurements"));
  });
});
