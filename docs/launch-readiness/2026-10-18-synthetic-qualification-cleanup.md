# Exact synthetic qualification cleanup plan

Status: **completed after explicit human approval** under the root agent guide's
existing deletion-approval control. The exact live document matched the retained
backup and pinned timestamps. Its conditional deletion returned HTTP 200, and
the exact follow-up GET returned HTTP 404 `NOT_FOUND`. The backup is preserved.
No other document or collection was deleted. The redacted action and readback
are retained in
[`cleanup.json`](evidence/2026-10-18-beta-repairs/cleanup.json).

During a local concurrent publication test, a Vitest dynamic-import mock race
allowed one call to initialize the configured Firebase Admin SDK. A read-only
Firestore REST lookup confirmed one synthetic receipt was created. The helper now
requires an explicitly supplied database and has no runtime Firebase import or
fallback. Publication tests supply the in-memory store directly; subsequent tests
run with all six ADC context variables removed.

## Exact retained identity

- Project: `blueprint-8c1ca`; database: `(default)`.
- Collection: `siteTaskQualifications`.
- Document ID: `613edf96606bbd7f748e6e20c1ea60d4b26d2517da0be25763889cb3f1de2ff4`.
- Full name: `projects/blueprint-8c1ca/databases/(default)/documents/siteTaskQualifications/613edf96606bbd7f748e6e20c1ea60d4b26d2517da0be25763889cb3f1de2ff4`.
- Live `createTime` and `updateTime`: `2026-10-18T14:02:59.219005Z`.
- `publishedAtIso`: `2026-10-18T14:02:58.206Z`.
- Receipt schema: `blueprint.site_task_simulation_qualification.v1`.
- Receipt digest: `sha256:613edf96606bbd7f748e6e20c1ea60d4b26d2517da0be25763889cb3f1de2ff4`.
- Exact synthetic binding: scene request `job_scoring`, capture `capture-scoring`,
  site `site-scoring`, task `task-scoring`.
- Reviewer: `synthetic-independent-reviewer`.
- All eight source URIs use `gs://synthetic-test-only/`, with filenames
  `capture.json`, `scene.json`, `testbed.json`, `task_spec.json`,
  `success_contract.json`, `robot_model.json`, `measurement.json`, and
  `simulator_measurement.json`.

The REST response was decoded and its complete `receipt` compared equal to
`qualifiedReceipt()` from
`server/tests/helpers/siteTaskQualificationReceipt.ts`. The content is a
synthetic test fixture, not a real capture, measured qualification, or execution.

## Backup and recovery

The original REST response, including Firestore typed fields and create/update
timestamps, is retained locally at:

`/tmp/blueprint-beta-audit-20261018/synthetic-qualification-613edf96606bbd7f748e6e20c1ea60d4b26d2517da0be25763889cb3f1de2ff4.raw.json`

Its raw UTF-8 JSON SHA-256 is:

`a34c625995acb60eba9cd6275a78b144a040ac474a7a559792a977c3063a94c6`

The backup contains the synthetic receipt and publication timestamp, no bearer
token or credential. It is a portable Firestore REST document response; its
`fields` object is sufficient to reconstruct the same document content if an
authorized recovery is necessary. The synthetic fixture is also retained in
Git source. Preserve this backup through cleanup and readback.

## Approved-action procedure

Only after explicit approval for this exact document:

1. Re-read this exact document and compare its `createTime`, `updateTime`, receipt
   digest, synthetic identities, and decoded fields with the backup. Stop on any
   difference. Do not query or delete the surrounding collection.
2. Send exactly one authenticated REST `DELETE` using
   `currentDocument.updateTime=2026-10-18T14:02:59.219005Z` as the precondition.
3. Re-read the exact document and require HTTP `404 NOT_FOUND`; retain the delete
   response and this readback. A changed-document precondition failure requires
   a new inspection and must not be bypassed.

Exact approved REST action (executed with the precondition below):

```text
DELETE https://firestore.googleapis.com/v1/projects/blueprint-8c1ca/databases/(default)/documents/siteTaskQualifications/613edf96606bbd7f748e6e20c1ea60d4b26d2517da0be25763889cb3f1de2ff4?currentDocument.updateTime=2026-10-18T14%3A02%3A59.219005Z
Authorization: Bearer <existing authorized access token; never retain in evidence>
```

The original plan authorized no action by itself. Execution followed the later
explicit human approval and included no rule, index, collection, other-document,
provider, send, or execution mutation.

A portable Git copy of the exact synthetic REST backup is retained at
`docs/launch-readiness/evidence/2026-10-18-beta-repairs/synthetic-qualification-backup.json`,
with the same SHA-256 shown above. The original local backup is also preserved.
