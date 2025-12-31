import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";

import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import geminiRouter from "./routes/gemini";
import { attachRequestMeta, logger, generateTraceId, logSecurityEvent } from "./logger";
import { incrementRequestCount } from "./routes/health";

const app = express();

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

  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Trace-ID");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Mount the Gemini router
app.use("/api/gemini", geminiRouter);

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
