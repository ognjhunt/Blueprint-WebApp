// @vitest-environment jsdom
/**
 * Listing the task objects and photographing them, from the operator's side.
 *
 * Two things this pins: the scope split is visible in the UI (a film-only link
 * can add photos but not change the list), and a photo counts toward the item's
 * coverage. The room is not the objects, and this is where the objects get in.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: async (headers: Record<string, string>) => headers ?? {},
}));

import { TaskItemsPanel } from "@/components/site/TaskItemsPanel";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function inventory(items: Record<string, unknown>[]) {
  return {
    ok: true,
    json: async () => ({
      items,
      allItemsCovered: items.length > 0 && items.every((i) => (i as { coverageStatus: string }).coverageStatus === "covered"),
      requestedShots: ["a clear front view", "one from the side", "a close-up"],
    }),
  };
}

function tote(overrides: Record<string, unknown> = {}) {
  return {
    itemId: "item_tote",
    label: "Totes",
    locationNote: "by the conveyor",
    quantityHint: null,
    basis: "suggested",
    imageCount: 0,
    coverageStatus: "needs_images",
    imagesStillWanted: 2,
    assetStatus: "pending",
    assetDetail: null,
    ...overrides,
  };
}

describe("the operator sees the items and their coverage", () => {
  it("lists a suggested item, where it goes, and that it needs photos", async () => {
    fetchMock.mockResolvedValueOnce(inventory([tote()]));
    render(<TaskItemsPanel token="tok" scope="owner" />);

    expect(await screen.findByText("Totes")).toBeInTheDocument();
    expect(screen.getByText(/by the conveyor/)).toBeInTheDocument();
    expect(screen.getByText(/Needs photos/)).toBeInTheDocument();
    // Asset status is pipeline-owned and reads as pending, never "ready".
    expect(screen.getByText(/sim-ready version from your photos/)).toBeInTheDocument();
  });

  it("lets an owner add an item", async () => {
    fetchMock.mockResolvedValueOnce(inventory([])); // initial: empty
    render(<TaskItemsPanel token="tok" scope="owner" />);
    await screen.findByText(/No items yet/);

    fetchMock.mockResolvedValueOnce(inventory([tote({ itemId: "item_boxes", label: "Boxes", locationNote: null })]));
    fireEvent.change(screen.getByPlaceholderText(/Cardboard boxes/), { target: { value: "Boxes" } });
    fireEvent.click(screen.getByRole("button", { name: /Add item/ }));

    expect(await screen.findByText("Boxes")).toBeInTheDocument();
    const [, addCall] = fetchMock.mock.calls.find(([url, opts]) =>
      String(url).endsWith("/items") && (opts as RequestInit)?.method === "POST",
    ) as [string, RequestInit];
    expect(JSON.parse(String(addCall.body))).toMatchObject({ label: "Boxes" });
  });
});

describe("a response that does not match the inventory contract", () => {
  it("shows the empty state instead of crashing when items is missing", async () => {
    // The panel now mounts alongside the recorder/handoff (not only after a
    // saved capture), so it can hit a stale cache entry, a proxy error page,
    // or a route that never modeled this endpoint — none of which carry an
    // `items` array. This pins that such a response degrades to "no items"
    // rather than throwing past the `items.length` read.
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, ready: false }) });
    render(<TaskItemsPanel token="tok" scope="owner" />);

    expect(await screen.findByText(/No items yet/)).toBeInTheDocument();
  });
});

describe("scope decides what the link may do", () => {
  it("a film-only link can add photos but cannot change the list", async () => {
    fetchMock.mockResolvedValueOnce(inventory([tote()]));
    render(<TaskItemsPanel token="tok" scope="film" />);
    await screen.findByText("Totes");

    // No way to add or remove items.
    expect(screen.queryByRole("button", { name: /Add item/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove$/ })).not.toBeInTheDocument();
    // But photographing is offered.
    expect(screen.getByRole("button", { name: /Add photos/ })).toBeInTheDocument();
  });

  it("uploading a photo posts to the item image endpoint and updates coverage", async () => {
    fetchMock.mockResolvedValueOnce(inventory([tote()]));
    const { container } = render(<TaskItemsPanel token="tok" scope="film" />);
    await screen.findByText("Totes");

    // The upload returns the item now covered.
    fetchMock.mockResolvedValueOnce(
      inventory([tote({ imageCount: 2, coverageStatus: "covered", imagesStillWanted: 0 })]),
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/Enough photos/)).toBeInTheDocument());
    const imageCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/items/item_tote/image"));
    expect(imageCall).toBeTruthy();
    expect((imageCall![1] as RequestInit).method).toBe("POST");
  });
});
