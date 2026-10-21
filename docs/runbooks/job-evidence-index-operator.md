# Job evidence index release

The job workspace reads `taskEvaluationPolicyRuns` with
`job_evidence_binding.job_id == jobId`, ordered by `created_at_iso DESC`.
The required collection-scoped composite is in `firestore.indexes.json`.
Application deployment does not install it. Release this exact index before
activating the Pipeline job-evidence producer.

`scripts/job-evidence-index-operator.mjs` adapts the frozen action-ledger
operator to this one index. It accepts only project `blueprint-8c1ca`, database
`(default)`, COLLECTION scope, job ID ASC, creation time DESC and the implicit
document name DESC. Its manifest is pinned to SHA-256
`c55a28963172d3a04b764f561c09ae6728fe89106b553648c0990aa243da6ee8`.
The fixture preserves those reviewed bytes when future indexes are added.

Use the existing authorized Render worker runtime and its existing Firebase
Admin binding, following the transport in
[the existing operator runbook](action-ledger-index-operator-20261007.md).
Transfer the reviewed script and exact manifest bytes through the authorized
operator transport, verify their SHA-256, and run from `/opt/render/project/src`:

```bash
node /tmp/job-evidence-index-operator.mjs plan
node /tmp/job-evidence-index-operator.mjs inspect
```

`inspect` only reads index metadata. If the complete inventory establishes
absence and the coordinated release authorizes the additive index mutation,
run the same script once with `ensure`. It records intent before its single
create call, reuses an existing CREATING/READY index, and requires independent
exact `getIndex` READY readback. Retain the operation ID and the fsynced JSONL
receipt in the existing company release evidence store. A pending build or an
unknown acknowledgement remains pending; resume with `inspect`, never a blind
second `ensure`. No delete, rebuild, IAM change, document mutation, provider
execution, send, rules deployment or broad Firebase deployment is included.

If the existing runtime binding or operator transport is unavailable, retain
the reviewed script and pending release state. Do not move credentials out of
their runtime, create another identity, or claim the index is installed from
source or application CI alone.
