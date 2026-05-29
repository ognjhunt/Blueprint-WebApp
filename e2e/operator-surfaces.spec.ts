import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  buildOperatorQaReportMarkdown,
  getOperatorQaFixtureForRequest,
  operatorQaArtifactSlugForSurface,
  operatorQaOutputRoot,
  operatorQaSurfaces,
  operatorQaViewports,
} from "../scripts/qa/operator-surfaces";
import type {
  OperatorQaCheckResult,
  OperatorQaRouteResult,
  OperatorQaSurface,
  OperatorQaViewport,
} from "../scripts/qa/operator-surfaces";

const repoRoot = process.cwd();
const outputRootPath = path.resolve(repoRoot, operatorQaOutputRoot);
const screenshotsDir = path.join(outputRootPath, "screenshots");
const reportPath = path.join(outputRootPath, "report.md");
const summaryPath = path.join(outputRootPath, "summary.json");

type PageMetrics = {
  bodyTextLength: number;
  h1Texts: string[];
  hasFrameworkOverlay: boolean;
  horizontalOverflowPx: number;
};

test.describe.configure({ mode: "serial" });

test("operator surface QA renders internal surfaces from local fixtures only", async ({ page }) => {
  test.setTimeout(180_000);

  const generatedAt = new Date().toISOString();
  const routeResults: OperatorQaRouteResult[] = [];
  const issues: string[] = [];
  const blockedLiveEndpoints = new Set<string>();
  const stubbedExternalAssets = new Set<string>();
  const apiFixtureHits: Record<string, number> = {};
  let baseUrl = "";
  let activeRoute = "setup";

  fs.rmSync(outputRootPath, { recursive: true, force: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const resourceFailures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !isKnownLocalConsoleNoise(message.text())) {
      consoleErrors.push(`${activeRoute}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    if (!isKnownLocalConsoleNoise(error.message)) {
      pageErrors.push(`${activeRoute}: ${error.message}`);
    }
  });
  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (
      response.status() >= 400 &&
      ["document", "stylesheet", "script", "image", "font"].includes(resourceType)
    ) {
      resourceFailures.push(`${activeRoute}: ${response.status()} ${response.url()}`);
    }
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const isLocalHost = ["127.0.0.1", "localhost", "::1"].includes(requestUrl.hostname);

    if (isLocalHost && requestUrl.pathname.startsWith("/api/")) {
      const fixture = getOperatorQaFixtureForRequest(request.url(), request.method());
      if (!fixture) {
        blockedLiveEndpoints.add(`${request.method()} ${requestUrl.pathname}${requestUrl.search}`);
        await route.fulfill({
          status: 599,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: "operator_qa_unmocked_api_boundary",
            path: requestUrl.pathname,
          }),
        });
        return;
      }

      apiFixtureHits[fixture.fixtureId] = (apiFixtureHits[fixture.fixtureId] || 0) + 1;
      await route.fulfill({
        status: fixture.status,
        contentType: "application/json",
        body: JSON.stringify(fixture.body),
      });
      return;
    }

    if (isStubbedExternalAsset(requestUrl)) {
      stubbedExternalAssets.add(`${request.method()} ${requestUrl.origin}${requestUrl.pathname}`);
      await route.fulfill({
        status: 200,
        contentType: requestUrl.hostname === "fonts.googleapis.com" ? "text/css" : "font/woff2",
        body: "",
      });
      return;
    }

    if (["http:", "https:"].includes(requestUrl.protocol) && !isLocalHost) {
      blockedLiveEndpoints.add(`${request.method()} ${requestUrl.origin}${requestUrl.pathname}`);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });

  try {
    for (const surface of operatorQaSurfaces) {
      for (const viewport of operatorQaViewports) {
        const result = await auditSurfaceViewport(page, surface, viewport, {
          apiFixtureHits,
          consoleErrors,
          pageErrors,
          resourceFailures,
          issues,
          setActiveRoute: (value) => {
            activeRoute = value;
          },
          getBaseUrl: () => baseUrl,
          setBaseUrl: (value) => {
            baseUrl = value;
          },
        });
        routeResults.push(result);
      }
    }
  } finally {
    writeOperatorQaArtifacts({
      generatedAt,
      baseUrl: baseUrl || "unknown",
      routeResults,
      issues,
      apiFixtureHits,
      blockedLiveEndpoints: [...blockedLiveEndpoints],
      stubbedExternalAssets: [...stubbedExternalAssets],
    });
  }

  expect([...blockedLiveEndpoints]).toEqual([]);
  expect(issues).toEqual([]);
});

async function auditSurfaceViewport(
  page: Page,
  surface: OperatorQaSurface,
  viewport: OperatorQaViewport,
  context: {
    apiFixtureHits: Record<string, number>;
    consoleErrors: string[];
    pageErrors: string[];
    resourceFailures: string[];
    issues: string[];
    setActiveRoute: (value: string) => void;
    getBaseUrl: () => string;
    setBaseUrl: (value: string) => void;
  },
): Promise<OperatorQaRouteResult> {
  const routeKey = `${surface.path} ${viewport.name}`;
  context.setActiveRoute(routeKey);

  const checks: OperatorQaCheckResult[] = [];
  const consoleStart = context.consoleErrors.length;
  const pageErrorStart = context.pageErrors.length;
  const resourceFailureStart = context.resourceFailures.length;
  const fixtureStartHits = { ...context.apiFixtureHits };
  const artifactSlug = operatorQaArtifactSlugForSurface(surface.path, viewport.name);
  const screenshotRelativePath = path.posix.join(
    operatorQaOutputRoot,
    "screenshots",
    `${artifactSlug}.png`,
  );
  const screenshotPath = path.resolve(repoRoot, screenshotRelativePath);

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const response = await page.goto(surface.path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
    await page
      .waitForFunction(
        (expectedTexts) =>
          expectedTexts.every((text) => {
            const bodyText = (document.body.innerText || "").toLowerCase();
            return bodyText.includes(String(text).toLowerCase());
          }),
        surface.expectedTexts,
        { timeout: 15_000 },
      )
      .catch(() => undefined);

    if (!context.getBaseUrl()) {
      context.setBaseUrl(new URL(page.url()).origin);
    }

    const metrics = await collectPageMetrics(page);

    addCheck(
      checks,
      Boolean(response && response.status() < 400),
      "HTTP document status",
      response ? `${response.status()} ${response.statusText()}` : "No document response",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.bodyTextLength > 250,
      "Nonblank body",
      `${metrics.bodyTextLength} visible text characters`,
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.h1Texts.length > 0,
      "Visible H1 exists",
      metrics.h1Texts.join(" | ") || "No H1 text found",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      !metrics.hasFrameworkOverlay,
      "No framework error overlay",
      metrics.hasFrameworkOverlay ? "Framework overlay text or node detected" : "No overlay detected",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.horizontalOverflowPx <= 48,
      "No large horizontal overflow",
      `${metrics.horizontalOverflowPx}px overflow`,
      routeKey,
      context.issues,
    );

    for (const expectedText of surface.expectedTexts) {
      const bodyContainsExpected = await page
        .locator("body")
        .evaluate((body, text) => {
          const bodyText = (body.innerText || "").toLowerCase();
          return bodyText.includes(String(text).toLowerCase());
        }, expectedText);
      addCheck(
        checks,
        bodyContainsExpected,
        `Expected text: ${expectedText}`,
        bodyContainsExpected ? "Found" : "Missing",
        routeKey,
        context.issues,
      );
    }

    for (const fixtureId of surface.fixtureIds) {
      const fixtureHitThisRoute =
        (context.apiFixtureHits[fixtureId] || 0) > (fixtureStartHits[fixtureId] || 0);
      const sharedFixtureAlreadyHit =
        ["csrf", "analytics-ingest"].includes(fixtureId) &&
        (context.apiFixtureHits[fixtureId] || 0) > 0;
      addCheck(
        checks,
        fixtureHitThisRoute || sharedFixtureAlreadyHit,
        `Fixture used: ${fixtureId}`,
        `Hits: ${context.apiFixtureHits[fixtureId] || 0}`,
        routeKey,
        context.issues,
      );
    }

    const routeConsoleErrors = context.consoleErrors.slice(consoleStart);
    const routePageErrors = context.pageErrors.slice(pageErrorStart);
    const routeResourceFailures = context.resourceFailures.slice(resourceFailureStart);

    addCheck(
      checks,
      routeConsoleErrors.length === 0,
      "No console errors",
      routeConsoleErrors.join("; ") || "No console errors",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      routePageErrors.length === 0,
      "No page errors",
      routePageErrors.join("; ") || "No page errors",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      routeResourceFailures.length === 0,
      "No failed document/assets",
      routeResourceFailures.join("; ") || "No failed document/assets",
      routeKey,
      context.issues,
    );

    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    addCheck(
      checks,
      false,
      "Route audit completed",
      error instanceof Error ? error.message : String(error),
      routeKey,
      context.issues,
    );
  }

  return {
    surfaceLabel: surface.label,
    routePath: surface.path,
    viewportName: viewport.name,
    screenshotPath: screenshotRelativePath,
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    checks,
  };
}

async function collectPageMetrics(page: Page): Promise<PageMetrics> {
  return page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    const h1Texts = Array.from(document.querySelectorAll("h1"))
      .map((element) => element.textContent?.trim() || "")
      .filter(Boolean);
    const hasFrameworkOverlay =
      Boolean(document.querySelector("vite-error-overlay")) ||
      Boolean(document.querySelector("[data-plugin-runtime-error-modal]")) ||
      bodyText.includes("plugin:runtime-error-plugin") ||
      bodyText.includes("Unhandled Runtime Error");
    const documentOverflow = Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const bodyOverflow = Math.max(0, document.body.scrollWidth - document.body.clientWidth);

    return {
      bodyTextLength: bodyText.trim().length,
      h1Texts,
      hasFrameworkOverlay,
      horizontalOverflowPx: Math.max(documentOverflow, bodyOverflow),
    };
  });
}

function addCheck(
  checks: OperatorQaCheckResult[],
  passed: boolean,
  name: string,
  detail: string,
  routeKey: string,
  issues: string[],
) {
  checks.push({
    name,
    status: passed ? "pass" : "fail",
    detail,
  });

  if (!passed) {
    issues.push(`${routeKey}: ${name} failed - ${detail}`);
  }
}

function isKnownLocalConsoleNoise(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("websocket") ||
    text.includes("failed to connect to vite websocket") ||
    text.includes("download the react devtools") ||
    text.includes("using unsafe_componentwillmount in strict mode") ||
    text.includes("sideeffect(nullcomponent2)")
  );
}

function isStubbedExternalAsset(requestUrl: URL) {
  return (
    (requestUrl.hostname === "fonts.googleapis.com" && requestUrl.pathname === "/css2") ||
    requestUrl.hostname === "fonts.gstatic.com"
  );
}

function writeOperatorQaArtifacts(input: {
  generatedAt: string;
  baseUrl: string;
  routeResults: OperatorQaRouteResult[];
  issues: string[];
  apiFixtureHits: Record<string, number>;
  blockedLiveEndpoints: string[];
  stubbedExternalAssets: string[];
}) {
  fs.mkdirSync(outputRootPath, { recursive: true });
  fs.writeFileSync(
    reportPath,
    buildOperatorQaReportMarkdown(input),
    "utf8",
  );
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        ...input,
        outputRoot: operatorQaOutputRoot,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
