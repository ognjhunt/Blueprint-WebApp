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

Candidate presentation acceptance requires exact before/after SHA, health/ready 200, ordinary form visibility, all four restored inputs, inferred US country after reload, unselected recording consent and truthful seven-day **recovery eligibility** copy. The coordinator owns release and must append the actual candidate execution receipt after deployment. The candidate execution and deployment receipts are recorded below.

This smoke's claim ceiling is deployed identity, public health/readiness and non-destructive browser draft reload only. It cannot prove acknowledged upload durability, authorization on private returns, backend job creation, worker restart, assessment justification, email delivery or abrupt-crash disk durability. Orderly browser closure with controlled storage restoration and a SIGKILL crash are distinct evidence layers. The normal emailed private-link path is an implementation recovery route; this no-submit probe does not establish its delivery.

The source and this sanitized decision record are portable Blueprint-owned Git artifacts; regenerate local JSON/PNG from the committed command. No raw trace is transferred to a new service or used as the only canonical business record.

## Candidate execution after protected release

The same frozen GET/HEAD-only script passed at `2026-10-08T06:48:57.704Z`–`2026-10-08T06:48:59.811Z` against exact merged `d8988ab3f8bcfa16527d0a77ba168f1cde19f63c`. Allfour synthetic ordinary-form fields survived reload, inferred US country remained visible, recording consent stayed unchecked and the seven-day eligibility copy was present. Serving identity matched before/after; health and readiness returned 200. The baseline's four empty reload values are retained above; this is an observed deployed before/after for the local draft-return path.

Required main CI37738528838 and the existing CI-gated paired deployment37739286731 succeeded. Independent Render reads found web receipt `dep-db3jnn2j9qps73fupnrg` live at 06:47:44UTC and worker receipt `dep-db3jnnegekts73f31qqg` live at 06:47:31UTC, both exact d898. No competing deployment was started.

The isolated browser blocked2 automatic mutation requests and2 external requests; attempted intake mutations were0. No submit, private return, uploaded video, provider dispatch or email was exercised. Its own synthetic context was cleaned and closed. The claim ceiling remains local draft return plus deployed identity/health, not the final customer journey.

- Private result `output/reliability-program/deployed-candidate-d898/result.json`, SHA256 `89ca675c9e3198fe4721f237dd7f74de0fc9742c4cb258eeb996f0d07dac5417`.
- Synthetic public-page screenshot SHA256 `6a59b9bbd4aef3cb9f898c7a217c0e0add22bbe0ea848c85539dc07df88a9294`.
- Executed script unchanged SHA256 `306b01bc00db0c0f4f383b68bc16c62d08010428919c0829611d1cd3e656803b`; supplemental checkout `bc9cf2a852be32f8e7c37d8cda039df8fea74c50`, production runtime byte-identical to mergedd898.

Replay: `env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" node node_modules/tsx/dist/cli.mjs scripts/reliability/verify-deployed.ts --expected-sha d8988ab3f8bcfa16527d0a77ba168f1cde19f63c --mode candidate --output output/reliability-program/deployed-candidate-replay`.

## Scoped stale-source release identity and regression smoke

PR941 merged at `eda83741bd06026f9ad4e9e8fa16417bdc1d432c`; main CI37741000664 and paired deployment37741434386 passed. Independent Render reads found both web `dep-db3k2360tbcc73fs114g` and worker `dep-db3k230m7kps73f0pfqg` LIVE at that exact SHA. The unchanged no-submit draft-return smoke passed again from `2026-10-08T07:10:41.144Z` to `2026-10-08T07:10:43.342Z` with before/after identity, health/readiness200, four retainedfields and consentunchecked. Attempted intake mutations0; no uploaded evidence/provider/notification run. This is another attempt of the same productionpresentationcase, no added independentjourney.

Protected result SHA256 `c2b2aee36f4c2ae0fbf3cc1c8ea154374d4aaef1a95fdbac2f71845b90107847`; screenshot SHA256 `6a59b9bbd4aef3cb9f898c7a217c0e0add22bbe0ea848c85539dc07df88a9294`. Guard behavior is supported by exact-source minimized offline/SDK replay and deployment identity; the production advisory-provider workflow was not dispatched by this smoke.
