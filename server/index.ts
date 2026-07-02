import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { createServer } from "http";
import rateLimit from "express-rate-limit";

import { registerRoutes } from "./routes";
import { stripeWebhookHandler } from "./routes/stripe-webhooks";
import { handleHostedSessionUiUpgrade } from "./routes/site-world-sessions";
import { setupVite, serveStatic } from "./vite";
import { attachRequestMeta, logger, generateTraceId, logSecurityEvent } from "./logger";
import { incrementRequestCount, incrementErrorCount } from "./routes/health";
import { validateEnv } from "./config/env";
import { createRateLimitRedisStore } from "./utils/rate-limit-redis";
import { startOpsAutomationScheduler } from "./utils/opsAutomationScheduler";
import { buildFirehoseConfig } from "./utils/marketSignalProviderFirehose";
import {
  buildSitemapXml,
  getPublicAssetDir,
  getPublicAssetPath,
} from "./utils/public-artifacts";
import { buildContentSecurityPolicy } from "./utils/contentSecurityPolicy";

const env = validateEnv();

// Log Firehose configuration status at startup
const firehoseConfig = buildFirehoseConfig();
if (firehoseConfig) {
  logger.info(
    { event: "firehose_configured", baseUrl: firehoseConfig.baseUrl },
    "Firehose configured successfully",
  );
} else {
  logger.warn(
    { event: "firehose_config_unavailable" },
    "Firehose not configured: missing FIREHOSE_API_TOKEN or FIREHOSE_BASE_URL. Firehose signals will be skipped.",
  );
}

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const disableOpsAutomationScheduler =
  process.env.BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER === "1" ||
  process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH === "1";

const noIndexPathPatterns = [
  /^\/admin(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/requests(?:\/|$)/,
  /^\/portal(?:\/|$)/,
  /^\/sign-in(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/forgot-password(?:\/|$)/,
  /^\/signup(?:\/|$)/,
  /^\/off-waitlist-signup(?:\/|$)/,
  /^\/capture-app\/?$/,
  /^\/world-models\/[^/]+\/(?:start|workspace)(?:\/|$)/,
];

function shouldNoIndexPath(pathname: string) {
  return noIndexPathPatterns.some((pattern) => pattern.test(pathname));
}

function captureRawBody(req: Request & { rawBody?: string }, _res: Response, buf: Buffer) {
  if (buf.length > 0) {
    req.rawBody = buf.toString("utf8");
  }
}

const createRateLimitStore = (prefix: string) => createRateLimitRedisStore(prefix);

const createRateLimiter = ({
  windowMs,
  limit,
  prefix,
  skipPaths = [],
}: {
  windowMs: number;
  limit: number;
  prefix: string;
  skipPaths?: string[];
}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRateLimitStore(prefix),
    skip: (req) =>
      req.method === "OPTIONS" ||
      skipPaths.some((path) => req.path.startsWith(path)),
    handler: (_req, res) => {
      res.status(429).json({ error: "Too many requests. Please try again later." });
    },
  });

const globalRateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
const globalRateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 300);
const globalLimiter = createRateLimiter({
  windowMs: globalRateLimitWindowMs,
  limit: globalRateLimitMax,
  prefix: "rl:global:",
  skipPaths: ["/health", "/site-worlds/sessions"],
});

const aiLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS ?? 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_AI_MAX ?? 30),
  prefix: "rl:ai:",
});

const authLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
  prefix: "rl:auth:",
});

const uploadLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS ?? 60 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_UPLOAD_MAX ?? 10),
  prefix: "rl:upload:",
});

const hostedSessionLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_HOSTED_SESSION_WINDOW_MS ?? 15 * 60 * 1000),
  limit: Number(process.env.RATE_LIMIT_HOSTED_SESSION_MAX ?? 1500),
  prefix: "rl:hosted-session:",
});

// Configure middleware
const defaultBodyLimit = env.API_BODY_LIMIT || "1mb";
app.post(
  "/api/stripe/webhooks",
  express.raw({ type: "application/json", limit: defaultBodyLimit }),
  stripeWebhookHandler,
);
app.use(express.json({ limit: defaultBodyLimit, verify: captureRawBody }));
app.use(express.urlencoded({ extended: false, limit: defaultBodyLimit }));

const cspDirectives = buildContentSecurityPolicy({
  isProduction,
  posthogHost: process.env.VITE_PUBLIC_POSTHOG_HOST,
  hostedDemoRuntimeBaseUrl: env.BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL,
  hostedDemoRuntimeWebsocketBaseUrl:
    env.BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL,
});

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", cspDirectives);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
  );
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (shouldNoIndexPath(req.path)) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  next();
});

// Configure CORS - restrict in production
const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5000", "http://localhost:3000", "https://tryblueprint.io"];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // In production, validate origin against whitelist
  if (process.env.NODE_ENV === "production" && origin) {
    if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    // Don't set header if origin not in whitelist
  } else {
    // Development: allow all origins
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Trace-ID, X-CSRF-Token, X-Blueprint-Pipeline-Timestamp, X-Blueprint-Pipeline-Signature",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Apply the baseline limiter to API-style routes without throttling public page loads.
app.use("/api", globalLimiter);
app.use("/v1", globalLimiter);
app.use("/api/site-worlds/sessions", hostedSessionLimiter);

// Apply limiter for Gemini endpoints (routes registered in routes.ts)
app.use("/api/gemini", aiLimiter);

// Stricter limiters for sensitive routes
app.use("/api/ai-studio", aiLimiter);
app.use("/api/marketplace", aiLimiter);
app.use("/api/process-waitlist", aiLimiter);
app.use("/api/post-signup-workflows", aiLimiter);
app.use("/api/generate-image", aiLimiter);

app.use("/api/auth", authLimiter);
app.use("/api/create-checkout-session", authLimiter);
app.use("/api/submit-to-sheets", authLimiter);

app.use("/api/upload-to-b2", uploadLimiter);
app.use("/api/storage/uploads", uploadLimiter);

// Request tracking middleware
app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();

  // Generate or use existing trace ID
  const traceId = (req.headers["x-trace-id"] as string) || generateTraceId();
  res.locals.requestId = traceId;
  res.locals.traceId = traceId;

  // Set trace ID in response header for client debugging
  res.setHeader("X-Trace-ID", traceId);

  // Track request count for metrics
  incrementRequestCount();

  res.on("finish", () => {
    // Skip logging for non-API routes and health checks
    if (!req.path.startsWith("/api") && !req.path.startsWith("/health")) {
      return;
    }

    // Skip verbose health check logging
    if (req.path.startsWith("/health") && res.statusCode === 200) {
      return;
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    if (res.statusCode >= 500) {
      incrementErrorCount();
    }

    logger[logLevel](
      attachRequestMeta({
        traceId,
        requestId: traceId,
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode: res.statusCode,
        durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : undefined,
        contentLength: req.headers["content-length"],
        userAgent: req.headers["user-agent"],
        ip: req.ip || req.socket.remoteAddress,
      }),
      `${req.method} ${req.originalUrl || req.path} ${res.statusCode} - ${durationMs.toFixed(2)}ms`,
    );

    // Log slow requests
    if (durationMs > 5000) {
      logger.warn(
        { traceId, path: req.path, durationMs },
        `Slow request detected: ${req.path} took ${durationMs.toFixed(2)}ms`
      );
    }
  });

  next();
});

(async () => {
  registerRoutes(app);
  const server = createServer(app);
  server.on("upgrade", (req, socket, head) => {
    if ((req.url || "").startsWith("/api/site-worlds/sessions/")) {
      void handleHostedSessionUiUpgrade(req, socket, head);
      return;
    }
    socket.destroy();
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }

    logger.error(
      {
        ...attachRequestMeta({
          requestId: res.locals?.requestId,
          method: req.method,
          path: req.originalUrl || req.path,
          status,
        }),
        err,
      },
      "Unhandled application error",
    );
  });

  const publicDir = getPublicAssetDir(isProduction);
  const robotsPath = getPublicAssetPath(isProduction, "robots.txt");
  const sitemapPath = getPublicAssetPath(isProduction, "sitemap.xml");
  const llmsPath = getPublicAssetPath(isProduction, "llms.txt");
  const llmsFullPath = getPublicAssetPath(isProduction, "llms-full.txt");
  if (!fs.existsSync(robotsPath)) {
    const message =
      `robots.txt is missing from ${publicDir}. Ensure client/public/robots.txt is deployed verbatim.`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn({ path: robotsPath }, message);
  }

  app.get("/robots.txt", (_req, res) => {
    if (fs.existsSync(robotsPath)) {
      return res.sendFile(robotsPath);
    }

    return res.status(500).type("text/plain").send("robots.txt is missing.");
  });

  app.get("/sitemap.xml", (_req, res) => {
    if (fs.existsSync(sitemapPath)) {
      return res.sendFile(sitemapPath);
    }

    if (!isProduction) {
      return res.type("application/xml").send(buildSitemapXml());
    }

    return res.sendStatus(404);
  });

  // Serve llms.txt files for AI crawlers
  app.get("/llms.txt", (_req, res) => {
    if (fs.existsSync(llmsPath)) {
      return res.type("text/plain").sendFile(llmsPath);
    }
    return res.sendStatus(404);
  });

  app.get("/llms-full.txt", (_req, res) => {
    if (fs.existsSync(llmsFullPath)) {
      return res.type("text/plain").sendFile(llmsFullPath);
    }
    return res.sendStatus(404);
  });

  const legacyPublicRedirects: Array<{
    from: string;
    to: string | ((req: Request) => string);
  }> = [
    { from: "/product", to: "/" },
    { from: "/readiness", to: "/" },
    { from: "/readiness-pack", to: "/" },
    { from: "/quality-standard", to: "/" },
    { from: "/for-robot-integrators", to: "/" },
    { from: "/for-site-operators", to: "/contact/site-operator" },
    { from: "/contact", to: "/contact/robot-team" },
    { from: "/how-it-works", to: "/" },
    { from: "/world-models", to: "/sites" },
    { from: "/world-models/:slug", to: (req) => `/sites/${req.params.slug}` },
    { from: "/agents", to: "/contact/robot-team?persona=robot-team&source=server-redirect" },
    { from: "/capture-jobs", to: "/capture" },
    { from: "/capture-network", to: "/capture" },
    { from: "/capturer", to: "/capture" },
    { from: "/capturers", to: "/capture" },
    { from: "/capturer-access", to: "/capture" },
    { from: "/become-a-capturer", to: "/capture" },
    { from: "/for-capturers", to: "/capture" },
    { from: "/earn", to: "/capture" },
    { from: "/sample-deliverables", to: "/proof" },
    { from: "/launch-map", to: "/contact/robot-team?persona=robot-team&source=server-redirect" },
    { from: "/faq", to: "/proof" },
    { from: "/governance", to: "/proof" },
    { from: "/about", to: "/" },
    { from: "/updates", to: "/" },
    { from: "/careers", to: "/contact/robot-team?persona=robot-team&source=server-redirect" },
    { from: "/help", to: "/contact/robot-team?persona=robot-team&source=server-redirect" },
    { from: "/help/contact", to: "/contact/robot-team?persona=robot-team&source=server-redirect" },
    { from: "/help/category/:categorySlug", to: "/contact/robot-team?persona=robot-team&source=server-redirect" },
    { from: "/help/article/:articleSlug", to: "/contact/robot-team?persona=robot-team&source=server-redirect" },
    { from: "/pilot-exchange", to: "/proof" },
    { from: "/pilot-exchange-guide", to: "/proof" },
    { from: "/qualified-opportunities", to: "/proof" },
    { from: "/qualified-opportunities-guide", to: "/proof" },
    { from: "/solutions", to: "/" },
    { from: "/docs", to: "/proof" },
    { from: "/exact-site-hosted-review", to: "/" },
    { from: "/sample-evaluation", to: "/proof" },
    { from: "/case-studies", to: "/proof" },
    {
      from: "/book-exact-site-review",
      to: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=book-exact-site-review",
    },
    { from: "/blog", to: "/" },
    { from: "/partners", to: "/contact/robot-team" },
    { from: "/environments", to: "/proof" },
    { from: "/marketplace", to: "/sites" },
    { from: "/site-worlds", to: "/sites" },
    { from: "/site-worlds/:slug", to: (req) => `/sites/${req.params.slug}` },
    { from: "/site-worlds/:slug/start", to: (req) => `/world-models/${req.params.slug}/start` },
    { from: "/site-worlds/:slug/workspace", to: (req) => `/world-models/${req.params.slug}/workspace` },
  ];

  legacyPublicRedirects.forEach(({ from, to }) => {
    app.get([from, `${from}/`], (req, res) => {
      const queryStart = req.originalUrl.indexOf("?");
      const query = queryStart >= 0 ? req.originalUrl.slice(queryStart + 1) : "";
      const target = typeof to === "function" ? to(req) : to;
      const separator = query ? (target.includes("?") ? "&" : "?") : "";
      return res.redirect(301, `${target}${separator}${query}`);
    });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = env.PORT;
  const stopOpsAutomationScheduler = disableOpsAutomationScheduler
    ? () => undefined
    : startOpsAutomationScheduler();
  if (disableOpsAutomationScheduler) {
    logger.info(
      attachRequestMeta({ route: "ops-automation-scheduler" }),
      "Ops automation scheduler disabled for local QA",
    );
  }
  server.on("close", () => {
    stopOpsAutomationScheduler();
  });
  server.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT }, "Server listening");
  });
})();
