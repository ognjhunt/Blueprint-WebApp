# Diagnose the live read-only index preflight

The parent operator verified deployment `ec044fac5fed3baf85be0d982a37473e9d1ae137`
and the exact PR 914 index manifest. Plan succeeded. The SDK's first ListIndexes
GET failed with API code 3, INVALID_ARGUMENT. This is not an observed IAM denial.
No index create, task resume, model retry or send was attempted.

The revised live diagnostic subsequently retained the exact message
`Invalid page size. Only 0 is supported.` from SDK code3 and direct REST
HTTP400/API400 with pageSize100, empty details in both cases. This establishes
the page-size failure, not an enum-encoding failure. Actual diagnostic receipt
SHA is `6be85795ed08d1bd1b6c28ca4a79c2fb079c34fdeb1dc30f28571ea93f3b7ead`.
The parent safely read the configured Render principal and established that it
matches the separate cloud create403 identity. Successful listing still does
not establish create permission; no IAM/credential change is authorized.

Preserve original worker receipt
`/tmp/blueprint-action-ledger-index-g1Gtmj/receipts.jsonl`, 808 bytes, SHA-256
`43debbd20d2e3821e6ce14552aaf775f4b1d43c79e778e3fe7dca0751d652ccd`.
The parent also has a retained copy; company storage archival remains a
separate verified operation, not an assumption about /tmp durability.
The parent now reports company archival of those original808bytes at generation
`1791405765606822`, in the fixed receipt namespace below. Root has not read the
live retained object. Preserve the source and both old reviewed code heads.

## Narrow diagnostic

Use only the existing, authenticated Render worker Shell in its application
directory `/opt/render/project/src`. Materialize the newly reviewed diagnostic
source into a fresh private /tmp directory and verify the handoff's hash.
Supply the corrected operator path; its bytes must match
`ba1e24ddef8e560114560cc938ec764815bcd57671f58ff9fe9c4ae11c48b096`.
Its list request still omits pageSize100. It admits only well-formed same-project/defaultDB
inventory while qualifying only the exact action_ledger parent. The historical operator bytes at SHA
`5281c83cbffc493d38c078c8beeb82c7e534333a3029fed38d8960e0d7e16f35`
remain preserved in the earlier exact Git head and packet.

```bash
node <verified-diagnostic-path> <verified-original-operator-path> diagnose
```

This command makes one SDK ListIndexes GET of the same fixed parent with
no pageSize override or filter, no autopagination/retries and a10-second timeout.
It retains bounded, redacted `message` and whitelisted field violations from
decoded SDK `statusDetails` or direct REST `details` rather than
only a generic unavailable code. Headers/config/credentials are never logged.
Known token/key/email values, bearer strings, JWTs, long encoded values and
control characters are removed. Error detail is diagnostic evidence, not an
instruction or permission to change the action scope.

Only after code 3, it compares one documented direct JSON GET of the **same**
project/default database/action_ledger parent, no pageSize override and the **same**
existing Firebase Admin token, without the SDK's generated enum-encoding
option. It does not switch transport after an IAM denial or change identity,
scopes, credentials or project. Direct REST and archive responses are bounded at
64 KiB. The SDK decoder buffers its response before sanitization; its first-page
request has a10-second timeout without an independent SDK response-byte cap.
Both SDK and REST results refuse more than100returned rows; this is a local
result bound rather than a requested server page size. Retained error detail
remains bounded. There is no
index mutation path. First-page success is never full-inventory/absence/READY
proof and cannot authorize creation or task continuation.

The installed SDK's intercepted request matches the documented parent/path,
empty body. The installed protobuf's omitted integer field uses its default0;
the live error supports removing the override. Its generated
`$alt=json;enum-encoding=int` remains unchanged and was not the observed cause.
Use the corrected read-only result for subsequent decisions. Do not guess IAM, retry
an unknown create or blindly modify parameters.

## Read-only resource-shape diagnosis

The corrected live inspect reached inventory but stopped at
`index_inventory_scope_invalid`, without absence/READY or an index write. The
parent then reported a sanitized same-parent SDK response with36valid resources
in the expected project/default database:35other collections and one exact
action_ledger parent, with no next page. Scope receipt SHA-256 is
`02879cc946659152e53db105e47c8d7abb8b7f15446cc6ea9ba985ed88e46db6`;
parent-reported archive generation is `1791408470519267`. Root has not read that
live object. This proves shape only, not required fields, absence or READY.
The corrected operator selects only the exact parent after bounded database
inventory validation. The diagnostic remains separately selected and read-only
in the same existing worker Shell:

```bash
node <verified-diagnostic-path> <verified-corrected-operator-path> diagnose-scope
```

It makes one fixed-parent SDK ListIndexes GET, default page size, no automatic
pagination/retry and a10-second timeout. It rejects invalid/over100-row pages.
It reports at most20distinct shape categories: value types, bounded lengths,
structural segment count, booleans for expected project/database/collection,
suffix validity and disallowed character classes, plus recognized queryScope
enums. It never prints resource IDs, foreign project/collection names, field
definitions, arbitrary SDK keys, page tokens or document/customer contents.
Additional shape rows are counted as omitted. Any next page remains unread;
this is diagnostic evidence and never full inventory, absence or READY proof.
There is no direct-REST fallback in this mode, even on API failure. Shape
diagnosis does not change the corrected operator's resource guard or execute it.
Project token categories distinguish a decimal number from the expected ID;
collection token categories distinguish the expected ID from a wildcard or
another ID. These are shape evidence only, never authorization to accept an
alias. API failures log only stable list stage/permission/code, no raw provider
error text or response rows.

## Explicit company-evidence archival

Archival is a separately selected, specifically requested evidence write.
Diagnose does not upload. This copies only approved receipt schemas to a fixed
company bucket/prefix; it does not upload capture/video bytes or change ACL,
retention, credentials, permissions, data or indexes.

```bash
node <verified-diagnostic-path> <verified-original-operator-path> archive-original
node <verified-diagnostic-path> <verified-original-operator-path> archive-diagnostic <printed-diagnostic-receipt-path> <printed-sha256>
node <verified-diagnostic-path> <verified-corrected-operator-path> archive-operator <original-operator-receipt-path> <printed-sha256>
```

`archive-original` is bound to the exact path/hash above. `archive-diagnostic`
accepts only the diagnostic's private receipt-path pattern and the exact printed
SHA-256. Both verify receipt schema/digest and cap bytes at 64 KiB before upload.
`archive-operator` supports the original operator receipt location directly,
`/tmp/blueprint-action-ledger-index-<private-id>/receipts.jsonl`. Do not relabel,
move or copy it into the diagnostic namespace. It reads at most64KiB from an
owner-private regular file in an owner-private directory, rejects symlinks,
checks the caller's exact digest and exclusively the operator receipt schema,
and binds the start row to the reviewed corrected operator source, fixed
project/parent/worker/manifest and that original receipt path. Unknown row keys,
mixed schemas and a second start row are refused. Source validation happens
before token acquisition/upload. Interrupted journals remain valid evidence;
archival does not infer completion or READY. No arbitrary path is accepted.
The existing archive-original and archive-diagnostic modes retain their scope.
The leaf is opened nonblocking before file-type inspection so a private FIFO
cannot hang before authentication/the watchdog. A real FIFO actual-CLI child
regression has its own1.5-second deadline and supplies no provider credentials.
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
