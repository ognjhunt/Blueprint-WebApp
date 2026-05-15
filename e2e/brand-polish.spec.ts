import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  artifactSlugForRoute,
  buildBrandPolishReportMarkdown,
  buildNotionLayoutChecklistMarkdown,
  normalizeCheckableInternalHref,
  normalizeWhitespace,
  publicLaunchPosturePatterns,
  publicQaRoutes,
  qaOutputRoot,
  qaViewports,
} from "../scripts/qa/brand-polish";
import type { PublicQaRoute, QaCheckResult, QaLinkResult, QaRouteResult, QaViewport } from "../scripts/qa/brand-polish";

const repoRoot = process.cwd();
const outputRootPath = path.resolve(repoRoot, qaOutputRoot);
const screenshotsDir = path.join(outputRootPath, "screenshots");
const reportPath = path.join(outputRootPath, "report.md");
const summaryPath = path.join(outputRootPath, "summary.json");
const notionChecklistPath = path.join(outputRootPath, "notion-layout-checklist.md");
const notionChecklistRelativePath = path.posix.join(qaOutputRoot, "notion-layout-checklist.md");
const reportRelativePath = path.posix.join(qaOutputRoot, "report.md");

type PageMetrics = {
  bodyText: string;
  bodyTextLength: number;
  title: string;
  description: string;
  canonicalHref: string;
  robots: string;
  h1Texts: string[];
  hasFrameworkOverlay: boolean;
  horizontalOverflowPx: number;
  missingAltImages: string[];
  brokenImages: string[];
  unnamedInteractive: string[];
  unlabeledControls: string[];
  placeholderHits: string[];
  publicPostureHits: string[];
};

type VisibleAnchor = {
  href: string;
  text: string;
};

test.describe.configure({ mode: "serial" });

test("brand polish QA sweeps key public routes", async ({ page, request }) => {
  test.setTimeout(180_000);

  const generatedAt = new Date().toISOString();
  const routeResults: QaRouteResult[] = [];
  const linkResults: QaLinkResult[] = [];
  const issues: string[] = [];
  const linkSources = new Map<string, Set<string>>();
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

  try {
    for (const route of publicQaRoutes) {
      for (const viewport of qaViewports) {
        const result = await auditRouteViewport(page, route, viewport, {
          consoleErrors,
          pageErrors,
          resourceFailures,
          issues,
          linkSources,
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

    await auditInternalLinks(request, linkSources, linkResults, issues);
  } finally {
    writeQaArtifacts({
      generatedAt,
      baseUrl: baseUrl || "unknown",
      routeResults,
      linkResults,
      issues,
    });
  }

  expect(issues).toEqual([]);
});

async function auditRouteViewport(
  page: Page,
  route: PublicQaRoute,
  viewport: QaViewport,
  context: {
    consoleErrors: string[];
    pageErrors: string[];
    resourceFailures: string[];
    issues: string[];
    linkSources: Map<string, Set<string>>;
    setActiveRoute: (value: string) => void;
    getBaseUrl: () => string;
    setBaseUrl: (value: string) => void;
  },
): Promise<QaRouteResult> {
  const routeKey = `${route.path} ${viewport.name}`;
  context.setActiveRoute(routeKey);

  const checks: QaCheckResult[] = [];
  const consoleStart = context.consoleErrors.length;
  const pageErrorStart = context.pageErrors.length;
  const resourceFailureStart = context.resourceFailures.length;
  const artifactSlug = artifactSlugForRoute(route.path, viewport.name);
  const screenshotRelativePath = path.posix.join(qaOutputRoot, "screenshots", `${artifactSlug}.png`);
  const screenshotPath = path.resolve(repoRoot, screenshotRelativePath);

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });

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
      metrics.bodyTextLength > 400,
      "Nonblank body",
      `${metrics.bodyTextLength} visible text characters`,
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
      metrics.h1Texts.length > 0,
      "Visible H1 exists",
      metrics.h1Texts.join(" | ") || "No H1 text found",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.h1Texts.some((text) => normalizeWhitespace(text).includes(route.expectedHeading)),
      "Expected route heading",
      `Expected "${route.expectedHeading}", saw "${metrics.h1Texts.join(" | ")}"`,
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.title.includes("Blueprint") && metrics.title.length >= 12,
      "SEO title",
      metrics.title || "Missing title",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.description.length >= 50 && metrics.description.length <= 240,
      "SEO description",
      `${metrics.description.length} chars`,
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      canonicalMatches(metrics.canonicalHref, route.canonicalPath),
      "Canonical URL",
      metrics.canonicalHref || "Missing canonical",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      Boolean(metrics.robots) && !/\bnoindex\b/i.test(metrics.robots),
      "Robots indexable",
      metrics.robots || "Missing robots meta",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.horizontalOverflowPx <= 8,
      "No horizontal overflow",
      `${metrics.horizontalOverflowPx}px overflow`,
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.missingAltImages.length === 0,
      "Visible images carry alt attributes",
      metrics.missingAltImages.join(", ") || "All visible images have alt attributes",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.brokenImages.length === 0,
      "Visible images load",
      metrics.brokenImages.join(", ") || "All visible images decoded",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.unnamedInteractive.length === 0,
      "Interactive controls have names",
      metrics.unnamedInteractive.join(", ") || "All visible controls have names",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.unlabeledControls.length === 0,
      "Visible form controls are labeled",
      metrics.unlabeledControls.join(", ") || "All visible form controls are labeled",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.placeholderHits.length === 0,
      "No placeholder residue",
      metrics.placeholderHits.join(", ") || "No placeholder markers found",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      metrics.publicPostureHits.length === 0,
      "Public launch posture",
      metrics.publicPostureHits.join(", ") || "No broad prelaunch or apology language found",
      routeKey,
      context.issues,
    );

    await auditRequiredCtas(page, route, routeKey, checks, context.issues);

    const routeConsoleErrors = context.consoleErrors.slice(consoleStart);
    const routePageErrors = context.pageErrors.slice(pageErrorStart);
    const routeResourceFailures = context.resourceFailures.slice(resourceFailureStart);
    addCheck(
      checks,
      routeConsoleErrors.length === 0 && routePageErrors.length === 0,
      "Console health",
      [...routeConsoleErrors, ...routePageErrors].join(" | ") || "No console/page errors",
      routeKey,
      context.issues,
    );
    addCheck(
      checks,
      routeResourceFailures.length === 0,
      "Critical asset responses",
      routeResourceFailures.join(" | ") || "No critical document/script/style/image/font failures",
      routeKey,
      context.issues,
    );

    await page.screenshot({ path: screenshotPath, fullPage: false });

    if (viewport.name === "desktop") {
      const visibleAnchors = await collectVisibleAnchors(page);
      for (const anchor of visibleAnchors) {
        const normalizedHref = normalizeCheckableInternalHref(anchor.href, page.url());
        if (!normalizedHref) continue;
        const sourceRoutes = context.linkSources.get(normalizedHref) ?? new Set<string>();
        sourceRoutes.add(route.path);
        context.linkSources.set(normalizedHref, sourceRoutes);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      name: "Route audit execution",
      status: "fail",
      detail: message,
    });
    context.issues.push(`${routeKey}: Route audit execution failed: ${message}`);
  }

  return {
    routeLabel: route.label,
    routePath: route.path,
    viewportName: viewport.name,
    screenshotPath: screenshotRelativePath,
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    checks,
  };
}

async function collectPageMetrics(page: Page): Promise<PageMetrics> {
  return page.evaluate((posturePatterns) => {
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    const isVisible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const bodyText = normalize(document.body?.innerText ?? "");
    const title = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";
    const canonicalHref = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "";
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? "";
    const h1Texts = Array.from(document.querySelectorAll("h1"))
      .filter(isVisible)
      .map((element) => normalize(element.textContent ?? ""))
      .filter(Boolean);

    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );
    const horizontalOverflowPx = Math.max(0, scrollWidth - window.innerWidth);

    const visibleImages = Array.from(document.images).filter(isVisible);
    const missingAltImages = visibleImages
      .filter((image) => !image.hasAttribute("alt"))
      .map((image) => image.currentSrc || image.src || image.outerHTML.slice(0, 80));
    const brokenImages = visibleImages
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src || image.outerHTML.slice(0, 80));

    const unnamedInteractive = Array.from(document.querySelectorAll("a[href], button"))
      .filter(isVisible)
      .filter((element) => {
        const text = normalize(element.textContent ?? "");
        const ariaLabel = normalize(element.getAttribute("aria-label") ?? "");
        const titleAttr = normalize(element.getAttribute("title") ?? "");
        return !text && !ariaLabel && !titleAttr;
      })
      .map((element) => element.outerHTML.slice(0, 100));

    const unlabeledControls = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, select"))
      .filter(isVisible)
      .filter((element) => {
        const control = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const hasNativeLabel = "labels" in control && control.labels && control.labels.length > 0;
        const hasAccessibleLabel = Boolean(
          normalize(control.getAttribute("aria-label") ?? "") ||
          normalize(control.getAttribute("aria-labelledby") ?? "") ||
          normalize(control.getAttribute("placeholder") ?? "") ||
          normalize(control.getAttribute("title") ?? ""),
        );
        return !hasNativeLabel && !hasAccessibleLabel;
      })
      .map((element) => element.outerHTML.slice(0, 100));

    const placeholderPatterns = [
      { label: "TODO", pattern: /\bTODO\b/i },
      { label: "Lorem ipsum", pattern: /lorem ipsum/i },
      { label: "undefined", pattern: /\bundefined\b/i },
      { label: "[object Object]", pattern: /\[object Object\]/i },
      { label: "NaN", pattern: /\bNaN\b/ },
    ];
    const placeholderHits = placeholderPatterns
      .filter((entry) => entry.pattern.test(bodyText))
      .map((entry) => entry.label);
    const publicPostureHits = posturePatterns
      .filter((entry) => new RegExp(entry.pattern, entry.flags).test(bodyText))
      .map((entry) => entry.label);

    const hasFrameworkOverlay = Boolean(
      document.querySelector("vite-error-overlay, nextjs-portal, webpack-dev-server-client-overlay") ||
      /Internal server error|Failed to compile|Unhandled Runtime Error/i.test(bodyText),
    );

    return {
      bodyText,
      bodyTextLength: bodyText.length,
      title,
      description,
      canonicalHref,
      robots,
      h1Texts,
      hasFrameworkOverlay,
      horizontalOverflowPx,
      missingAltImages,
      brokenImages,
      unnamedInteractive,
      unlabeledControls,
      placeholderHits,
      publicPostureHits,
    };
  }, publicLaunchPosturePatterns);
}

async function auditRequiredCtas(
  page: Page,
  route: PublicQaRoute,
  routeKey: string,
  checks: QaCheckResult[],
  issues: string[],
) {
  for (const cta of route.requiredCtas) {
    const ctaLocator = page.getByRole("link", { name: new RegExp(escapeRegExp(cta.label), "i") });
    const count = await ctaLocator.count();
    const candidateHrefs: string[] = [];
    let hasMatchingVisibleHref = false;

    for (let index = 0; index < count; index += 1) {
      const candidate = ctaLocator.nth(index);
      const isVisible = await candidate.isVisible().catch(() => false);
      const href = await candidate.getAttribute("href").catch(() => null);
      if (href) candidateHrefs.push(href);
      if (isVisible && href?.startsWith(cta.hrefStartsWith)) {
        hasMatchingVisibleHref = true;
        break;
      }
    }

    addCheck(
      checks,
      count > 0 && hasMatchingVisibleHref,
      `CTA: ${cta.label}`,
      candidateHrefs.length > 0 ? `hrefs=${candidateHrefs.join(", ")}` : "CTA missing",
      routeKey,
      issues,
    );
  }
}

async function collectVisibleAnchors(page: Page): Promise<VisibleAnchor[]> {
  return page.locator("a[href]").evaluateAll((anchors) => {
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    const isVisible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    return anchors
      .filter(isVisible)
      .map((anchor) => {
        const link = anchor as HTMLAnchorElement;
        return {
          href: link.href,
          text: normalize(link.textContent ?? ""),
        };
      });
  });
}

async function auditInternalLinks(
  request: APIRequestContext,
  linkSources: Map<string, Set<string>>,
  linkResults: QaLinkResult[],
  issues: string[],
) {
  const hrefs = Array.from(linkSources.keys()).sort();

  for (const href of hrefs) {
    const sourceRoutes = Array.from(linkSources.get(href) ?? []).sort();
    try {
      const response = await request.get(href, { maxRedirects: 2 });
      const ok = response.status() < 400;
      linkResults.push({
        href,
        status: ok ? "pass" : "fail",
        httpStatus: response.status(),
        sourceRoutes,
      });
      if (!ok) {
        issues.push(`Internal link ${href} returned HTTP ${response.status()} from ${sourceRoutes.join(", ")}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      linkResults.push({
        href,
        status: "fail",
        httpStatus: null,
        sourceRoutes,
      });
      issues.push(`Internal link ${href} could not be requested from ${sourceRoutes.join(", ")}: ${message}`);
    }
  }
}

function canonicalMatches(canonicalHref: string, canonicalPath: string): boolean {
  if (!canonicalHref) return false;
  try {
    const canonical = new URL(canonicalHref);
    return canonical.origin === "https://tryblueprint.io" && canonical.pathname === canonicalPath;
  } catch {
    return false;
  }
}

function addCheck(
  checks: QaCheckResult[],
  pass: boolean,
  name: string,
  detail: string,
  routeKey: string,
  issues: string[],
) {
  checks.push({
    name,
    status: pass ? "pass" : "fail",
    detail,
  });
  if (!pass) {
    issues.push(`${routeKey}: ${name} failed (${detail})`);
  }
}

function writeQaArtifacts({
  generatedAt,
  baseUrl,
  routeResults,
  linkResults,
  issues,
}: {
  generatedAt: string;
  baseUrl: string;
  routeResults: QaRouteResult[];
  linkResults: QaLinkResult[];
  issues: string[];
}) {
  fs.mkdirSync(outputRootPath, { recursive: true });
  fs.writeFileSync(
    notionChecklistPath,
    buildNotionLayoutChecklistMarkdown({
      generatedAt,
      reportPath: reportRelativePath,
    }),
  );
  fs.writeFileSync(
    reportPath,
    buildBrandPolishReportMarkdown({
      generatedAt,
      baseUrl,
      routeResults,
      linkResults,
      issues,
      notionChecklistPath: notionChecklistRelativePath,
    }),
  );
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify({
      generatedAt,
      baseUrl,
      routeResults,
      linkResults,
      issues,
    }, null, 2)}\n`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isKnownLocalConsoleNoise(message: string): boolean {
  return [
    /WebSocket connection to 'ws:\/\/127\.0\.0\.1:\d+\/\?token=.*failed/i,
    /Failed to construct 'WebSocket': The URL 'ws:\/\/localhost:undefined\/\?token=/i,
    /Error setting persistence:/i,
    /Failed to initialize auth state listener:/i,
    /Warning: Using UNSAFE_componentWillMount in strict/i,
    /Please update the following components: %s/i,
    /^\{level: error, message: Client log entry,/i,
  ].some((pattern) => pattern.test(message));
}
