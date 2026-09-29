/** Exact, bounded parser for Pipeline's four-field capture-owner observation request. */
import express, { type Request, type RequestHandler } from "express";

const pathPattern = /^\/api\/internal\/pipeline\/creator-captures\/[A-Za-z0-9._-]+\/capture-owner\/?$/;
const keys = new Set(["request_id", "scene_id", "completion_marker_generation", "remaining_timeout_ms"]);
const raw = express.raw({ type: "application/json", limit: 4096, inflate: false });

export interface CaptureOwnerBody {
  request_id: string;
  scene_id: string;
  completion_marker_generation: string;
  remaining_timeout_ms: number;
}

export function isCaptureOwnerPath(path: string): boolean { return pathPattern.test(path); }

/** Decode flat JSON lexically so escaped duplicate keys cannot collapse in JSON.parse. */
export function decodeCaptureOwnerFlatJson(text: string): CaptureOwnerBody {
  let at = 0;
  const white = () => { while (at < text.length && (text[at] === " " || text[at] === "\t"
    || text[at] === "\n" || text[at] === "\r")) at++; };
  const token = (wanted: string) => {
    white(); if (text[at] !== wanted) throw new Error("capture_owner_json_invalid"); at++;
  };
  const string = (): string => {
    white();
    if (text[at] !== '"') throw new Error("capture_owner_json_invalid");
    const start = at++;
    let escaped = false;
    while (at < text.length) {
      const c = text[at++];
      if (!escaped && c === '"') {
        const parsed = JSON.parse(text.slice(start, at));
        if (typeof parsed !== "string") throw new Error("capture_owner_json_invalid");
        return parsed;
      }
      if (!escaped && c.charCodeAt(0) < 32) throw new Error("capture_owner_json_invalid");
      if (c === "\\" && !escaped) escaped = true;
      else escaped = false;
    }
    throw new Error("capture_owner_json_invalid");
  };
  token("{");
  const fields: Record<string, string | number> = Object.create(null);
  const seen = new Set<string>();
  while (true) {
    white();
    if (text[at] === "}" && seen.size > 0) { at++; break; }
    const key = string();
    if (!keys.has(key) || seen.has(key)) throw new Error("capture_owner_json_invalid");
    seen.add(key);
    token(":");
    if (key === "remaining_timeout_ms") {
      white(); const start = at;
      while (at < text.length && /[0-9]/.test(text[at])) at++;
      const source = text.slice(start, at);
      if (!/^[1-9][0-9]*$/.test(source)) throw new Error("capture_owner_json_invalid");
      fields[key] = Number(source);
    } else fields[key] = string();
    white();
    if (text[at] === "}") { at++; break; }
    token(",");
    if (text[at] === "}") throw new Error("capture_owner_json_invalid");
  }
  white();
  if (at !== text.length || seen.size !== keys.size) throw new Error("capture_owner_json_invalid");
  const value = fields as unknown as CaptureOwnerBody;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value.request_id)
      || value.scene_id !== `site-${value.request_id}`
      || !/^[1-9][0-9]{0,19}$/.test(value.completion_marker_generation)
      || !Number.isInteger(value.remaining_timeout_ms)
      || value.remaining_timeout_ms < 1 || value.remaining_timeout_ms > 10_000) {
    throw new Error("capture_owner_json_invalid");
  }
  return value;
}

export const captureOwnerRawBody: RequestHandler = (req, res, next) => {
  if (req.method !== "POST" || !isCaptureOwnerPath(req.path)) return next();
  const encoding = req.header("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") return res.status(415).json({ code: "capture_owner_encoding_invalid" });
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.header("content-type") ?? "")) {
    return res.status(415).json({ code: "capture_owner_content_type_invalid" });
  }
  raw(req, res, (error) => {
    if (error) return res.status((error as { status?: number }).status === 413 ? 413 : 400)
      .json({ code: "capture_owner_body_invalid" });
    if (!Buffer.isBuffer(req.body) || req.body.length < 2 || req.body.length > 4096) {
      return res.status(400).json({ code: "capture_owner_body_invalid" });
    }
    try {
      const body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(req.body);
      if (body.charCodeAt(0) === 0xfeff) throw new Error("capture_owner_bom_invalid");
      const parsed = decodeCaptureOwnerFlatJson(body);
      req.body = parsed;
      (req as Request & { rawBody?: string; captureOwnerBodyAdmitted?: boolean }).rawBody = body;
      (req as Request & { captureOwnerBodyAdmitted?: boolean }).captureOwnerBodyAdmitted = true;
      next();
    } catch {
      res.status(400).json({ code: "capture_owner_body_invalid" });
    }
  });
};
