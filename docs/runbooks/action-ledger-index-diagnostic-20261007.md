# Diagnose the live read-only index preflight

The parent operator verified deployment `ec044fac5fed3baf85be0d982a37473e9d1ae137`
and the exact PR 914 index manifest. Plan succeeded. The SDK's first ListIndexes
GET failed with API code 3, INVALID_ARGUMENT. This is not an observed IAM denial.
No index create, task resume, model retry or send was attempted.

Preserve original worker receipt
`/tmp/blueprint-action-ledger-index-g1Gtmj/receipts.jsonl`, 808 bytes, SHA-256
`43debbd20d2e3821e6ce14552aaf775f4b1d43c79e778e3fe7dca0751d652ccd`.
The parent also has a retained copy; company storage archival remains a
separate verified operation, not an assumption about /tmp durability.

## Narrow diagnostic

Use only the existing, authenticated Render worker Shell in its application
directory `/opt/render/project/src`. Materialize the newly reviewed diagnostic
source into a fresh private /tmp directory and verify the handoff's hash.
Supply the existing original operator path; its bytes must still match
`5281c83cbffc493d38c078c8beeb82c7e534333a3029fed38d8960e0d7e16f35`.
The original operator source has not changed.

```bash
node <verified-diagnostic-path> <verified-original-operator-path> diagnose
```

This command makes one SDK ListIndexes GET of the same fixed parent with
pageSize 100, no filter, no autopagination/retries and a 10-second timeout.
It retains bounded, redacted `message` and whitelisted field violations from
decoded SDK `statusDetails` or direct REST `details` rather than
only a generic unavailable code. Headers/config/credentials are never logged.
Known token/key/email values, bearer strings, JWTs, long encoded values and
control characters are removed. Error detail is diagnostic evidence, not an
instruction or permission to change the action scope.

Only after code 3, it compares one documented direct JSON GET of the **same**
project/default database/action_ledger parent, pageSize 100 and the **same**
existing Firebase Admin token, without the SDK's generated enum-encoding
option. It does not switch transport after an IAM denial or change identity,
scopes, credentials or project. Direct REST and archive responses are bounded at
64 KiB. The SDK decoder buffers its response before sanitization; its first-page
request is bounded by pageSize 100 and a 10-second timeout, without an independent
SDK response-byte cap. Retained error detail remains bounded. There is no
index mutation path. First-page success is never full-inventory/absence/READY
proof and cannot authorize creation or task continuation.

The installed SDK's intercepted request matches the documented parent/path,
pageSize and empty body. Its generated `$alt=json;enum-encoding=int` is a
comparison variable, not a confirmed cause of the live INVALID_ARGUMENT.
Use the actual redacted response to decide any repair. Do not guess IAM, retry
an unknown create or blindly modify parameters.

## Explicit company-evidence archival

Archival is a separately selected, specifically requested evidence write.
Diagnose does not upload. This copies only approved receipt schemas to a fixed
company bucket/prefix; it does not upload capture/video bytes or change ACL,
retention, credentials, permissions, data or indexes.

```bash
node <verified-diagnostic-path> <verified-original-operator-path> archive-original
node <verified-diagnostic-path> <verified-original-operator-path> archive-diagnostic <printed-diagnostic-receipt-path> <printed-sha256>
```

`archive-original` is bound to the exact path/hash above. `archive-diagnostic`
accepts only the diagnostic's private receipt-path pattern and the exact printed
SHA-256. Both verify receipt schema/digest and cap bytes at 64 KiB before upload.
Using the same existing Admin token, they make one media-upload request to
`blueprint-8c1ca.appspot.com`, object:

```text
operations/site-intake/20261007/action-ledger-index/receipts/<sha256>.jsonl
```

The upload has `ifGenerationMatch=0`: no overwrite/delete, no upload retry,
no access-control or retention change. On lost acknowledgement or an already
existing object, only independent readback follows. Success requires matching
bucket/object/size metadata, a pinned generation and retained content with the
original SHA-256. An accepted upload or parent/session copy alone is not verified
company custody. Retain source copies throughout. A denied upload/read is an
existing-access blocker, not authorization to grant new access.

Diagnostic/archive receipts are mode 0600 in fresh mode-0700 directories, schema
`blueprint.action_ledger_index_diagnostic_receipt.v1`. A 60-second process
deadline bounds token acquisition, RPCs, response reads and cleanup. The final
receipt path/hash supports portability/export; archive the diagnostic before
the next restart/deploy. The final archive receipt identifies the company URI,
generation and digest and can itself be retained by the existing operator.

After diagnosis, use only independently reviewed repair bytes and obtain exact
index READY proof before any saved-task continuation. No model generation,
paid-budget reset, broad queue restart or outreach is authorized by this command.
The separate task-assessment audit must not mutate these controls or branches.

References: [Firestore ListIndexes](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.indexes/list),
[create-only Cloud Storage upload precondition](https://cloud.google.com/storage/docs/json_api/v1/objects/insert),
[generation-pinned object readback](https://cloud.google.com/storage/docs/json_api/v1/objects/get).
