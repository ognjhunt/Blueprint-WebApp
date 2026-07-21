import '@testing-library/jest-dom';
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";

// Tests must never rewrite tracked operational evidence (ops/paperclip/**,
// docs/city-launch-system-*.md). Redirect every canonical artifact write into
// a per-worker temp directory; subprocess-spawning tests inherit this through
// {...process.env}. See server/utils/canonicalArtifactRoot.ts.
if (!process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT?.trim()) {
  process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT = mkdtempSync(
    join(tmpdir(), "blueprint-canonical-artifacts-"),
  );
}

// react-helmet-async's <Helmet> requires a <HelmetProvider> ancestor; without one its
// context default is `{}`, so HelmetDispatcher.init() crashes on `helmetInstances.add()`.
// Page/component tests render pages standalone (no app-level provider). Mock the shared
// @/lib/helmet shim (not just @/components/SEO) since several pages import Helmet directly.
// Real SEO/meta output is covered separately by build-output.test.ts against the actual
// prerendered HTML.
vi.mock("@/lib/helmet", () => ({
  Helmet: () => null,
  HelmetProvider: ({ children }: { children?: ReactNode }) => children,
}));

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
