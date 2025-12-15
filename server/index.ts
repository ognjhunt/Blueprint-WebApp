import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { randomUUID } from "crypto";

import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import geminiRouter from "./routes/gemini";
import { attachRequestMeta, logger } from "./logger";

const app = express();

// Configure middleware
const defaultBodyLimit = process.env.API_BODY_LIMIT || "1mb";
app.use(express.json({ limit: defaultBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: defaultBodyLimit }));

// Configure CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Mount the Gemini router
app.use('/api/gemini', geminiRouter);

app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();
  const requestId = randomUUID();
  res.locals.requestId = requestId;

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) {
      return;
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    logger.info(
      attachRequestMeta({
        requestId,
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode: res.statusCode,
        durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : undefined,
        contentLength: req.headers["content-length"],
      }),
      "Request completed",
    );
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
