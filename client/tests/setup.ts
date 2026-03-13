import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from "vitest";

const DEFAULT_LAYOUT_WIDTH = 800;
const DEFAULT_LAYOUT_HEIGHT = 400;

function resolveLayoutSize(element: HTMLElement, dimension: "width" | "height") {
  const computed = window.getComputedStyle(element)[dimension];
  const computedValue = Number.parseFloat(computed);
  if (Number.isFinite(computedValue) && computedValue > 0) {
    return computedValue;
  }

  const inlineValue = Number.parseFloat(element.style[dimension] || "");
  if (Number.isFinite(inlineValue) && inlineValue > 0) {
    return inlineValue;
  }

  return dimension === "width" ? DEFAULT_LAYOUT_WIDTH : DEFAULT_LAYOUT_HEIGHT;
}

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    const element = target as HTMLElement;
    const width = resolveLayoutSize(element, "width");
    const height = resolveLayoutSize(element, "height");
    const entry = {
      target,
      contentRect: {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        width,
        height,
        toJSON: () => ({}),
      },
    } as ResizeObserverEntry;

    this.callback([entry], this as unknown as ResizeObserver);
  }

  unobserve() {}

  disconnect() {}
}

if (typeof HTMLElement !== "undefined") {
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: {
      configurable: true,
      get() {
        return resolveLayoutSize(this as HTMLElement, "width");
      },
    },
    offsetHeight: {
      configurable: true,
      get() {
        return resolveLayoutSize(this as HTMLElement, "height");
      },
    },
    clientWidth: {
      configurable: true,
      get() {
        return resolveLayoutSize(this as HTMLElement, "width");
      },
    },
    clientHeight: {
      configurable: true,
      get() {
        return resolveLayoutSize(this as HTMLElement, "height");
      },
    },
  });

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);

  window.HTMLElement.prototype.getBoundingClientRect = function (
    this: HTMLElement,
  ) {
    const width = resolveLayoutSize(this, "width");
    const height = resolveLayoutSize(this, "height");
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

function buildDefaultResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function normalizeRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function defaultFetch(input: RequestInfo | URL): Promise<Response> {
  const rawUrl = normalizeRequestUrl(input);
  const resolvedUrl =
    rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? new URL(rawUrl)
      : new URL(rawUrl, "http://localhost:3000");

  const isLocalAppRequest =
    resolvedUrl.origin === "http://localhost:3000" ||
    resolvedUrl.origin === "http://127.0.0.1:3000";

  if (!isLocalAppRequest) {
    throw new Error(`Unexpected outbound fetch in test: ${resolvedUrl.toString()}`);
  }

  if (resolvedUrl.pathname === "/api/csrf") {
    return buildDefaultResponse({ csrfToken: "test-csrf-token" });
  }

  if (resolvedUrl.pathname.startsWith("/api/")) {
    return buildDefaultResponse({});
  }

  return new Response("", { status: 200 });
}

beforeEach(() => {
  if (typeof window === "undefined") {
    return;
  }
  window.scrollTo = vi.fn();
  global.fetch = vi.fn(defaultFetch) as typeof fetch;
});

afterEach(() => {
  if (typeof window === "undefined") {
    return;
  }
  vi.clearAllMocks();
});
