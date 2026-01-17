import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";

import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import geminiRouter from "./routes/gemini";
import { attachRequestMeta, logger, generateTraceId, logSecurityEvent } from "./logger";
import { incrementRequestCount, incrementErrorCount } from "./routes/health";

const app = express();

const rateLimitRedisUrl = process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL;
const redisClient =
  rateLimitRedisUrl && process.env.NODE_ENV === "production"
    ? createClient({ url: rateLimitRedisUrl })
    : null;

if (redisClient) {
  redisClient.on("error", (error) => {
    logger.warn({ error }, "Redis rate limit store error");
  });
  void redisClient.connect();
}

const createRateLimitStore = (prefix: string) =>
  redisClient
    ? new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix,
      })
    : undefined;

// Known crawler/bot User-Agents that should bypass rate limiting
const CRAWLER_USER_AGENTS = [
  "Googlebot",
  "Bingbot",
  "Slurp", // Yahoo
  "DuckDuckBot",
  "Baiduspider",
  "YandexBot",
  "facebookexternalhit",
  "Twitterbot",
  "LinkedInBot",
  "GPTBot", // OpenAI
  "ChatGPT-User", // OpenAI
  "Claude-Web", // Anthropic
  "Anthropic", // Anthropic
  "PerplexityBot",
  "Google-Extended", // Google AI
  "CCBot", // Common Crawl
  "Applebot",
];

const isCrawler = (userAgent: string | undefined): boolean => {
  if (!userAgent) return false;
  return CRAWLER_USER_AGENTS.some((bot) =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );
};

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
      skipPaths.some((path) => req.path.startsWith(path)) ||
      isCrawler(req.headers["user-agent"]),
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
  skipPaths: ["/health"],
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

// Configure middleware
const defaultBodyLimit = process.env.API_BODY_LIMIT || "1mb";
app.use(express.json({ limit: defaultBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: defaultBodyLimit }));

// Configure CORS - restrict in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
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
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Trace-ID, X-CSRF-Token",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Global rate limiting
app.use(globalLimiter);

// Mount the Gemini router
app.use("/api/gemini", aiLimiter, geminiRouter);

// Stricter limiters for sensitive routes
app.use("/api/ai-studio", aiLimiter);
app.use("/api/process-waitlist", aiLimiter);
app.use("/api/post-signup-workflows", aiLimiter);
app.use("/api/generate-image", aiLimiter);

app.use("/api/auth", authLimiter);
app.use("/api/create-checkout-session", authLimiter);
app.use("/api/submit-to-sheets", authLimiter);

app.use("/api/upload-to-b2", uploadLimiter);

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

  const publicDir = path.resolve(process.cwd(), "dist", "public");
  const robotsPath = path.join(publicDir, "robots.txt");
  const sitemapPath = path.join(publicDir, "sitemap.xml");
  const isProduction = process.env.NODE_ENV === "production";

  if (!fs.existsSync(robotsPath)) {
    const message =
      "robots.txt is missing from dist/public. Ensure client/public/robots.txt is deployed verbatim.";
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

    return res.sendStatus(404);
  });

  // Serve llms.txt files for AI crawlers
  const llmsPath = path.join(publicDir, "llms.txt");
  const llmsFullPath = path.join(publicDir, "llms-full.txt");

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

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = Number(process.env.PORT) || 5000;
  server.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT }, "Server listening");
  });
})();
