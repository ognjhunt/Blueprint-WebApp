// Read-only production Firestore helper for the audit. Aggregates only.
//
// Firestore refuses the cloud-platform.read-only scope (HTTP 403, tried
// 2026-11-22), so the token uses the datastore scope. The read-only guarantee
// is this file: it calls only two read endpoints, documents:runAggregationQuery
// (counts) and documents:runQuery with a field mask limited to the non-personal
// fields named by the caller, and it has no write call. It never prints a
// document: callers get counts, timestamps and state strings to aggregate.
// Only the orchestrator runs it; audit agents are barred from the credential.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/Blueprint-WebApp/package.json');
const { JWT } = require('google-auth-library');

const READ_ONLY_SCOPE = 'https://www.googleapis.com/auth/datastore';

let cached;
export async function client() {
  if (cached) return cached;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  const account = JSON.parse(raw);
  const jwt = new JWT({ email: account.client_email, key: account.private_key, scopes: [READ_ONLY_SCOPE] });
  const { token } = await jwt.getAccessToken();
  cached = {
    token,
    base: `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents`,
  };
  return cached;
}

async function post(path, body) {
  const { token, base } = await client();
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function whereClause(filters) {
  if (!filters || filters.length === 0) return undefined;
  const parts = filters.map(([field, op, value]) => ({
    fieldFilter: { field: { fieldPath: field }, op, value },
  }));
  return parts.length === 1 ? parts[0] : { compositeFilter: { op: 'AND', filters: parts } };
}

/** Count documents. filters: [[fieldPath, 'EQUAL' | ..., {stringValue|booleanValue|...}], ...] */
export async function count(collection, filters = [], { allDescendants = false } = {}) {
  const structuredQuery = { from: [{ collectionId: collection, allDescendants }] };
  const where = whereClause(filters);
  if (where) structuredQuery.where = where;
  const result = await post(':runAggregationQuery', {
    structuredAggregationQuery: { structuredQuery, aggregations: [{ alias: 'n', count: {} }] },
  });
  return Number(result[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
}

/** Read only the named fields of a collection. Callers must pass non-personal fields. */
export async function selectFields(collection, fields, { filters = [], limit = 2000, allDescendants = false } = {}) {
  const structuredQuery = {
    from: [{ collectionId: collection, allDescendants }],
    select: { fields: fields.map((fieldPath) => ({ fieldPath })) },
    limit,
  };
  const where = whereClause(filters);
  if (where) structuredQuery.where = where;
  const rows = await post(':runQuery', { structuredQuery });
  return rows.filter((row) => row.document).map((row) => row.document.fields ?? {});
}

export function plain(value) {
  if (value == null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) {
    const out = {};
    for (const [key, inner] of Object.entries(value.mapValue.fields ?? {})) out[key] = plain(inner);
    return out;
  }
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(plain);
  return null;
}
