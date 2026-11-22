# Build list

2026-11-22. The missing pieces, ranked by their effect on the core loop and
on the demo, against effort. S is under a day, M a few days, L a week or
more. "Owner first" means the owner decides before anyone builds. Nothing
here has been built. PR numbers are in `plan.md`.

A missing promise has two fixes: build the thing, or delete the promise. The
cheaper one is named where it exists.

| Rank | Missing piece | Effect on the loop | Effect on the demo | Effort | Owner first | Cheaper alternative | Finding |
|---|---|---|---|---|---|---|---|
| 1 | Deployment companies that can see jobs: three to five approved and signed in | Nothing after "posted" can happen without them | Red to green needs one | owner time, no code | yes | none | D-17 |
| 2 | A reply to an introduction email reaches the other side | Removes a person from the hand-off | A demo reply would land in Blueprint's inbox | S | yes | Leave it; the email already says which address to write to | A-01 |
| 3 | A job stays listed when Blueprint's own window ends | A slow job no longer vanishes | A demo job cannot vanish | S | no | none | G-01 |
| 4 | A launch's hold matches what it spent (corrected: five of the seven launches did rent a machine briefly; two rented nothing and still held $18 because the $0 proof cannot be read after the run's folder is moved) | A job's build is no longer ended by holds far above what was spent | none | M | yes | none | C-03 |
| 5 | The simulation for a real job, shipped from the room as soon as it is ready | The fourth part of the packet exists; "Tested it" can be offered | The headline "simulation of your site" can be shown on a real job | M: first find why the existing fallback did not fire | yes | Say "when it is ready" in the copy (rank 12) | C-01 |
| 6 | The sound-free video made first | A job can reach companies in about an hour instead of after paid preparation | The packet appears sooner | M | no | none | G-02 |
| 7 | An introduction survives an email outage, and the event records when it was made | No introduction is lost; a billable event means the company has the details | none | S + S | no | none | F-03, O-07 |
| 8 | Follow-up questions continue after a site closes its job | The record of what happened is kept | none | S | no | none | F-04 |
| 9 | One line of totals and a CSV of billable events on the staff job page | The owner can see the loop | An investor asks "how many?" and there is a true number | S | no | A dated fact sheet by hand (`demo-script.md`) | O-06 |
| 10 | Approval in one press from an email; applicants told where they stand | The one human step takes seconds | A company that applies in a demo hears back | S + S | yes | none | D-08, B-08 |
| 11 | Long uploads are not cut at 5 minutes, and resume | A site with a slow connection can post | none | S then M | no | none | F-05 |
| 12 | The job page and Find jobs say only what is true today | "Posted for approved companies" and "download the simulation" are untrue until ranks 1 and 5 | A reader is promised a file | S | yes | this is the delete-the-promise fix | L1-N1, M-04 |
| 13 | Every company that opened a job is asked to delete on withdrawal; deletion on the Pipeline side runs without a person | The withdrawal promise is kept | none | S + owner step | yes | none | M-01, A-08 |
| 14 | An email when a job's simulation is ready; open jobs listed at approval | Later companies learn of jobs | none today | M | no | none | B-03 |
| 15 | The site's state shown to companies | A company can judge travel | Companies ask "where is it?" | S | yes | Keep "country only" and accept more "Need more details" | B-04 |
| 16 | What an invoice needs on each billable event | Charging can start when the owner decides how | none | M | yes | none | O-05 |
| 17 | Backup of job state and money records; a heartbeat per worker loop | A lost host or a stopped loop is noticed | none | S + S | yes for the bucket | none | F-01, F-11 |
| 18 | Parked jobs retry by themselves | No operator command is the only way forward | none | M | no | none | F-10, F-02 |
| 19 | Non-US: no sharing agreement offered; a country question for companies | Data does not move before transfer terms exist | none | S | yes | none | A-02 |
| 20 | A retention period and the sweep that keeps it | Not in the loop; makes the Privacy Policy state a period | none | M | yes | none: the law still expects a period | M-02 |
| 21 | One cost per job, joining the two ledgers | The owner sees what a job cost | A true cost per job | M | no | none | D-04 |
| 22 | A recording of the real loop for the walkthrough | none | Red to amber | S, no repository change | no | none | E-06 |

## What to build first

Rank 1 is not code. Ranks 2 to 4 and 7 to 9 are small PRs for this week
(wave 1). Ranks 5 and 6 are the two medium ones for the next two weeks, and
they are what turns "a simulation is promised" into "a simulation arrives in
hours". Everything from rank 14 down can wait for the first real answer.

## Already built, though reported missing

Checking found these exist:

- A fallback from the built scene to the room for the company simulation. It exists and did not fire; rank 5 is a diagnosis first.
- An explanation of the success rule in the package's README, when a rule is defined.
- Backlog and failure alerts for the email outbox.
- The date each company applied, on the approvals page.

## The working list in detail

The table below is from the agent that compared every promise with the code.
It adds the cheaper alternative for each row. Where it differs from the table
above, the table above carries the corrections from checking.

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

### What I would build first

Ranks 1 to 8 together are about six small PRs and one medium one. They turn a loop that is built but has never run into one that can run unattended on the first real job. The simulation package (rank 9) is the only large item. Until it lands, rank 10 keeps the copy honest at no cost.

### What needs the owner before anything is built

- Rank 11: install the deletion approval file.
- Rank 13: non-US sites and companies.
- Rank 14: one retention period.
- Rank 15: the city.
- Ranks 16 and 17: policy and cookie text.
- Rank 22: which policy changes were material.
