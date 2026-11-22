# Investor walkthrough: five minutes

2026-11-22. The path that shows the whole loop without anything breaking, the
fallback for each step, and the pre-flight list for the hour before.

## Readiness: red today

- **Red today.** The public pages are fast and clean. Steps 5 to 7 (a company's view, responses, Introduce us) have nothing real behind them: production has never sent a job to a company. A real site's packet may not be shown to investors, because the site agreed to share with approved deployment companies only.
- **Amber in about a day.** The live public pages, then a recording of the real code running the whole loop on test data, said out loud as test data, plus one simulation from Blueprint's own test footage.
- **Green** after one real job, filmed where Blueprint may film, is answered by one real approved company and introduced.

Do not show the demo build from PR 1369. Its quotes and counts are invented.
Nothing invented goes on the live site.

## Fact sheet: the true numbers, 2026-11-22

For the close, and for the questions an investor asks. Counts only, read from
production on 2026-11-22 (`evidence/production-counts/`). Say the date.

| Question | True answer |
|---|---|
| How many jobs? | 61 site job records that are not internal tests. 32 were created in September, 14 in October, 6 in November. Whether each is an outside site or Blueprint's own trial was not read. |
| How many under today's sharing terms? | 2, both marked non-US. |
| How many deployment companies? | 1 approved. It has not yet accepted the Terms signed in, so it sees no job yet. |
| How many answers, introductions, billable events? | 0, 0 and 0. |
| How long does it take? | Sound-free video in about 1 hour and the room in about 6 hours, from one to three jobs. No real job has a simulation a company can open yet. |
| What does a job cost? | Capped at $40. The one real job in November spent $8.46. November's account total is $296.58 of a $400 limit, most of it not tied to a job. |
| What is billable? | Each introduction is recorded. No price is set. |

## Three rules

1. No real site's packet, private link, sentence or answer on screen unless that site said yes in writing.
2. Never press Introduce us on a production job for show. It emails real details to both sides and records an introduction. It cannot be undone.
3. Never submit the live start form. It creates a real job, sends emails and starts paid processing.

## The script (5:00)

Tabs are opened, signed in and warmed before the room fills. Nothing is typed on stage.

| time | beat | tab and exact URL | account | artifact | say |
|---|---|---|---|---|---|
| 0:00-0:20 | 1. Home | Tab 1: `https://tryblueprint.io/` | none | the live page and its Example card | "A site films one repetitive job. Deployment companies tell it who will take it." Point at the Example label. |
| 0:20-0:35 | 1b. Start (glance) | Tab 1: press **Start a job** -> `https://tryblueprint.io/contact/site-operator` | none | the live form, not submitted | "A video, one sentence, where, an email. Free for sites. No account." Press Back. |
| 0:35-1:20 | 2. A packet | Tab 1: header **Find jobs** -> `https://tryblueprint.io/jobs`, press **See a sample job**, press play | none | the stock sample job | "This is the shape of a packet. This one is stock footage, labelled as such. A live job adds the site's answers, a first look on paper and a simulation." |
| 1:20-2:20 | 3. A company answers | Tab 2 (amber): the recorded core-journey run, paused at the company's job page. Tab 2 (green): `https://tryblueprint.io/jobs/<real job id>` | green: the approved company's account, signed in beforehand | amber: recording of the real code on test data; green: the real job | "Approved companies see the job without the site's name or address. They answer Interested, Not a fit or Need more details." Show the answer being sent. |
| 2:20-2:55 | 3b. The simulation | Tab 3: the viewer opened from `https://tryblueprint.io/admin/jobs?job=<internal test job id>` -> **View the simulation of the site**, already loaded and oriented | owner (admin), signed in beforehand | Blueprint's own test footage, internal test job | "Built from the phone video. Companies download it into their own tools." Drag once. Say it is Blueprint's own test footage. |
| 2:55-3:45 | 4. Responses | Tab 2: the recording, at the site's job page | none (the site has no account; it uses its private link) | the same run | "The site sees each answer by alias, with the company's own words." Point at Company A Interested and Company B Need more details. |
| 3:45-4:20 | 5. Introduce us | Tab 2: the recording, the press of **Introduce us**, then the two emails from its outbox | none | the same run | "One press. Each side gets the other's name and contact details by email. Each introduction is recorded as a billable event. No price is set yet." |
| 4:20-5:00 | Close | none | none | the dated fact sheet (E-08) | Say the true numbers and their date. "We have not yet had a company answer a live job. This is the next milestone." |

Beats deleted from the seven-step plan: How it works (repeats the home page), the start form as a full step (a 15-second glance instead), and the simulation as its own stop (it opens from the packet).

## Fallback for each beat

| beat | if slow or broken | fallback |
|---|---|---|
| 1 Home | page slow (measured 0.1-0.2 s, unlikely) or no network | screenshot `screenshots/E-01-home-1280.png` |
| 1b Start | same | `screenshots/E-05-start-1280.png`; or skip, it is a glance |
| 2 Packet | video does not play (measured 2.6 s to 2.5 s of playback) | describe the still; `screenshots/E-09-sample-scrolled-1280.png` |
| 3 Company answers | recording does not open | `screenshots/E-13-company-job-1280.png` (mocked test data, labelled Fixture) |
| 3b Simulation | viewer black, "could not be loaded" or graphics error | reload the same URL with `&webgl=1`; then the recorded screen clip of the same viewer made at pre-flight; then skip and say "the simulation is a download for companies" |
| 4 Responses | recording does not open | `screenshots/E-10-site-responses-1280.png` |
| 5 Introduce us | recording does not open | `screenshots/E-11-introduced-1280.png`; read the email wording from `server/utils/introductionSiteEmail.ts` |
| Close | no fact sheet | say "we will send the numbers in writing"; do not estimate |

## Pre-flight, one hour before

Run in order. Each item has its expected result.

| # | check | command or click | expected |
|---|---|---|---|
| 1 | Live site is the expected build | `curl -s https://tryblueprint.io/version.json` | `"git_sha"` is the commit you rehearsed on |
| 2 | Public pages answer | `for p in / /how-it-works /jobs /contact/site-operator /beta; do curl -s -o /dev/null -w "$p %{http_code} %{time_starttransfer}\n" https://tryblueprint.io$p; done` | every line 200, under 0.5 s |
| 3 | Sample video is there | `curl -sI https://tryblueprint.io/samples/sample-job-parcels.mp4` | 200, about 1.6 MB |
| 4 | Viewer code is there | `curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://tryblueprint.io/splat-viewer/index.js` | 200, about 3.4 MB |
| 5 | Cookie banner answered | Open Tab 1 in the presenting browser profile (not a private window), press Reject all or Accept all | banner gone on reload |
| 6 | Sample link works | Tab 1: `/jobs`, press **See a sample job** (not the `#sample-job` deep link, E-11) | the sample's title is at the top of the screen |
| 7 | Video plays | press play on the sample | moving picture within 3 s, no sound |
| 8 | Owner signed in | `https://tryblueprint.io/sign-in` as the owner (admin) | `/admin/jobs` lists jobs |
| 9 | Simulation warm | `/admin/jobs?job=<internal test job id>` -> **View the simulation of the site**; time it; orient the view | scene drawn; note the seconds; leave the tab open |
| 10 | Simulation fallback | same URL plus `&webgl=1` in a second tab | scene drawn |
| 11 | Simulation clip | record 15 s of item 9 with the OS screen recorder | a file on the desktop |
| 12 | Recording of the loop ready | open the core-journey MP4 (E-06) at the company's job page | plays; the words "test" or "Fixture" are visible or you will say them |
| 13 | Fact sheet | print the fact sheet at the top of this file; refresh the counts if more than a week old | numbers and date on one page |
| 14 | Nothing live will fire | confirm no tab shows a real site's private link or a production Introduce us button | none |
| 15 | Notifications off | OS do-not-disturb on; email and Slack closed | no pop-ups during screen share |
| 16 | Screen width | present at 1280 wide or more; if on a phone, 390 wide works too (no sideways scroll measured) | layout matches the screenshots |

Making the core-journey recording (once, for item 12), on a machine where ports 4183, 8080, 9099 and 9199 are free:

```bash
# a scratch config outside the repo that reuses the answer-journey config with video on
cat > /tmp/demo-video.config.ts <<'EOF'
import base from '/path/to/Blueprint-WebApp/playwright.answer-journey.config.ts';
export default { ...base, use: { ...(base as any).use, video: 'on' }, outputDir: '/tmp/demo-video' };
EOF
cd /path/to/Blueprint-WebApp && FIREBASE_SERVICE_ACCOUNT_JSON= GOOGLE_APPLICATION_CREDENTIALS= \
  npx -y firebase-tools@13.35.1 emulators:exec --only firestore,storage,auth --project demo-blueprint-reliability \
  --config firebase.json "npx playwright test --config /tmp/demo-video.config.ts --trace off"
```

Expected: 2 passed in under a minute, and a `.webm` per test under `/tmp/demo-video`. Nothing leaves the machine; the run uses emulators and a synthetic video. This was not run in this audit (shared ports); the same test passed in the orchestrator's baseline in 25 s.
