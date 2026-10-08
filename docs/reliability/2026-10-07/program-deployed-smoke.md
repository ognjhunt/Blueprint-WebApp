# Non-destructive deployed UI smoke

The production baseline was observed on `https://tryblueprint.io` from `2026-10-08T04:49:53.923Z` to `2026-10-08T04:49:57.534Z` (October 7, America/Chicago). Serving SHA before and after the browser check was `1b8d810ec117b93fe52fd323be052ddafa7070db`. The public `/version.json`, `/health`, and canonical `/health/ready` endpoints returned HTTP 200; health was healthy and readiness was ready. These public probes do not establish an assessment or worker result.

Through the ordinary anonymous `/contact/site-operator` UI, the probe entered a synthetic task, US location, `.test` email and company **without selecting Start**. On reload all four inputs were empty and inferred country disappeared. Thus `draft_restored=false`, `candidate_presentation_passed=false`, and the retained result says `presentation_failed`. This is fresh production before-fix evidence of the missing draft return path, not merely a source inspection or unit test. Recording consent remained unchecked. The candidate recovery-eligibility copy was absent, as expected on the baseline.

## Safety and exact artifact identity

The script created an isolated Chromium context with service workers blocked and aborted every non-GET/HEAD request and every request outside the approved production origin. `1` automatic mutation request and `2` external requests were blocked; attempted intake mutations were `0`. There was no submit/recover click, account login, upload, consequential record mutation, model/provider dispatch or notification send by this probe. Only synthetic local draft state was touched, then this context's local/session storage was cleared and the context closed. No customer fixture, identity, credential, private link or raw customer footage was used.

Sanitized JSON and a public-page/synthetic-only screenshot are retained locally in ignored `output/reliability-program/deployed-baseline-final/`; the JSON and PNG have private file permissions. The result retains public SHA/status metadata, bounded checks/timings and response hashes, never raw health diagnostics or request bodies.

- Result JSON SHA-256: `bfe531bb012e8da3ca12b02b5808434d4c24b73d5e2b1840ebbd00cef887aa1c`.
- Screenshot SHA-256: `8b6177b2e191197f547e8edf53e43c31d4ca8fa618ebd355295cfd8f8d2cd703`.
- Executed script SHA-256: `306b01bc00db0c0f4f383b68bc16c62d08010428919c0829611d1cd3e656803b`.
- Source checkout at execution: `123db3aefccf141d8efe903c2cdb456bba7f33f1`. The new script was not yet committed; its exact file fingerprint above binds execution to the subsequently committed source.

The earlier read/local-draft attempt under `output/reliability-program/deployed-baseline/` also observed the same SHA and empty reload fields. It is another attempt of this one presentation case, not another unique customer journey. The final metadata adds blocked-intake accounting and private artifact permissions; it does not replace a previous failure with a passing result.

## Replay after an authorized release

Dependencies are the repository's existing `tsx` and Playwright packages and pinned Chromium. No provider key, production dotenv, Firebase login or secret is needed. With the exact expected serving SHA:

```bash
npx tsx scripts/reliability/verify-deployed.ts --expected-sha 1b8d810ec117b93fe52fd323be052ddafa7070db --mode baseline --output output/reliability-program/deployed-baseline
npx tsx scripts/reliability/verify-deployed.ts --expected-sha <exact-deployed-40-character-sha> --mode candidate --output output/reliability-program/deployed-candidate
```

An optional existing `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an installed browser. The production origin is fixed in source; the script does not accept arbitrary fault-injection destinations. It checks serving identity before and after interaction and stops the UI probe on mismatch. Baseline mode collects an expected presentation defect with an honest failed gate; its zero collector exit code is **not a passing candidate smoke**. Identity/readiness or incomplete-probe failures exit nonzero in both modes. Candidate mode also exits nonzero unless every presentation/identity check passes.

Candidate presentation acceptance requires exact before/after SHA, health/ready 200, ordinary form visibility, all four restored inputs, inferred US country after reload, unselected recording consent and truthful seven-day **recovery eligibility** copy. The coordinator owns release and must append the actual candidate execution receipt after deployment. No candidate deployment/verification is claimed here.

This smoke's claim ceiling is deployed identity, public health/readiness and non-destructive browser draft reload only. It cannot prove acknowledged upload durability, authorization on private returns, backend job creation, worker restart, assessment justification, email delivery or abrupt-crash disk durability. Orderly browser closure with controlled storage restoration and a SIGKILL crash are distinct evidence layers. The normal emailed private-link path is an implementation recovery route; this no-submit probe does not establish its delivery.

The source and this sanitized decision record are portable Blueprint-owned Git artifacts; regenerate local JSON/PNG from the committed command. No raw trace is transferred to a new service or used as the only canonical business record.
