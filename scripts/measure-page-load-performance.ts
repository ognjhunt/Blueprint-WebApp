import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { chromium, type Page } from "playwright";

import { appRoutes } from "../client/src/app/routes";
import { siteLibrarySites } from "../client/src/data/siteLibrary";

type Args = {
  baseUrl: string;
  budgetMs: number;
  samples: number;
  timeoutMs: number;
  warmupTimeoutMs: number;
  outputDir: string;
  runOutputDir: string;
  allowFail: boolean;
  includeProtected: boolean;
  includeFallback: boolean;
};

type RouteTarget = {
  routePath: string;
  measuredPath: string;
  layout: string;
  shell: string;
};

type SingleMeasurement = {
  status: number | null;
  finalUrl: string;
  readyMs: number;
  loadMs: number;
  dclMs: number;
  responseEndMs: number;
};

type RouteMeasurement = RouteTarget & {
  status: number | null;
  finalUrl: string;
  passed: boolean;
  medianReadyMs: number;
  medianLoadMs: number;
  medianDomContentLoadedMs: number;
  medianResponseEndMs: number;
  samples: number[];
  loadSamples: number[];
  domContentLoadedSamples: number[];
  responseEndSamples: number[];
  error?: string;
};

const defaultSiteSlug = siteLibrarySites[0]?.slug || "springfield-robotics-lab";
const segmentSamples: Record<string, string> = {
  articleSlug: "package-access",
  categorySlug: "capture",
  citySlug: "austin",
  requestId: "perf-request",
  slug: defaultSiteSlug,
};

function parseArgs(argv: string[]): Args {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const args: Args = {
    baseUrl: process.env.PERF_BASE_URL || "http://127.0.0.1:5187",
    budgetMs: Number(process.env.PERF_PAGE_LOAD_BUDGET_MS || 50),
    samples: Number(process.env.PERF_PAGE_LOAD_SAMPLES || 3),
    timeoutMs: Number(process.env.PERF_PAGE_LOAD_TIMEOUT_MS || 10_000),
    warmupTimeoutMs: Number(process.env.PERF_PAGE_LOAD_WARMUP_TIMEOUT_MS || 1_000),
    outputDir:
      process.env.PERF_PAGE_LOAD_OUTPUT_DIR ||
      path.resolve(process.cwd(), "output/performance/page-load/latest"),
    runOutputDir:
      process.env.PERF_PAGE_LOAD_RUN_OUTPUT_DIR ||
      path.resolve(process.cwd(), "output/performance/page-load/runs", timestamp),
    allowFail: process.env.PERF_PAGE_LOAD_ALLOW_FAIL === "1",
    includeProtected: process.env.PERF_PAGE_LOAD_INCLUDE_PROTECTED !== "0",
    includeFallback: process.env.PERF_PAGE_LOAD_INCLUDE_FALLBACK !== "0",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--base-url" && next) {
      args.baseUrl = next;
      index += 1;
    } else if (arg === "--budget-ms" && next) {
      args.budgetMs = Number(next);
      index += 1;
    } else if (arg === "--samples" && next) {
      args.samples = Number(next);
      index += 1;
    } else if (arg === "--timeout-ms" && next) {
      args.timeoutMs = Number(next);
      index += 1;
    } else if (arg === "--warmup-timeout-ms" && next) {
      args.warmupTimeoutMs = Number(next);
      index += 1;
    } else if (arg === "--output-dir" && next) {
      args.outputDir = path.resolve(process.cwd(), next);
      index += 1;
    } else if (arg === "--run-output-dir" && next) {
      args.runOutputDir = path.resolve(process.cwd(), next);
      index += 1;
    } else if (arg === "--allow-fail") {
      args.allowFail = true;
    } else if (arg === "--public-only") {
      args.includeProtected = false;
    } else if (arg === "--skip-fallback") {
      args.includeFallback = false;
    }
  }

  return args;
}

function samplePath(routePath: string) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, (_, segment: string) => {
    return segmentSamples[segment] || `perf-${segment}`;
  });
}

function routes(args: Args): RouteTarget[] {
  const seen = new Set<string>();
  return appRoutes
    .filter((route) => {
      if (!route.path) {
        return args.includeFallback;
      }
      return args.includeProtected || route.layout !== "protected";
    })
    .map((route) => ({
      routePath: route.path || "(404 fallback)",
      measuredPath: route.path
        ? samplePath(route.path)
        : "/__blueprint-performance-fallback__",
      layout: route.layout,
      shell: route.shell || "site",
    }))
    .filter((route) => {
      const key = `${route.routePath}:${route.measuredPath}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function targetUrl(baseUrl: string, routePath: string) {
  return new URL(routePath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

async function localOnly(page: Page, baseUrl: string) {
  const allowedOrigin = new URL(baseUrl).origin;
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (
      requestUrl.origin === allowedOrigin ||
      requestUrl.protocol === "data:" ||
      requestUrl.protocol === "blob:"
    ) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });
}

async function measureOnce(
  page: Page,
  args: Args,
  measuredPath: string,
): Promise<SingleMeasurement> {
  await page.goto("about:blank");
  const startedAt = performance.now();
  const response = await page.goto(targetUrl(args.baseUrl, measuredPath), {
    waitUntil: "domcontentloaded",
    timeout: args.timeoutMs,
  });
  await page.waitForLoadState("load", { timeout: 1_000 }).catch(() => undefined);
  const wallMs = performance.now() - startedAt;
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return nav
      ? {
          dcl: nav.domContentLoadedEventEnd - nav.startTime,
          load: nav.loadEventEnd - nav.startTime,
          responseEnd: nav.responseEnd - nav.startTime,
        }
      : null;
  });
  const readyMs = timing?.load && timing.load > 0 ? timing.load : timing?.dcl || wallMs;
  return {
    status: response?.status() ?? null,
    finalUrl: page.url(),
    readyMs: round(readyMs),
    loadMs: round(timing?.load && timing.load > 0 ? timing.load : 0),
    dclMs: round(timing?.dcl ?? wallMs),
    responseEndMs: round(timing?.responseEnd ?? wallMs),
  };
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch {
    const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (fs.existsSync(chromePath)) {
      return chromium.launch({ executablePath: chromePath });
    }
    throw new Error("Playwright Chromium is unavailable and system Chrome was not found.");
  }
}

function renderMarkdown(args: Args, measurements: RouteMeasurement[], startedAt: string) {
  const failed = measurements.filter((measurement) => !measurement.passed);
  const slowest = [...measurements]
    .sort((a, b) => b.medianReadyMs - a.medianReadyMs)
    .slice(0, 12);
  const lines = [
    "# Page Load Performance",
    "",
    `- Status: ${failed.length === 0 ? "PASS" : "FAIL"}`,
    `- Started at: ${startedAt}`,
    `- Base URL: ${args.baseUrl}`,
    `- Budget: ${args.budgetMs} ms median browser document-ready timing`,
    `- Samples per route: ${args.samples}`,
    `- Route timeout: ${args.timeoutMs} ms`,
    `- Warmup timeout: ${args.warmupTimeoutMs} ms`,
    "- Conditions: production build, local-only network, Chromium/System Chrome, shared hot-cache context, 1366x900 viewport, warmup pass before measurement",
    `- Routes measured: ${measurements.length}`,
    `- Routes over budget: ${failed.length}`,
    "",
    "## Slowest Routes",
    "",
    "| Route | Measured path | Status | Median ready | Median load | Median DCL | Median responseEnd | Samples |",
    "|---|---:|---:|---:|---:|---:|---:|---|",
    ...slowest.map((measurement) =>
      [
        measurement.routePath,
        measurement.measuredPath,
        measurement.status ?? "n/a",
        `${measurement.medianReadyMs} ms`,
        `${measurement.medianLoadMs} ms`,
        `${measurement.medianDomContentLoadedMs} ms`,
        `${measurement.medianResponseEndMs} ms`,
        measurement.samples.join(", "),
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    ),
  ];

  if (failed.length) {
    lines.push("", "## Over Budget", "");
    failed.forEach((measurement) => {
      const error = measurement.error ? ` (${measurement.error})` : "";
      lines.push(
        `- ${measurement.routePath} via ${measurement.measuredPath}: ${measurement.medianReadyMs} ms${error}`,
      );
    });
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const routeList = routes(args);
  const browser = await launchBrowser();

  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await localOnly(page, args.baseUrl);

    for (let index = 0; index < routeList.length; index += 1) {
      const route = routeList[index];
      await page
        .goto(targetUrl(args.baseUrl, route.measuredPath), {
          waitUntil: "domcontentloaded",
          timeout: args.warmupTimeoutMs,
        })
        .catch(() => undefined);
      console.log(`[warmup ${index + 1}/${routeList.length}] ${route.measuredPath}`);
    }

    const measurements: RouteMeasurement[] = [];
    for (let index = 0; index < routeList.length; index += 1) {
      const route = routeList[index];
      const samples: number[] = [];
      const loads: number[] = [];
      const dcls: number[] = [];
      const responseEnds: number[] = [];
      let finalUrl = "";
      let status: number | null = null;
      let error: string | undefined;

      for (let sample = 0; sample < args.samples; sample += 1) {
        try {
          const measurement = await measureOnce(page, args, route.measuredPath);
          samples.push(measurement.readyMs);
          loads.push(measurement.loadMs);
          dcls.push(measurement.dclMs);
          responseEnds.push(measurement.responseEndMs);
          finalUrl = measurement.finalUrl;
          status = measurement.status;
        } catch (measurementError) {
          error =
            measurementError instanceof Error
              ? measurementError.message
              : String(measurementError);
          samples.push(args.timeoutMs);
          loads.push(args.timeoutMs);
          dcls.push(args.timeoutMs);
          responseEnds.push(args.timeoutMs);
        }
      }

      const medianReadyMs = round(median(samples));
      measurements.push({
        ...route,
        status,
        finalUrl,
        passed: medianReadyMs <= args.budgetMs,
        medianReadyMs,
        medianLoadMs: round(median(loads)),
        medianDomContentLoadedMs: round(median(dcls)),
        medianResponseEndMs: round(median(responseEnds)),
        samples,
        loadSamples: loads,
        domContentLoadedSamples: dcls,
        responseEndSamples: responseEnds,
        ...(error ? { error } : {}),
      });
      console.log(
        `[measure ${index + 1}/${routeList.length}] ${route.measuredPath} median=${medianReadyMs}ms`,
      );
    }

    fs.mkdirSync(args.outputDir, { recursive: true });
    fs.mkdirSync(args.runOutputDir, { recursive: true });
    const payload = {
      status: measurements.every((measurement) => measurement.passed) ? "PASS" : "FAIL",
      startedAt,
      finishedAt: new Date().toISOString(),
      args,
      measurements,
    };
    const report = renderMarkdown(args, measurements, startedAt);
    for (const outputDir of [args.outputDir, args.runOutputDir]) {
      fs.writeFileSync(
        path.join(outputDir, "page-load-performance.json"),
        `${JSON.stringify(payload, null, 2)}\n`,
        "utf8",
      );
      fs.writeFileSync(path.join(outputDir, "page-load-performance.md"), report, "utf8");
    }

    const failed = measurements.filter((measurement) => !measurement.passed);
    console.log(
      `${failed.length === 0 ? "PASS" : "FAIL"} ${measurements.length} routes measured; ${failed.length} over ${args.budgetMs} ms.`,
    );
    console.log(`latest: ${path.join(args.outputDir, "page-load-performance.md")}`);
    console.log(`run: ${path.join(args.runOutputDir, "page-load-performance.md")}`);
    if (failed.length && !args.allowFail) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
