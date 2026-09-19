// @vitest-environment jsdom
/**
 * The location field suggests, and never gets in the way of typing.
 *
 * No Google key is set in tests, so this exercises the free-provider path and,
 * most importantly, the floor: a provider that errors leaves a working text
 * field, and short input never queries at all.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationAutocomplete } from "@/components/site/LocationAutocomplete";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function photon(labels: { name?: string; city?: string; state?: string; country?: string }[]) {
  return { ok: true, json: async () => ({ features: labels.map((properties) => ({ properties })) }) };
}

function field() {
  render(<LocationAutocomplete id="loc" name="startLocation" />);
  return screen.getByRole("combobox") as HTMLInputElement;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("suggestions from the free provider", () => {
  it("offers matches as you type and queries the keyless geocoder", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Durham", state: "North Carolina", country: "United States" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });

    const option = await screen.findByText("Durham, North Carolina, United States");
    expect(option).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("photon.komoot.io");
  });

  it("fills the field with the chosen suggestion and closes the list", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Durham", state: "North Carolina", country: "United States" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });

    const option = await screen.findByText("Durham, North Carolina, United States");
    fireEvent.mouseDown(option);
    expect(input.value).toBe("Durham, North Carolina, United States");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("chooses the first suggestion on Enter instead of submitting the form", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Austin", state: "Texas", country: "United States" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "austin" } });

    await screen.findByText("Austin, Texas, United States");
    // Nothing is highlighted (active = -1): Enter still picks the first match
    // rather than falling through to the form submit the open list was covering.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("Austin, Texas, United States");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the list when the page scrolls, leaving the typed text alone", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Durham", state: "North Carolina", country: "United States" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });
    await screen.findByText("Durham, North Carolina, United States");

    // The list is absolutely positioned; scrolling would otherwise park it over
    // whichever field — often the submit button — scrolled beneath it.
    fireEvent.scroll(window);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input.value).toBe("durham");
  });
});

describe("the floor is always plain typing", () => {
  it("does not query on very short input", async () => {
    const input = field();
    fireEvent.change(input, { target: { value: "du" } });
    await delay(320); // past the debounce
    expect(fetchMock).not.toHaveBeenCalled();
    expect(input.value).toBe("du");
  });

  it("stays a working text field when the provider errors", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });
    await delay(320);
    // No dropdown, but exactly what was typed is preserved and submittable.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input.value).toBe("durham");
    expect(input.getAttribute("name")).toBe("startLocation");
  });
});
