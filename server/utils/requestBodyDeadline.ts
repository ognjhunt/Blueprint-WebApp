import type { NextFunction, Request, Response } from "express";

/**
 * Node closes a request whose body is not fully received within `server.requestTimeout` (300 s by default), for
 * every route at once. A picked video sent in one request needs longer on a phone uplink, so the server turns that
 * off (`server.requestTimeout = 0`; `headersTimeout` still applies) and this middleware keeps the same 300 s limit on
 * every route except the whole-video upload, which gets an hour.
 */
export const REQUEST_BODY_TIMEOUT_MS = 300_000;
export const VIDEO_UPLOAD_BODY_TIMEOUT_MS = 60 * 60_000;

const WHOLE_VIDEO_UPLOAD = /^\/api\/self-capture\/uploads\/[^/]+\/?$/;

export function requestBodyTimeoutMs(
  method: string,
  path: string,
  limits = { defaultMs: REQUEST_BODY_TIMEOUT_MS, uploadMs: VIDEO_UPLOAD_BODY_TIMEOUT_MS },
): number {
  return method === "POST" && WHOLE_VIDEO_UPLOAD.test(path) ? limits.uploadMs : limits.defaultMs;
}

export function createRequestBodyDeadline(
  limits = { defaultMs: REQUEST_BODY_TIMEOUT_MS, uploadMs: VIDEO_UPLOAD_BODY_TIMEOUT_MS },
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.complete) return next();
    const timer = setTimeout(() => {
      if (req.complete) return;
      // As Node's own requestTimeout does: answer 408 and close the connection.
      if (!res.headersSent) {
        res.writeHead(408, { Connection: "close" });
        res.end(() => req.socket.destroy());
      } else {
        req.socket.destroy();
      }
    }, requestBodyTimeoutMs(req.method, req.path, limits));
    timer.unref();
    // An early response (e.g. 404 for a bad upload token) must not cancel the deadline: with requestTimeout off it is
    // the only bound on a body still trickling in, so it lasts until the body ends or the connection closes.
    const socket = req.socket;
    const clear = () => {
      clearTimeout(timer);
      socket.off("close", clear);
    };
    req.once("end", clear);
    socket.once("close", clear);
    next();
  };
}
