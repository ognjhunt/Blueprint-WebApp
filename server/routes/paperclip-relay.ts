import type { Request, Response } from "express";

const PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL = (
  process.env.PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL || ""
).trim();
const PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET = (
  process.env.PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET || ""
).trim();

export async function paperclipOpsFirestoreRelayHandler(req: Request, res: Response) {
  if (!PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL) {
    return res.status(503).json({ error: "Paperclip Firestore relay is not configured." });
  }
  if (PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET) {
    const expected = `Bearer ${PAPERCLIP_OPS_FIRESTORE_RELAY_SECRET}`;
    if (req.get("authorization") !== expected) {
      return res.status(401).json({ error: "Paperclip Firestore relay authorization failed." });
    }
  }

  try {
    const response = await fetch(PAPERCLIP_OPS_FIRESTORE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(5000),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({
        error: "Paperclip webhook relay failed.",
        upstreamStatus: response.status,
        upstreamBody: text.slice(0, 500),
      });
    }

    return res.status(200).json({
      relayed: true,
      upstreamStatus: response.status,
      upstreamBody: text ? text.slice(0, 500) : null,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Paperclip webhook relay failed.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
