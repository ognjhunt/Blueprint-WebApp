/** Decode only the masked Firestore source fields needed for original ownership. */
import { strictBoundedProofJson } from "./strictBoundedProofJson";

export const OWNER_FIRESTORE_FIELD_PATHS = [
  "account_owner_uid", "claimed_at_iso", "request.buyerType", "request.capture_mode",
  "request.consent_attestation.granted", "request.consent_attestation.statement_version",
  "request.consent_attestation.recorded_at_iso", "consent_revoked", "consent_revoked_at",
  "consent_status", "future_processing_allowed", "request.consent_revoked",
  "request.consent_revoked_at", "request.consent_status", "request.future_processing_allowed",
  "capture_rights.consent_revoked", "capture_rights.consent_revoked_at",
  "capture_rights.consent_status", "capture_rights.future_processing_allowed",
] as const;

type Fields = Record<string, any>;

function fieldAt(fields: Fields, path: string): unknown {
  let current: Fields = fields;
  for (const [index, segment] of path.split(".").entries()) {
    const entry = current?.[segment];
    if (!entry || typeof entry !== "object") return undefined;
    if (index === path.split(".").length - 1) {
      const keys = Object.keys(entry);
      if (keys.length !== 1) throw new Error("owner_firestore_value_invalid");
      if (keys[0] === "stringValue" && typeof entry.stringValue === "string") return entry.stringValue;
      if (keys[0] === "booleanValue" && typeof entry.booleanValue === "boolean") return entry.booleanValue;
      if (keys[0] === "nullValue" && entry.nullValue === "NULL_VALUE") return null;
      throw new Error("owner_firestore_value_invalid");
    }
    current = entry.mapValue?.fields;
    if (!current || typeof current !== "object" || Array.isArray(current))
      throw new Error("owner_firestore_value_invalid");
  }
  return undefined;
}

export function decodeMaskedOwnerDocument(bytes: Buffer, exactName: string) {
  const parsed = strictBoundedProofJson(bytes, 65_536) as Record<string, any>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
      || parsed.name !== exactName || !parsed.fields || typeof parsed.fields !== "object")
    throw new Error("owner_firestore_document_invalid");
  const allowedTop = new Set(["name", "fields", "createTime", "updateTime"]);
  if (Object.keys(parsed).some((key) => !allowedTop.has(key))) throw new Error("owner_firestore_document_invalid");
  const stamp = parsed.updateTime;
  if (typeof stamp !== "string") throw new Error("owner_firestore_timestamp_invalid");
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(stamp);
  if (!match) throw new Error("owner_firestore_timestamp_invalid");
  const epochMs = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== `${match[1]}.000Z`)
    throw new Error("owner_firestore_timestamp_invalid");
  const updateTime = { seconds: epochMs / 1000, nanoseconds: Number((match[2] ?? "").padEnd(9, "0")) };
  if (!Number.isSafeInteger(updateTime.seconds)) throw new Error("owner_firestore_timestamp_invalid");
  const permittedRoots = new Set(OWNER_FIRESTORE_FIELD_PATHS.map((path) => path.split(".")[0]));
  if (Object.keys(parsed.fields).some((key) => !permittedRoots.has(key)))
    throw new Error("owner_firestore_field_invalid");
  const allowed = new Set<string>(OWNER_FIRESTORE_FIELD_PATHS);
  const ancestors = new Set<string>();
  for (const path of allowed) {
    const parts = path.split(".");
    for (let index = 1; index < parts.length; index++) ancestors.add(parts.slice(0, index).join("."));
  }
  const validateFields = (fields: Fields, prefix = "") => {
    for (const [key, entry] of Object.entries(fields)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (allowed.has(path)) { fieldAt(parsed.fields, path); continue; }
      if (!ancestors.has(path) || !entry || typeof entry !== "object"
          || Object.keys(entry).length !== 1 || !entry.mapValue?.fields
          || typeof entry.mapValue.fields !== "object" || Array.isArray(entry.mapValue.fields))
        throw new Error("owner_firestore_field_invalid");
      validateFields(entry.mapValue.fields, path);
    }
  };
  validateFields(parsed.fields);
  const data: Record<string, any> = Object.create(null);
  for (const path of OWNER_FIRESTORE_FIELD_PATHS) {
    const value = fieldAt(parsed.fields, path);
    if (value === undefined) continue;
    const segments = path.split(".");
    let cursor = data;
    for (const segment of segments.slice(0, -1)) cursor = cursor[segment] ??= Object.create(null);
    cursor[segments[segments.length - 1]] = value;
  }
  return { data, updateTime };
}
