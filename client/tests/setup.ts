import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock Google Maps API
window.google = {
  maps: {
    places: {
      Autocomplete: vi.fn().mockImplementation(() => ({
        addListener: vi.fn(),
        getPlace: vi.fn(),
        setFields: vi.fn(),
        setTypes: vi.fn(),
      })),
      AutocompleteService: vi.fn().mockImplementation(() => ({
        getPlacePredictions: vi.fn((request, callback) => {
          // Simulate successful response with no predictions
          if (callback) {
            callback([], window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS);
          }
          return Promise.resolve({ predictions: [] });
        }),
      })),
      PlacesService: vi.fn().mockImplementation((attrContainer) => ({ // Added PlacesService
        getDetails: vi.fn((request, callback) => {
          if (callback) {
            callback(null, window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS);
          }
        }),
        textSearch: vi.fn(), // Add other methods if used by the component
      })),
      PlacesServiceStatus: {
        OK: 'OK',
        ZERO_RESULTS: 'ZERO_RESULTS',
        INVALID_REQUEST: 'INVALID_REQUEST',
      },
    },
    Geocoder: vi.fn().mockImplementation(() => ({
      geocode: vi.fn((request, callback) => {
        if (callback) {
          callback([], window.google.maps.GeocoderStatus.ZERO_RESULTS);
        }
        return Promise.resolve({ results: [] });
      }),
    })),
    GeocoderStatus: {
      OK: 'OK',
      ZERO_RESULTS: 'ZERO_RESULTS',
    },
    // Mocking LatLng and LatLngBounds if they are used directly or by services
    LatLng: vi.fn().mockImplementation((lat, lng) => ({ lat: () => lat, lng: () => lng })),
    LatLngBounds: vi.fn().mockImplementation(() => ({
      extend: vi.fn(),
      getCenter: vi.fn(() => ({ lat: () => 0, lng: () => 0 })), // Mock getCenter if needed
    })),
    event: { // Mock event listener if used
      addListener: vi.fn(),
      clearInstanceListeners: vi.fn(),
    },
    Map: vi.fn().mockImplementation((mapDiv, options) => ({ // Basic mock for google.maps.Map
        // Mock any methods that might be called on the map instance
        setCenter: vi.fn(),
        setZoom: vi.fn(),
        // ... other methods
    })),
  } as any,
};

// Mock global fetch
global.fetch = vi.fn((url) => {
  const urlString = String(url);
  if (urlString.startsWith('/api/')) {
    // console.log(`Mocking API call for: ${urlString}`);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ message: `Mocked success for ${urlString}` }),
      text: () => Promise.resolve(JSON.stringify({ message: `Mocked success for ${urlString}` })),
      headers: new Headers(),
      redirected: false,
      status: 200,
      statusText: 'OK',
      type: 'basic',
      url: urlString,
      clone: function() { const newObj = { ...this }; newObj.clone = this.clone; return newObj; },
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
    } as unknown as Response);
  }

  console.warn(`Unhandled fetch mock for URL: ${urlString}`);
  return Promise.reject(new Error(`Unhandled fetch mock for URL: ${urlString}`));
});
