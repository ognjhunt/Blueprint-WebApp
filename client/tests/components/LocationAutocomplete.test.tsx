// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationAutocomplete } from "@/components/site/LocationAutocomplete";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("photon.komoot.io"))).toBe(true);
  });

  it("fills the field with the chosen suggestion and closes the list", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Durham", state: "North Carolina", country: "United States" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });

    const option = await screen.findByText("Durham, North Carolina, United States");
    fireEvent.click(option);
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
  it("reports typed text after invalidating a picked place, without a provider call", () => {
    const events: unknown[] = [];
    render(<LocationAutocomplete id="loc" name="startLocation"
      onSelectionChange={(place) => events.push(place)}
      onInputChange={(text) => events.push(text)} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Austin TX" } });
    expect(events).toEqual([null, "Austin TX"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not query on very short input", async () => {
    const input = field();
    fireEvent.change(input, { target: { value: "d" } });
    await delay(320); // past the debounce
    expect(fetchMock).not.toHaveBeenCalled();
    expect(input.value).toBe("d");
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

describe("reporting the chosen place", () => {
  function photonRaw(properties: Record<string, unknown>[]) {
    return { ok: true, json: async () => ({ features: properties.map((props) => ({ properties: props })) }) };
  }

  it("tells the form which country the picked suggestion is in", async () => {
    fetchMock.mockResolvedValue(photonRaw([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "munich" } });

    fireEvent.click(await screen.findByText("Munich, Germany"));

    expect(onSelect).toHaveBeenCalledWith({ label: "Munich, Germany", countryCode: "DE" });
  });

  it("reports no country when the provider gave none", async () => {
    fetchMock.mockResolvedValue(photonRaw([{ name: "Somewhere" }]));
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "somewhere" } });

    fireEvent.click(await screen.findByText("Somewhere"));

    expect(onSelect).toHaveBeenCalledWith({ label: "Somewhere", countryCode: null });
  });

  it("invalidates a picked place when its text is edited or cleared", async () => {
    fetchMock.mockResolvedValue(photonRaw([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    const onSelectionChange = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelectionChange={onSelectionChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "munich" } });
    fireEvent.click(await screen.findByText("Munich, Germany"));
    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith({ label: "Munich, Germany", countryCode: "DE" }));

    fireEvent.change(input, { target: { value: "Munich, Bavaria" } });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(input, { target: { value: "" } });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  function googleFixture(label: string, fetchFields = vi.fn(async () => ({ countryCode: "GB" }))) {
    const fetchAutocompleteSuggestions = vi.fn(async (_request: { input: string; sessionToken: string }) => ({
      suggestions: [{ label, placeId: "fixture-place", mainText: label.split(", ")[0], secondaryText: label.split(", ").slice(1).join(", ") }],
    }));
    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(url, "https://example.test");
      if (parsed.pathname === "/api/location-autocomplete/country") {
        return { ok: true, json: () => fetchFields() };
      }
      if (parsed.pathname === "/api/location-autocomplete") {
        const request = { input: parsed.searchParams.get("input")!, sessionToken: parsed.searchParams.get("sessionToken")! };
        return { ok: true, json: () => fetchAutocompleteSuggestions(request) };
      }
      return photonRaw([{ city: "Durham", street: "Crete Street", housenumber: "1005", country: "United States", countrycode: "US" }]);
    });
    return { fetchFields, fetchAutocompleteSuggestions };
  }

  it("uses Places New and resolves country through session-linked details", async () => {
    const { fetchFields, fetchAutocompleteSuggestions } = googleFixture("London, United Kingdom");
    const onSelectionChange = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelectionChange={onSelectionChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "london" } });
    fireEvent.click(await screen.findByRole("option", { name: "London United Kingdom" }));

    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith({
      label: "London, United Kingdom", countryCode: "GB",
    }));
    expect(fetchFields).toHaveBeenCalled();
    const predictionQuery = new URL(fetchMock.mock.calls[0][0], "https://example.test").searchParams;
    const detailsQuery = new URL(fetchMock.mock.calls[1][0], "https://example.test").searchParams;
    expect(detailsQuery.get("sessionToken")).toBe(predictionQuery.get("sessionToken"));
    expect(detailsQuery.get("placeId")).toBe("fixture-place");
    expect(fetchAutocompleteSuggestions).toHaveBeenCalledWith({ input: "london", sessionToken: expect.any(String) });
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("/api/location-autocomplete"))).toBe(true);
  });

  it("does not label a failed Google details lookup as US", async () => {
    googleFixture("Paris, France", vi.fn().mockRejectedValue(new Error("REQUEST_DENIED")));
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "paris" } });
    fireEvent.click(await screen.findByRole("option", { name: "Paris France" }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ label: "Paris, France", countryCode: null }));
  });

  it("ignores Google details that resolve after the operator changes the text", async () => {
    let resolveDetails: ((value: unknown) => void) | undefined;
    googleFixture("Berlin, Germany", vi.fn().mockImplementation(() => new Promise((resolve) => { resolveDetails = resolve; })));
    const onSelectionChange = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelectionChange={onSelectionChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "berlin" } });
    fireEvent.click(await screen.findByRole("option", { name: "Berlin Germany" }));
    await waitFor(() => expect(resolveDetails).toBeTypeOf("function"));
    fireEvent.change(input, { target: { value: "Berlin manual" } });
    await act(async () => { resolveDetails!({ countryCode: "DE" }); });

    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith(null));
    expect(onSelectionChange).not.toHaveBeenCalledWith({ label: "Berlin, Germany", countryCode: "DE" });
  });

  it("reuses a Google session while typing and starts a fresh one after a pick", async () => {
    const { fetchAutocompleteSuggestions } = googleFixture("London, United Kingdom");
    const input = field();
    fireEvent.change(input, { target: { value: "lo" } });
    await screen.findByRole("option");
    const firstToken = fetchAutocompleteSuggestions.mock.calls[0][0].sessionToken;
    fireEvent.change(input, { target: { value: "lond" } });
    await screen.findByRole("option");
    expect(fetchAutocompleteSuggestions.mock.calls[1][0].sessionToken).toBe(firstToken);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "london" } });
    await screen.findByRole("option");
    expect(fetchAutocompleteSuggestions.mock.calls[2][0].sessionToken).not.toBe(firstToken);
  });

  it("falls back promptly when Google rejects a request", async () => {
    const { fetchAutocompleteSuggestions } = googleFixture("London, United Kingdom");
    fetchAutocompleteSuggestions.mockRejectedValue(new Error("REQUEST_DENIED"));
    const input = field();
    fireEvent.change(input, { target: { value: "1005 crete" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "1005 Crete Street, Durham, United States" }));
    expect(input.value).toBe("1005 Crete Street, Durham, United States");
  });

  it("falls back when Google never answers without accepting its late response", async () => {
    vi.useFakeTimers();
    const { fetchAutocompleteSuggestions } = googleFixture("London, United Kingdom");
    let complete: (value: unknown) => void = () => {};
    fetchAutocompleteSuggestions.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1650); });
    expect(screen.getByRole("option", { name: "1005 Crete Street, Durham, United States" })).toBeInTheDocument();
    await act(async () => { complete({ suggestions: [] }); });
    expect(screen.getByRole("option", { name: "1005 Crete Street, Durham, United States" })).toBeInTheDocument();
  });

  it("closes immediately on selection even when country details are slow", async () => {
    vi.useFakeTimers();
    googleFixture("London, United Kingdom", vi.fn().mockImplementation(() => new Promise(() => {})));
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelect={onSelect} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "london" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    fireEvent.click(screen.getByRole("option"));
    expect(input.value).toBe("London, United Kingdom");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(onSelect).toHaveBeenCalledWith({ label: "London, United Kingdom", countryCode: null });
  });

  it("keeps zero Google results empty instead of mixing providers", async () => {
    const { fetchAutocompleteSuggestions } = googleFixture("London, United Kingdom");
    fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [] });
    const input = field();
    fireEvent.change(input, { target: { value: "unknown" } });
    await waitFor(() => expect(fetchAutocompleteSuggestions).toHaveBeenCalled());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls).toHaveLength(1);
  });
});

describe("request races and accessible options", () => {
  it("uses number-first street addresses without duplicated name parts", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Durham", city: "Durham" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "du" } });
    const option = await screen.findByRole("option", { name: "Durham" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
    expect(input.getAttribute("aria-activedescendant")).toBe(option.id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("Durham");
  });

  it("does not select at the start of a touch gesture", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Durham" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });
    const option = await screen.findByRole("option");
    fireEvent.pointerDown(option, { pointerType: "touch" });
    expect(input.value).toBe("durham");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(option);
    expect(input.value).toBe("Durham");
  });

  it.each(["clear", "escape", "blur", "edit"])("ignores an in-flight response after %s", async (action) => {
    let complete: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    if (action === "clear") fireEvent.change(input, { target: { value: "" } });
    if (action === "escape") fireEvent.keyDown(input, { key: "Escape" });
    if (action === "blur") fireEvent.blur(input);
    if (action === "edit") fireEvent.change(input, { target: { value: "du" } });
    expect(signal.aborted).toBe(true);
    complete(photon([{ city: "Stale Durham" }]));
    await act(async () => { await delay(20); });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("does not cancel suggestions when scrolling the options", async () => {
    fetchMock.mockResolvedValue(photon([{ name: "Durham" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });
    await screen.findByRole("option");
    fireEvent.scroll(screen.getByRole("listbox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
