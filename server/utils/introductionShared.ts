/**
 * The two sides' details on an introduction (`inboundRequests/{id}/introductions/{companyId}.siteShared` and
 * `.companyShared`) are encrypted at rest, field by field, as the job record's personal fields are. This covers the
 * introduction record only: the two introduction emails hold the details in plain text in their outbox rows until each
 * is sent or cancelled, when the same write clears `subject`, `body` and `replyTo` (`captureOutbox.ts`).
 * (`field-encryption.ts`). They are decrypted only where an introduction is shown or emailed: the site's page after an
 * introduction, the two introduction emails (written from the plain values in the same transaction), the outcome
 * questions and the admin console. A document written before this (plain strings) still reads.
 */
import { decryptFieldValue, encryptFieldValue } from "./field-encryption";

export type SharedDetails = Record<string, string | null | undefined>;

/** Encrypt every non-empty string field; empty and absent fields are left out. */
export async function sealShared(details: SharedDetails): Promise<Record<string, unknown>> {
  const sealed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string" && value.trim()) sealed[key] = await encryptFieldValue(value);
  }
  return sealed;
}

/** Decrypt every field; a field that does not decrypt is left out (never shown as ciphertext). */
export async function openShared(stored: unknown): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return out;
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    try {
      const text = String(await decryptFieldValue(value as never) ?? "").trim();
      if (text) out[key] = text;
    } catch { /* left out */ }
  }
  return out;
}
