// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClientEnvCacheForTests } from "@/lib/client-env";

import { LocationAutocomplete } from "@/components/site/LocationAutocomplete";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
  resetClientEnvCacheForTests();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetClientEnvCacheForTests();
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

  it("passes opted-in coordinates to the private proxy and clears them from later lookups", async () => {
    googleFixture("1005 Crete Street, Durham, NC");
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const input = field();
    fireEvent.change(input, { target: { value: "1005 Crete" } });
    await screen.findByRole("option");
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    fireEvent.change(input, { target: { value: "1005 Crete Street" } });
    await act(async () => { getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 35.9940321, longitude: -78.8986192 } }); });
    await screen.findByRole("option");
    let params = new URL(fetchMock.mock.calls.at(-1)![0], "https://example.test").searchParams;
    expect(params.get("lat")).toBe("35.994");
    expect(params.get("lng")).toBe("-78.899");
    fireEvent.click(screen.getByRole("button", { name: "Clear location preference" }));
    await screen.findByRole("option");
    params = new URL(fetchMock.mock.calls.at(-1)![0], "https://example.test").searchParams;
    expect(params.has("lat")).toBe(false);
    expect(params.has("lng")).toBe(false);
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


describe("the configured browser Maps key", () => {
  function photonRaw(properties: Record<string, unknown>[]) {
    return { ok: true, json: async () => ({ features: properties.map((props) => ({ properties: props })) }) };
  }
  function googleFixture(label: string, fetchFields = vi.fn(async () => ({
    place: { addressComponents: [{ shortText: "GB", types: ["country"] }] },
  }))) {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    resetClientEnvCacheForTests();
    const prediction = {
      text: { toString: () => label },
      mainText: { toString: () => label.split(", ")[0] },
      secondaryText: { toString: () => label.split(", ").slice(1).join(", ") },
      toPlace: () => ({ fetchFields }),
    };
    const fetchAutocompleteSuggestions = vi.fn(async (_request: { input: string; sessionToken: object }) => ({ suggestions: [{ placePrediction: prediction }] }));
    vi.stubGlobal("google", { maps: { places: {
      AutocompleteSuggestion: { fetchAutocompleteSuggestions },
      AutocompleteSessionToken: class {},
    } } });
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
    expect(fetchFields).toHaveBeenCalledWith({ fields: ["addressComponents"] });
    expect(fetchAutocompleteSuggestions).toHaveBeenCalledWith({ input: "london", sessionToken: expect.any(Object), region: "us",
      locationBias: { west: -125, east: -66, south: 24, north: 49 } });
    expect(fetchMock).not.toHaveBeenCalled();
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
    await act(async () => { resolveDetails!({ place: { addressComponents: [{ shortText: "DE", types: ["country"] }] } }); });

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

  it("requests location only on click, rounds the position, and can clear it", async () => {
    const { fetchAutocompleteSuggestions } = googleFixture("1005 Crete Street, Durham, NC");
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const input = field();
    fireEvent.change(input, { target: { value: "1005 Crete" } });
    await screen.findByRole("option");
    expect(getCurrentPosition).not.toHaveBeenCalled();
    const token = fetchAutocompleteSuggestions.mock.calls[0][0].sessionToken;
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    fireEvent.change(input, { target: { value: "1005 Crete Street" } });
    await act(async () => { getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 35.9940321, longitude: -78.8986192 } }); });
    await screen.findByRole("option");
    expect(fetchAutocompleteSuggestions).toHaveBeenLastCalledWith({ input: "1005 Crete Street", sessionToken: token, region: "us",
      locationBias: { center: { lat: 35.994, lng: -78.899 }, radius: 50000 }, origin: { lat: 35.994, lng: -78.899 } });
    expect(input.value).toBe("1005 Crete Street");
    fireEvent.click(screen.getByRole("button", { name: "Clear location preference" }));
    await screen.findByRole("option");
    expect(fetchAutocompleteSuggestions).toHaveBeenLastCalledWith({ input: "1005 Crete Street", sessionToken: token, region: "us",
      locationBias: { west: -125, east: -66, south: 24, north: 49 } });
  });

  it("refreshes after a location click even when scrolling dismissed options but kept input focus", async () => {
    const { fetchAutocompleteSuggestions } = googleFixture("1005 Crete Street, Durham, NC");
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 35.994, longitude: -78.899 } } as GeolocationPosition) } });
    const input = field();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "1005 Crete" } });
    await screen.findByRole("option");
    fireEvent.scroll(window);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await screen.findByRole("option");
    expect(fetchAutocompleteSuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ origin: { lat: 35.994, lng: -78.899 } }));
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole("button", { name: "Clear location preference" }));
    await screen.findByRole("option");
    expect(fetchAutocompleteSuggestions).toHaveBeenLastCalledWith(expect.not.objectContaining({ origin: expect.anything() }));
  });

  it("fills an empty field from Google geocoding and reports the authoritative country", async () => {
    googleFixture("1005 Crete Street, Durham, NC");
    const geocode = vi.fn(async () => ({ results: [{ formatted_address: "1005 Crete St, Durham, NC 27707, USA", types: ["street_address"],
      address_components: [{ types: ["country"], short_name: "US" }] }] }));
    Object.assign(window.google.maps, { importLibrary: vi.fn(async () => ({ Geocoder: class { geocode = geocode; } })) });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 35.9940321, longitude: -78.8986192 } } as GeolocationPosition) } });
    const onSelectionChange = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("1005 Crete St, Durham, NC 27707, USA"));
    expect(onSelectionChange).toHaveBeenLastCalledWith({ label: "1005 Crete St, Durham, NC 27707, USA", countryCode: "US" });
    expect(geocode).toHaveBeenCalledWith({ location: { lat: 35.9940321, lng: -78.8986192 } });
    expect(screen.getByRole("status")).toHaveTextContent("Current address filled. Check it before continuing.");
    expect(screen.getByRole("img", { name: "Powered by Google" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear location preference" }));
    expect(screen.getByRole("combobox")).toHaveValue("1005 Crete St, Durham, NC 27707, USA");
  });

  it("uses the existing reverse provider when Google denies geocoding, without assuming the country", async () => {
    googleFixture("Toronto, Canada");
    Object.assign(window.google.maps, { importLibrary: vi.fn(async () => ({ Geocoder: class { geocode = vi.fn().mockRejectedValue(new Error("REQUEST_DENIED")); } })) });
    fetchMock.mockResolvedValue(photonRaw([{ housenumber: "1005", street: "Centre Street", city: "Toronto", country: "Canada", countrycode: "ca" }]));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 43.65, longitude: -79.38 } } as GeolocationPosition) } });
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("1005 Centre Street, Toronto, Canada"));
    expect(onSelect).toHaveBeenLastCalledWith({ label: "1005 Centre Street, Toronto, Canada", countryCode: "CA" });
    expect(screen.getByRole("link", { name: "© OpenStreetMap" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toContain("photon.komoot.io/reverse?");
  });

  it("falls back from a stalled Google reverse lookup and ignores its later answer", async () => {
    vi.useFakeTimers();
    googleFixture("Durham, NC");
    let complete: (response: unknown) => void = () => {};
    Object.assign(window.google.maps, { importLibrary: vi.fn(async () => ({ Geocoder: class { geocode = () => new Promise(resolve => { complete = resolve; }); } })) });
    fetchMock.mockResolvedValue(photonRaw([{ housenumber: "200", street: "East Main Street", city: "Durham", countrycode: "US" }]));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 35.994, longitude: -78.899 } } as GeolocationPosition) } });
    const input = field();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(input).toHaveValue("200 East Main Street, Durham");
    await act(async () => { complete({ results: [{ formatted_address: "Late Google address", types: ["street_address"], address_components: [] }] }); });
    expect(input).toHaveValue("200 East Main Street, Durham");
  });

  it("stops a stalled fallback lookup and leaves the empty field usable", async () => {
    vi.useFakeTimers();
    googleFixture("Durham, NC");
    fetchMock.mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 35.994, longitude: -78.899 } } as GeolocationPosition) } });
    const input = field();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole("button", { name: "Clear location preference" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Couldn’t fill your address");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    fireEvent.change(input, { target: { value: "My address" } });
    expect(input).toHaveValue("My address");
  });

  it.each(["edit", "escape", "unmount"])("does not replace the input after a late current-address lookup (%s)", async (action) => {
    googleFixture("Durham, NC");
    let complete: (response: unknown) => void = () => {};
    const geocode = vi.fn(() => new Promise(resolve => { complete = resolve; }));
    Object.assign(window.google.maps, { importLibrary: vi.fn(async () => ({ Geocoder: class { geocode = geocode; } })) });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 35.994, longitude: -78.899 } } as GeolocationPosition) } });
    const onSelect = vi.fn();
    const view = render(<LocationAutocomplete id="loc" name="startLocation" defaultValue="Existing address" onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await waitFor(() => expect(geocode).toHaveBeenCalled());
    if (action === "edit") fireEvent.change(input, { target: { value: "My newer address" } });
    if (action === "escape") fireEvent.keyDown(input, { key: "Escape" });
    if (action === "unmount") view.unmount();
    await act(async () => { complete({ results: [{ formatted_address: "Stale address", types: ["street_address"], address_components: [] }] }); });
    expect(onSelect).not.toHaveBeenCalled();
    expect(input).toHaveValue(action === "edit" ? "My newer address" : "Existing address");
  });

  it("keeps nearby autocomplete usable when the reverse lookup returns no address after a click scroll", async () => {
    const { fetchAutocompleteSuggestions } = googleFixture("1005 Crete Street, Durham, NC");
    fetchMock.mockResolvedValue(photonRaw([]));
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const input = field();
    fireEvent.change(input, { target: { value: "1005 Crete" } });
    await screen.findByRole("option");
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    fireEvent.scroll(window);
    await act(async () => { getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 35.994, longitude: -78.899 } }); });
    await screen.findByRole("option");
    expect(input).toHaveValue("1005 Crete");
    expect(screen.getByRole("status")).toHaveTextContent("Couldn’t fill your address");
    expect(fetchAutocompleteSuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ origin: { lat: 35.994, lng: -78.899 } }));
  });

  it.each([1, 2, 3])("leaves typing and suggestions usable when location fails (%i)", async (code) => {
    const { fetchAutocompleteSuggestions } = googleFixture("1005 Crete Street, Durham, NC");
    const getCurrentPosition = vi.fn((_success, error) => error({ code }));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const input = field();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByRole("status")).toHaveTextContent(code === 1 ? "Location permission is off" : "Couldn’t find your location");
    fireEvent.change(input, { target: { value: "1005 Crete" } });
    await screen.findByRole("option");
    expect(fetchAutocompleteSuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ locationBias: { west: -125, east: -66, south: 24, north: 49 } }));
    expect(input.value).toBe("1005 Crete");
  });

  it.each(["escape", "selection", "unmount"])("does not reopen dismissed suggestions after a late location result (%s)", async (action) => {
    const { fetchAutocompleteSuggestions } = googleFixture("1005 Crete Street, Durham, NC");
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    const view = render(<LocationAutocomplete id="loc" name="startLocation" />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "1005 Crete" } });
    await screen.findByRole("option");
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    if (action === "escape") fireEvent.keyDown(input, { key: "Escape" });
    if (action === "selection") {
      fireEvent.change(input, { target: { value: "1005 Crete Street" } });
      fireEvent.click(await screen.findByRole("option"));
    }
    if (action === "unmount") view.unmount();
    await act(async () => { getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 35.994, longitude: -78.899 } }); });
    expect(fetchAutocompleteSuggestions).toHaveBeenCalledTimes(action === "selection" ? 2 : 1);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("falls back promptly when Google rejects a request", async () => {
    const { fetchAutocompleteSuggestions } = googleFixture("London, United Kingdom");
    fetchAutocompleteSuggestions.mockRejectedValue(new Error("REQUEST_DENIED"));
    fetchMock.mockResolvedValue(photonRaw([{ city: "Durham", street: "Crete Street", housenumber: "1005", country: "United States", countrycode: "US" }]));
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
    fetchMock.mockResolvedValue(photonRaw([{ name: "Durham" }]));
    const input = field();
    fireEvent.change(input, { target: { value: "durham" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1350); });
    expect(screen.getByRole("option", { name: "Durham" })).toBeInTheDocument();
    await act(async () => { complete({ suggestions: [] }); });
    expect(screen.getByRole("option", { name: "Durham" })).toBeInTheDocument();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
