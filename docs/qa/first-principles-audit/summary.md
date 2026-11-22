# First-principles audit: summary

2026-11-22. Both repositories, judged against one line: "Post a job for
robots. Film one repetitive job and find out who wants to deploy robots for
it." Nothing in either repository was changed. Evidence for every sentence
here is in `findings.md` under the id in brackets.

## Where things stand

The site side works. A site can land, understand the offer in seconds, start
a job with three fields and no account, and film it. The code for the rest of
the loop is built and passes its tests.

The loop has never run. In production, no job has been sent to a deployment
company, no company has answered, and no introduction has been made. There
are no billable events. (Counts only, read on 2026-11-22:
`evidence/production-counts/`.)

141 findings survived checking: 3 P0, 47 P1, 91 P2. Every P0 and P1 went to
a separate agent that tried to refute it. None was refuted, 58 were
corrected, one could not be settled, and most severities came down.

## The five things between today and "it just works"

1. **No deployment company can see a job.** One company is approved. It never
   accepted the Terms while signed in, so the code shows it nothing. Only 2
   job records carry the sharing statement, and both are marked non-US. No
   existing US job could be shown even to a signed-in company. Three site
   jobs have been started since 2026-11-12. The first need is not code. It
   is three to five real companies, approved and signed in, and one US job
   posted under the current statement. [D-17, L1-N1,
   D-08, B-07, B-08]
2. **No real job has a simulation a company can open.** The room was ready
   in 5.9 hours on one job and 26.7 hours on another; a third was not ready
   after 70. The sound-free video took about an hour on two test jobs. The
   simulation package then waits for a GPU object build that has never
   finished for a website job. A fallback to the room alone exists and did
   not fire. The only real website job, Blueprint's own capture, spent 6.3
   of its 7 days there. Its launches rented nothing,
   yet each kept an $18 hold, so the job hit its cap having spent $8.46.
   [C-01, C-03, C-02]
3. **Blueprint's own waits keep a job from companies.** The sound-free video
   is made only after paid preparation is admitted. When Blueprint's 7-day
   work window runs out first, the job is taken down for every company and
   Introduce us is refused. Other holds ask the site to film again or wait
   for the window to end. None of these protects privacy, rights or money.
   [G-02, G-01, C-04, G-04, F-10]
4. **The hand-off has never been exercised, and it has sharp edges.** A reply
   to an introduction email goes to Blueprint, not the other side. A 36-hour
   email outage cancels an introduction for good. The follow-up questions
   stop if the site closes its job. The billable event does not record that
   the introduction was actually made, or what an invoice needs. After a
   withdrawal, the Pipeline deletes nothing until an approval file is
   installed, and it never was. [A-01, F-03, F-04, O-07, O-05, A-08, M-01]
5. **The owner cannot see the loop, and the machine cries wolf.** No screen
   shows totals or lists billable events. Four fifths of November's spend is
   tied to no job. The money guard has been red on every run since
   2026-11-13 because of a retired provider's key. The host's status lists
   207 failed units, 206 of them old experiments. Job state and money
   records on the one host have no backup. From 1 December the monthly limit
   returns to $300, and costs with no job behind them already run close to
   that, which would leave room for one or two jobs a month. [O-06, D-04,
   D-01, IP-03, F-01, K-01]

## The three biggest deletions

1. **Take the GPU object build off the path to a company.** Ship the room
   package as the simulation as soon as the room is ready, flagged. The GPU
   build becomes a later upgrade, not a gate. The Pipeline path goes from 14
   steps to 5. The dropped trial's code can then leave in the ordered cut in
   `delete-list.md`. The whole delete list is about 80,700 Pipeline lines
   and 21,000 WebApp lines; about 10,500 of the WebApp lines are the trial.
   [C-01, IP-05, IW-02]
2. **Clear the retired lanes off the host.** 206 stale failed units, 229
   units the repository does not ship, timers that fire about 1,180 times a
   day for nothing, at least 67 GiB of disk, and the RunPod key that keeps
   the money guard red. After this, a red light means something. [IP-03,
   V-01, C-12, D-01]
3. **Remove the gates and manual steps that protect nothing.** The window
   end that unlists a job, the "film it again" hold, the approval of each
   window extension, the success-threshold confirmation that changes no
   threshold, the hand-recorded sends and answers, the deploy window nobody
   follows, and the staff captures page whose API any invited account can
   call. [G-01, C-04, G-10, D-13, D-09, C-02, D-10]

## The three most important missing pieces

1. **Companies on the other side, and a short way in for them.** Approval in
   one press from an email, no dead end for an applicant who is waiting or
   declined, and an email when a job's simulation becomes ready. [D-17,
   D-08, B-08, B-03]
2. **A packet a company can judge within hours.** The sound-free video made
   first, the simulation shipped from the room, and the site's state or city
   shown if the owner allows it. [G-02, C-01, B-04]
3. **One line of numbers and a billable record an invoice can stand on.**
   Totals on the staff job page with a CSV of introductions, the time each
   introduction was made, and the company's legal name, billing contact and
   Terms version frozen on each event. No price is proposed. [O-06, O-07,
   O-05]

## Demo readiness: red

**Red today.** The public half is fast and clean. The other half has nothing
real behind it. A real site's packet may not be shown to investors, because
the site agreed to share with approved deployment companies only. [E-02]

**Amber in about a day.** Show the live public pages, then a recording of the
real code running the whole loop on test data, said out loud as test data.
`demo-script.md` has the script, fallbacks and pre-flight list.

**Green** after one real job runs end to end with one real company.

## What already works and should be left alone

The home page and start form. The private job link in place of an account.
The in-page camera. The company job page, which never names the site. The
sound-free video builder. The room reconstruction. The single retry policy.
The $40 cap and its ledger. The introduction's one transaction, which writes
the billable event exactly once. Reasons are in each journey's report.

## What was not covered

Real phones. Sign-in, password reset and the site claim page. Emails as
rendered. The frame-extraction function in the third repository. Values set
only in the Render dashboard or on the host, and the rules actually
deployed. 59 of the 91 P2 findings were not checked a second time. Pipeline
timings rest on three jobs. The full list is in `README.md`.
`owner-questions.md` lists what only the owner can decide.
