# Build candidates: missing pieces, ranked (agent dim-missing)

Date 2026-11-22. This list is ranked by effect on the core loop first, then on the demo, then against effort.

The core loop, from the brief:

- the site's sentence and video in;
- the site's agreement recorded;
- a packet a company can judge;
- the company's answer;
- Introduce us;
- the two contact emails;
- the billable event;
- the 14/45/90-day question;
- withdrawal.

Columns:

- **Effort:** S under a day, M a few days, L a week or more.
- **Owner first:** "yes" means the owner must decide before anyone builds.
- **Cheaper alternative:** what deleting the promise instead would look like, where that exists.

Evidence is in the cited finding.

| Rank | Missing piece | Loop effect | Demo effect | Effort | Owner first | Cheaper alternative (delete the promise) | Recommendation | Source |
|---|---|---|---|---|---|---|---|---|
| 1 | The job stays listed when Blueprint's own 7-day window ends; Introduce us is not cancelled by it | Blocks the whole loop for any job whose preparation runs long | A walkthrough job can vanish mid-demo | S | no | none: doctrine says the job ships what it has | build | G-01 |
| 2 | The sound-free clip is made first, without waiting for paid preparation | Today a job reaches companies only after a money admission and an hour's wait | The packet appears in minutes, not hours | M | no | none | build | G-02, journey C P.2 |
| 3 | Reply-To on the two introduction emails points at the other side | The hand-off email sends replies to Blueprint, so a person stands in the loop | A demo reply lands in Blueprint's inbox | S | no (recorded statement unaffected) | Partial alternative: the emails already say "write to them at the email above"; leaving it is cheaper but keeps replies in Blueprint's inbox | build | A-01, B-01 |
| 4 | Companies approved later are told about open jobs (one email at approval listing them) | Every company after the first misses every job already posted | The second company in a demo sees jobs but got no email | S | no | change the doctrine line to "each company approved when the job is posted" | build | B-03, P2 |
| 5 | The withdrawal notice goes to every company that opened the job | The withdrawal promise fails for later-approved companies | none | S | no | change the Terms and Privacy "any company that saved a copy" (legal text: worse) | build | M-01 |
| 6 | 14/45/90-day questions keep going after the site closes its job | The one record of what happened after is lost exactly when a deal succeeds | none | S | no | none | build | F-04 |
| 7 | An introduction is not cancelled by stale company Terms or a 36-hour email outage | Introductions the site pressed are silently lost | High if it happens live | S | no | none | build | G-06, F-03 |
| 8 | One owner page: totals per stage, list of billable events | The billable event exists only inside each job's timeline | An investor asks "how many?" and there is no number | S | no | none (the doctrine asks for the billable event) | build | O-06, D-02, D-03 |
| 9 | The simulation package exists for a real job (rebuilt from the room package, any kind, flagged when no rule) | "A packet a company can judge" lacks its fourth part; "Tested it" can never be offered | The headline "simulation of your site" has never been shown on a real job | L | no | Hedge the copy (rank 10) and leave the package for later; the loop works on video and sentence alone | build, after ranks 1 to 8 | C-01, IP-01, M-07 |
| 10 | Find jobs sample job says "when it is ready" for the simulation download | Copy is untrue until rank 9 lands | A company reading it in the demo is promised a file | S | check whether the publicClaims guard pins the line | this row is the delete-the-promise fix | do now | M-04 |
| 11 | Withdrawal deletion runs without a per-run owner approval (install the standing approval file) | Withdrawal is in the loop; deletion waits for a person | none | S | yes | none (Privacy says withdrawal uses the deletion process) | owner installs it | D-14, A-08 |
| 12 | Deploy the Pipeline so current-policy jobs are not blurred; later, invert the rule to "blur only versions before 2026-11-17.1" | Does not block the loop; the policy is untrue in the safe direction | Blurred faces in a demo scene look odd | S | no | none | build | IP-07, F-08, C-09 |
| 13 | Non-US: one sentence and no save for a non-US site; one yes/no country field for companies | Prevents data moving without transfer terms | none | S | yes (whether to keep a waitlist; whether to approve non-US companies) | none: the Privacy transfer sentence is a legal promise | build after the owner answers | M-05, A-02 |
| 14 | Retention sweep (job close, 180 days, contact details at close) | Not in the loop; makes the Privacy Policy true before April 2027 | none | M | yes (one period for all recordings, with counsel) | Rewrite the retention schedule (legal, counsel decides); the law still expects a period | build before the first due date | M-02 |
| 15 | The job's city for companies (not the street address) | Lets a company judge travel before saying Interested | Companies in a demo ask "where is it?" | S | yes (privacy text changes) | keep "country only" and accept more "Need more details" answers | owner decides | B-04 |
| 16 | Cookie Marketing choice removed; no banner while no analytics runs | none | One fewer overlay on the first screen (A-16) | S | yes (policy text) | this row is the delete fix | delete | M-03 |
| 17 | Processor list matches reality (Notion; GA, PostHog, Sentry while unconfigured) | none | none | S | yes (legal text) | this row is the delete fix | delete at the next policy edit | M-06, O-12, IW-09 |
| 18 | Declined or waiting applicants are told | none | A company that applied in a demo hears nothing | S | no | none | build | B-08 |
| 19 | One sentence after a company answers saying what happens next | small | small | S | no | none | build | B-13 |
| 20 | Email to companies when a simulation becomes ready | Only matters once rank 9 lands | none today | S | no | none | after rank 9 | B-03 |
| 21 | Find jobs reads every listed job in order (not 200 at random) | Latent past 200 jobs | none today | S | no | none | build when convenient | M-08 |
| 22 | Policy-change notices recorded and visible | none | none | S | yes (which changes were material) | ask counsel whether in-app acceptance (G-13) meets the promise | owner decides | M-09 |
| 23 | Package opens outside USD tools; success rule explained | Helps companies test; matters only after rank 9 | none today | M | no | none | later | B-10 |

## What I would build first

Ranks 1 to 8 together are about six small PRs and one medium one. They turn a loop that is built but has never run into one that can run unattended on the first real job. The simulation package (rank 9) is the only large item. Until it lands, rank 10 keeps the copy honest at no cost.

## What needs the owner before anything is built

- Rank 11: install the deletion approval file.
- Rank 13: non-US sites and companies.
- Rank 14: one retention period.
- Rank 15: the city.
- Ranks 16 and 17: policy and cookie text.
- Rank 22: which policy changes were material.
