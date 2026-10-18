# Scoped Firestore index repair — review only

This is a dry-run plan, not a cloud mutation. The installed gcloud CLI has no dry-run flag for composite-index create; the dry-run here compared the exact source definitions with the authenticated live index inventory and generated commands without calling create.

Scope: project `blueprint-8c1ca`, database `(default)`, exactly two collection-scoped indexes; create-only. The source already defines both. The current dry-run found neither live. Keep all other 37 live indexes intact.

| Collection | Fields in order | Observed failure | Affected supported code |
|---|---|---|---|
| evaluationRuns | teamId ASC, settlementDueAtMs ASC | HTTP400 FAILED_PRECONDITION missing index | server/utils/agentEvalRuns.ts:335-351; inline team hold reconciliation |
| inboundRequests | status ASC, createdAt DESC | HTTP400 FAILED_PRECONDITION missing index | server/routes/admin-leads.ts:2970-2994; status-filtered CSV export |

The global settlement sweep uses a single-field index and was not found broken. New-job alert-recipient, fanout-source and pending Pipeline-dispatch query probes succeeded. A historical 22-index diff is not this deployment scope.

After exact cloud-mutation approval, execute only the missing definitions:

```bash
gcloud firestore indexes composite create \
  --project=blueprint-8c1ca --database='(default)' \
  --collection-group=evaluationRuns --query-scope=collection \
  --field-config=field-path=teamId,order=ascending \
  --field-config=field-path=settlementDueAtMs,order=ascending \
  --async --format=json
```

```bash
gcloud firestore indexes composite create \
  --project=blueprint-8c1ca --database='(default)' \
  --collection-group=inboundRequests --query-scope=collection \
  --field-config=field-path=status,order=ascending \
  --field-config=field-path=createdAt,order=descending \
  --async --format=json
```

Read live inventory immediately before execution; if an exact index already exists, reuse/wait for it rather than creating another. Retain each operation ID and require index state READY. Re-run only the corresponding read-only runQuery shapes from `release-evidence-aggregate.json`; require HTTP200 and no missing-index error. Do not invoke application reconciliation routes as a probe, because those can mutate run settlement. Record source hash, both final index definitions/states, and query success evidence in the existing release record.

If creation fails or indexing reports NEEDS_REPAIR, retain the failure and diagnose; do not remove unrelated indexes, widen the deployment, redeploy rules, rerun a broad Firebase deployment, or silently create a different order. No automatic rollback deletion is included: creating a missing index is additive, and deleting it reintroduces the proven query failure.

The [JSON companion](evidence/2026-10-18-beta-repairs/two-index-repair-plan.json) contains the exact source SHA256, current source commit, observation time, live matches, and argument arrays. No create command was executed.
