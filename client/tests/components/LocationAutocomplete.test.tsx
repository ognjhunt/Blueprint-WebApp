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

    fireEvent.mouseDown(await screen.findByText("Munich, Germany"));

    expect(onSelect).toHaveBeenCalledWith({ label: "Munich, Germany", countryCode: "DE" });
  });

  it("reports no country when the provider gave none", async () => {
    fetchMock.mockResolvedValue(photonRaw([{ name: "Somewhere" }]));
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "somewhere" } });

    fireEvent.mouseDown(await screen.findByText("Somewhere"));

    expect(onSelect).toHaveBeenCalledWith({ label: "Somewhere", countryCode: null });
  });

  it("invalidates a picked place when its text is edited or cleared", async () => {
    fetchMock.mockResolvedValue(photonRaw([{ name: "Munich", country: "Germany", countrycode: "DE" }]));
    const onSelectionChange = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelectionChange={onSelectionChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "munich" } });
    fireEvent.mouseDown(await screen.findByText("Munich, Germany"));
    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith({ label: "Munich, Germany", countryCode: "DE" }));

    fireEvent.change(input, { target: { value: "Munich, Bavaria" } });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(input, { target: { value: "" } });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it("resolves a Google pick through Place Details without inferring from its label", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    const getDetails = vi.fn((_request, callback) => callback({
      address_components: [{ short_name: "GB", types: ["country"] }],
    }, "OK"));
    vi.stubGlobal("google", { maps: { places: {
      AutocompleteService: class {
        getPlacePredictions(_request: unknown, callback: Function) {
          callback([{ description: "London, United Kingdom", place_id: "london-id" }], "OK");
        }
      },
      PlacesService: class { getDetails = getDetails; },
    } } });
    const onSelectionChange = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelectionChange={onSelectionChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "london" } });
    fireEvent.mouseDown(await screen.findByText("London, United Kingdom"));

    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith({
      label: "London, United Kingdom", countryCode: "GB",
    }));
    expect(getDetails).toHaveBeenCalledWith(
      { placeId: "london-id", fields: ["address_components"] },
      expect.any(Function),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not label a failed Google details lookup as US", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    vi.stubGlobal("google", { maps: { places: {
      AutocompleteService: class {
        getPlacePredictions(_request: unknown, callback: Function) {
          callback([{ description: "Paris, France", place_id: "paris-id" }], "OK");
        }
      },
      PlacesService: class {
        getDetails(_request: unknown, callback: Function) { callback(null, "REQUEST_DENIED"); }
      },
    } } });
    const onSelect = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "paris" } });
    fireEvent.mouseDown(await screen.findByText("Paris, France"));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ label: "Paris, France", countryCode: null }));
  });

  it("ignores Google details that resolve after the operator changes the text", async () => {
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
    const onSelectionChange = vi.fn();
    render(<LocationAutocomplete id="loc" name="startLocation" onSelectionChange={onSelectionChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "berlin" } });
    fireEvent.mouseDown(await screen.findByText("Berlin, Germany"));
    fireEvent.change(input, { target: { value: "Berlin manual" } });
    resolveDetails?.({ address_components: [{ short_name: "DE", types: ["country"] }] }, "OK");

    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith(null));
    expect(onSelectionChange).not.toHaveBeenCalledWith({ label: "Berlin, Germany", countryCode: "DE" });
  });
});
