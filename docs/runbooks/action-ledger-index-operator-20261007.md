# Bounded action-ledger index operation

The qualification model completed for the October 7 intake, then the existing
action executor's quota query failed because its composite index was absent.
PR 914 versions that exact index. Web/worker deployment alone does not install
it. This operator command installs at most that one missing index; it does not
resume qualification, touch task documents, send messages, reset retries or
budgets, or delete/rebuild/update indexes.

Use the existing, connected Render worker's **Shell** page:
`https://dashboard.render.com/worker/srv-d9t8gg1t0dsc73am9q70/shell`.
Run in its existing application directory, `/opt/render/project/src`, after
the release owner coordinates the operation. Existing SSH also works if an
operator already has that access. No Mac, new SSH key, CLI installation,
ephemeral instance, job creation, new credentials or IAM changes are needed.
Dashboard support and the worker's service type/SSH address were checked; this
does not certify the connected browser session or the identity's live IAM.

The script is operator-only and is never loaded by a route or worker. Transfer
its reviewed bytes into `/tmp/action-ledger-index-operator.mjs` using the
parent coordinator's existing authorized operator transport, and verify its
SHA-256 against the exact source handoff. No remote unpinned download or
dependency install is part of this procedure. It resolves the already-installed
dependencies through the application directory's `package.json`.

```bash
cd /opt/render/project/src
node /tmp/action-ledger-index-operator.mjs plan
node /tmp/action-ledger-index-operator.mjs inspect
```

For the current corrected preflight, run only `plan` and `inspect`. An `ensure`
invocation is a separate parent-coordinated index write after complete absence,
current authorization and prior unknown-acknowledgement reconciliation; it is
not implied by the command sequence above.

`plan` is local and does not acquire a token or contact a provider. All modes
require the exact PR 914 manifest bytes, SHA-256
`91b3fcdc84a63fbd1c63de6d3f9d12f52f1bed0a9ddcde1d33d474f0e75e6647`.
Live modes require the existing worker ID and a valid Render deployment commit.
They use only that worker's existing `FIREBASE_SERVICE_ACCOUNT_JSON` identity;
missing/invalid bindings stop before a cloud request. No ADC fallback occurs.

The existing Firebase Admin `credential.cert(...).getAccessToken()` issues the
same scopes it already uses, including `cloud-platform`. The script passes that
token through the public Google Auth `OAuth2Client`/`GoogleAuth` APIs into the
installed Firestore `v1.FirestoreAdminClient`. No new scope, refresh identity,
service account, impersonation or permission is introduced. The real installed
SDK binding is covered by a network-free test. The index API accepts this
existing scope; live IAM remains authoritative.

The fixed resource is project `blueprint-8c1ca`, database `(default)`,
collection group `action_ledger`, **COLLECTION** query scope, fields `lane`,
`status`, `created_at`, `__name__`, all **ASCENDING**. The last field expands the
versioned manifest's existing default name ordering. A collection-group index,
wrong field order, descending name field or incompatible API scope does not
satisfy the target.

The parent-reported live sanitized SDK response had36same-project/defaultDB
resources,35from other collections and one from the exact action_ledger parent,
with no next page. Inventory now validates the fixed project/defaultDB prefix
and exact eight-segment collectionGroups/<collection>/indexes/<id> structure,
using the existing bounded opaque-segment character policy and rejecting dot,
dot-dot and wildcard collection markers. Valid other collections count toward
all inventory/page limits but their fields/state are never evaluated. Only the
unchanged exact action_ledger parent can enter target matching/getIndex. Foreign
projects/databases, malformed names and duplicate distinct exact targets still
refuse before absence/get/create; complete pagination remains mandatory.

The official [ListIndexes contract](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.indexes/list)
defines the request parent and indexes/nextPageToken response. The installed
SDK sends that parent and returns decoded response rows without an additional
client collection filter. The mixed-collection response is live provider
evidence, not a documented universal guarantee that listing ignores collection.
The official [Index schema](https://github.com/googleapis/googleapis/blob/master/google/firestore/admin/v1/index.proto)
defines collection identity in each full resource name. Selection therefore
uses each exact resource parent and required fields, then independent getIndex
READY. The36-row shape result alone proves no target field match/absence/READY.

`inspect` never creates. `ensure` first completes a bounded, explicitly
non-auto-paginated inventory, reuses a matching existing CREATING/READY index,
and makes at most one create request only after confirmed absence. All SDK
calls disable automatic retries and have a 10-second timeout. A five-minute
process deadline also bounds authentication/cleanup. Observation is limited
to 12 iterations; a pending index is a pending result, not success.

The October7 live diagnostic returned `Invalid page size. Only 0 is supported.`
from both the installed SDK and same-token direct REST request with pageSize100.
Corrected list requests omit the page-size override, using the installed SDK's
protobuf/default request rather than guessing another positive value. Direct
REST diagnostics likewise omit pageSize. Inventory still refuses a returned
page above100rows, more than2000total rows, more than20pages or repeated/invalid
page tokens. An over-limit result is incomplete inventory and cannot authorize
creation. No row/page/time cap, IAM, credential, transport or retry policy is
widened. Default request size does not impose a network-response byte cap on the
stock SDK decoder; result limits apply after decoding.

Before create, the CLI synchronously writes and fsyncs a private JSONL intent.
It then retains the operation name, operation progress and independently
fetched exact index metadata. **Only matching `getIndex` metadata with READY
produces `ready:true` and exit 0.** Exit 3 means absence/pending/not observed;
exit 2 means an error requiring diagnosis. No index deletion/update call exists.

On timeout, lost acknowledgement, process interruption, or ALREADY_EXISTS,
there is no automatic second create. Start recovery with `inspect` and the
retained receipt, then observe the same matching index until READY. Do not
blindly rerun ensure after unknown acknowledgement. A NEEDS_REPAIR index is
reported for diagnosis; this command will not delete or rebuild it.

Errors log only stable codes, API status, stage and the relevant permission
(`datastore.indexes.list/create/get` or `datastore.operations.get`). Credentials,
tokens, raw provider errors, document contents and unrelated index definitions
are never printed. A permission denial is a precise existing-IAM blocker, not
authorization to grant a role or configure a different identity.

Each invocation creates a mode-0700 directory under
`/tmp/blueprint-action-ledger-index-*` and a mode-0600 `receipts.jsonl`, schema
`blueprint.action_ledger_index_operator_receipt.v1`. Its final output includes
the portable JSONL path and SHA-256, source-script hash, manifest hash and
deployment commit. `/tmp` is transient: retain/export these bytes through the
parent's existing approved company-storage archive operator before restarting
or redeploying. A Library/session reference alone is not canonical custody.

After READY, separately verify Web and worker deployed commits, then inspect
the actual retained intake output and current consent/idempotency state before
resuming only missing permitted follow-through. This command does not provide
that continuation and does not rerun the already-completed paid model.

References: [Render shell support](https://render.com/docs/ssh),
[Firestore index API and accepted OAuth scopes](https://cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.indexes/create),
[Firestore index readiness and permissions](https://firebase.google.com/docs/firestore/query-data/indexing).
