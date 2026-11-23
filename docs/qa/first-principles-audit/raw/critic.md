# Completeness check

2026-11-22, done after the audit finished. I did not take part in the audit. The question here is what was not walked, measured or read, and whether any of it changes the answer.

Short answer: the core conclusions hold. Nothing that could be checked was refuted. Two things change the plan. First, a company that signs in today would still see no job. Second, December's money limit leaves room for about one or two jobs. Five sentences in the deliverables need rewording.

Rules kept: nothing paid, no real site's data, no writes, no email, public pages only on the live site. The door was used only for `status`.

## (a) Claims checked

| Claim | Where | Evidence | Verdict |
|---|---|---|---|
| No job sent to a company, no answer, no introduction, no billable events | summary.md "Where things stand"; journeys.md | firestore-collection-counts.json: companySends 0, introductions 0. firestore-second-pass.json: billableEvents 0, companyResponses 0, company_auto_send_sent 0 | Holds |
| 140 findings: 3 P0, 46 P1, 91 P2 | summary.md, findings.md:6 | Counted the rows of findings.md: P0 3, P1 46, P2 91 | Holds |
| Every P0 and P1 checked again, none refuted, 58 corrected | summary.md | findings.md:10-16: 80 checked, 21 confirmed, 58 corrected, 1 unverified | Holds. One P1, A-05, is still unverified, and the summary does not say so |
| One company approved; it never accepted the Terms while signed in | summary.md item 1 | firestore-second-pass.json robotTeamAccess: n 1, approved 1, with_signed_in_terms_acceptance 0 | Holds |
| Only 2 job records carry the sharing statement, both non-US | summary.md item 1, D-17 | firestore-funnel.json: statement 2026-11-12.v4 on 2 non-test jobs, and the non-US subset has the same 2 | Holds, but says too little. `teamJobAccess.ts:249` closes every job without that statement (`older_statement`). So no existing US job can be shown even after the company signs in |
| Three site jobs started since 2026-11-12 | summary.md item 1 | firestore-second-pass.json created_since_2026_11_12: 3 | Holds |
| The room is ready in about 6 hours | summary.md item 2 | pipeline-timing.md:17,80: 5.9 h on one job, 26.7 h on another, not reached after 70 h on the third | Says too much. 6 hours is the best of three |
| The sound-free video in about 1 hour | summary.md item 2 | pipeline-timing.md:16,79: 55 and 65 min on 2 test jobs. The real job's clip was refused | Says a little too much. Test jobs only |
| The only real job spent 6.3 of its 7 days there | summary.md item 2 | pipeline-timing.md:8,65: that job is Blueprint's own capture (`blueprint_owned_capture`) | Says too much. "Real job" reads as a customer's job |
| Each launch kept an $18 hold; the job hit its cap having spent $8.46 | summary.md item 2, C-03 | C-03 evidence: 7 rows retained 18.0, metered 8.456467 | Holds |
| Four fifths of November's spend is tied to no job | summary.md item 5, D-04 | D-04: 59.75 of 296.58 metered to jobs, 20%. Door at 20:13Z: counted 297.16, still about 80% unattributed | Holds |
| Money guard red on every run since 2026-11-13 | summary.md item 5, D-01 | D-01 failure_count 4850. Door at 20:14Z: spend_guard blocked, runpod_inventory_query_failed | Holds |
| 207 failed units, 206 of them old experiments | summary.md item 5, IP-03 | Door at 15:01Z: 207. Door at 20:14Z: 206, because the guard sits between failures | Holds, dated |
| About 80,700 Pipeline lines and 21,000 WebApp lines of the dropped trial's code | summary.md deletion 1 | delete-list.md:16-20 counts the whole deletion. The WebApp's trial code is about 10,500 lines (IW-02, delete-list.md:47). About 9,000 lines are files that never run (delete-list.md:49) | Says too much. The figures are the whole deletion, not the trial alone |
| November had 153 deploys | owner-questions.md Q20, journeys.md | C-02 evidence: 153 receipts, 146 deployed 2026-11-01 to 11-20 | Differs: 146 deploys, 153 receipts |
| The 59 P2 findings were not checked a second time | README.md, summary.md | findings.md:15-16: 59 of the 91 P2 findings. The other 32 were checked and lowered | Says it unclearly. It reads as if there were 59 P2 findings |

## (b) Not covered, and whether it matters

| Gap | Why it could matter | Status | What would close it |
|---|---|---|---|
| December's account money limit | It decides how many jobs a month can be prepared, and so whether the loop can run at all | **Closed here: new finding K-01 (P1)** | Owner decision on the December limit |
| Which existing jobs a company could see after it signs in | Wave 0's first step assumes that signing in shows something | **Closed here: none could** (correction below; the fact is already in D-17) | One US job on the current statement |
| Privacy promise: sound removed before any AI provider | A privacy promise | **Closed here: holds** for the WebApp's Gemini path | Nothing further |
| The 14, 45 and 90 day answer pages | A dead end would break the loop's last step | **Closed here: works.** Token link, no sign-in, no CSRF needed, 21 tests pass | Nothing further |
| /partners and /beta on the live site at 390 px | Public claims and phone layout | **Closed here:** no sideways scroll; the copy matches the code apart from A-15, which is already found | Nothing further |
| The WebApp and the Pipeline disagreeing about when a job ends | A job could be ended on one side and still spend on the other | **Closed here:** both read the same grant window (`websiteJobWindowSweep.ts:1-10`) | Nothing further |
| The 14-day deletion of temporary files (Privacy Policy) | A privacy promise | Partly closed: the bucket rule is in the repository. Open: whether it is applied in GCS, and host scratch files | Read the live bucket's lifecycle; read the host's scratch sweep |
| A second or tenth job at the same time | Throughput when outreach works | Partly closed: only per-capture locks exist; money binds first (K-01) | One load measurement on the host, after K-01 is decided |
| Sign-in, password reset, site claim, /settings | No P0 or P1 rests on them; a site needs no account | Open | One local walk with fake auth |
| Emails as sent (HTML) | The introduction email is the product's hand-off | Open | Render each outbox kind from fixtures with no send |
| The Terms read in full against the product | A legal promise the product might not keep | Open | One read of `Terms.tsx` against the loop |
| The Pipeline's upload Cloud Function (`functions/storage_trigger.py`) | The first hand-off; a silent drop would strand jobs | Open; only mapped | Read it together with extractFrames from the third repository |
| The start form on a phone for screen reader and zoom users | Some sites could not start a job | Open | One axe run at 390 px locally |
| Deployed Firestore and Storage rules; Render and host values | Already listed by the audit | Open | Read-only firebase and Render reads by the owner |

## (c) Gaps closed here

1. **December money limit.** I read `config/account_monthly_spend_limit.v1.json`, which is the same at the running release `cbff06b`. The limit is USD 300 a month, with USD 400 for November only. The admission code counts every provider's whole bill (`account_monthly_spend.py:29-40,412`). From `operator_door.py status` at 20:13Z: spend with no job behind it is DigitalOcean 63.43, Google Cloud 61.53, OpenAI 72.00, plus 6.05 of the WebApp's own runs. That is USD 203 over 21.8 days, or USD 9.29 a day: about USD 288 for a 31-day December. That leaves about USD 12 for all of December's jobs. One job used USD 8.46. Once the limit is reached, every paid step is refused until January. A job then waits until its window ends held, and because of G-02 it never reaches a company. No existing finding, plan row or owner question covers this. It is new finding **K-01**.
2. **What a company would see after signing in.** `teamJobAccess.ts:249` closes any job whose recording statement is not `2026-11-12.v4` or later. `RECORDING_VERSIONS_THAT_SHARE` is defined at `teamJobAccess.ts:185`. In production, 28 non-test jobs are on v1, 3 on v2, and only 2 on v4, both non-US. A non-US job cannot get video, so it is not listed. So after wave 0 step O1, the company still sees zero jobs. D-17 gives the counts. The summary and plan do not draw this conclusion.
3. **Sound before Gemini.** `server/agents/adapters/gemini-video.ts:22-29,94-100`: only a checked audio-free copy can be uploaded. This holds.
4. **Outcome answer pages.** `server/routes/job-outcomes.ts:4-64` and `server/routes.ts:91-93`. Ran `npx vitest run server/tests/job-outcomes.test.ts` with Firebase credentials blanked: 21 passed.
5. **Live public pages.** Loaded https://tryblueprint.io/partners and /beta at 390 px with Playwright and read the text only, with no form touched. scrollWidth was 390 on both. The copy matches the code. /beta still says "We email the company your name, address and contact details", which A-15 already covers.
6. **End-of-window agreement.** `server/utils/websiteJobWindowSweep.ts:1-32`: the WebApp ends a job on the same grant window after which the Pipeline starts nothing. No disagreement was found.

## (d) Corrections the deliverables need

1. **summary.md, item 1.** As it stands: "The first need is not code. It is three to five real companies, approved and signed in." It should read: "The first need is not code. It is three to five real companies, approved and signed in, and at least one US job on the current sharing statement. Today no existing US job could be shown even to a signed-in company (D-17)."
2. **plan.md, Wave 0, row O1.** As it stands: "Ask the one approved company to sign in and accept the Terms. Approve or invite three to five more." It should read: "Ask the one approved company to sign in and accept the Terms. Approve or invite three to five more. At the same time, get one US job posted on the current sharing statement (owner question 27): until then a signed-in company sees no job."
3. **plan.md, Wave 0.** Add a row: "O7. Decide December's account limit before outreach. From 2026-12-01 it is USD 300, and spend with no job behind it is about USD 288 a month. That leaves room for about one or two jobs. K-01." Also add the question to owner-questions.md under Money.
4. **summary.md, item 2.** As it stands: "The room is ready in about 6 hours and the sound-free video in about 1 hour." It should read: "The room was ready in 5.9 hours on one job and 26.7 hours on another, and a third has not reached it after 70 hours. The sound-free video took about an hour on two test jobs."
5. **summary.md, item 2.** As it stands: "The only real job spent 6.3 of its 7 days there." It should read: "The only real website job, Blueprint's own capture, spent 6.3 of its 7 days there."
6. **summary.md, deletion 1.** As it stands: "The dropped trial's code can then leave in the ordered cut in `delete-list.md`: about 80,700 Pipeline lines and 21,000 WebApp lines." It should read: "The dropped trial's code and the other idle code can then leave in the ordered cut in `delete-list.md`: about 80,700 Pipeline lines and 21,000 WebApp lines in all, of which about 10,500 WebApp lines are the trial's."
7. **owner-questions.md, Q20.** As it stands: "November had 153 deploys." It should read: "November had 146 deploys (153 deploy receipts)." Make the same change in journeys.md, "C, deploys".
8. **README.md and summary.md, "What was not covered".** As it stands: "The 59 P2 findings were not checked a second time." It should read: "59 of the 91 P2 findings were not checked a second time; the other 32 were checked and lowered from P1 or P0."
9. **summary.md, "Where things stand".** After "None was refuted, 58 were corrected", add: "and one, A-05, could not be verified."
