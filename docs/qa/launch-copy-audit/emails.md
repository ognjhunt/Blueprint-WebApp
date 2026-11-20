# Launch copy audit: emails

Auditor (e), 2026-11-20. Every subject and body a site, the person filming for a site, or a deployment company can receive,
as the code builds it today. Read-only audit: nothing in the product was changed.

## How these were rendered

- Each email below was produced by calling its builder with sample inputs from a small `tsx` script run from the
  repository root (`NODE_ENV=test`, a throwaway signing secret, `APP_URL=https://tryblueprint.io`). No store, no send.
- The body shown is the **plain-text part exactly as sent**: the builder's text passed through `brandedEmail()`
  (`server/utils/emailLayout.ts:239`), which moves fine print last and adds the text footer. The outbox does this for
  every row at dispatch (`server/utils/captureOutbox.ts:408`).
- "Buttons" lists the button labels the HTML part draws (`textToEmailHtml`, `emailLayout.ts:124`). A paragraph that is
  `Label:` + newline + an https URL becomes a button with that label; a bare URL paragraph becomes a button labelled
  **"Open your job page"** (`emailLayout.ts:142`); any other URL is linked in place.
- Signed tokens are replaced by placeholders (`<private-job-link-token>`, `<signed-invitation-token>`, `<signed-token>`).
- Marked **reconstructed** where the builder cannot be called without a store or a real send (the text is copied from
  the literal strings in the code, with the same helpers).
- Sample data: site "Eastside Laundromat" (or, for a public start-form job, the typed address), company "Northwind
  Robotics", contact Dana Lee / Sam Rivera. None of it is real.

## The shared layout (every outbox email)

- **From:** `Blueprint <hello@tryblueprint.io>`; **Reply-To:** `hello@tryblueprint.io` for every outbox row, whatever
  the row stores (`captureOutbox.ts:490-491` spreads `CUSTOMER_JOB_EMAIL_IDENTITY` over the call). This is why the
  two introduction emails' "Reply to them directly" is untrue (e-001, e-002).
- **HTML:** wordmark, the subject as the heading, the body, buttons. Under each button: "If the button doesn't open, use
  this link: {label}." (e-031). Footer: "Questions? Reply to this email or write to hello@tryblueprint.io." then
  "Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757" (`emailLayout.ts:165`, `:226`).
- **Text footer:** `--`, the postal line, `https://tryblueprint.io` (`emailLayout.ts:151`). The new-job email carries its
  own commercial footer instead (`email-suppression.ts:47`), with Privacy and Unsubscribe lines (e-007, e-008).
- Sign-off "— The Blueprint team" (`EMAIL_SIGN_OFF`, `emailLayout.ts:30`) appears only in the approval, company
  introduction, password reset and request-confirmation emails; site job emails have none.
- Direct sends that bypass the outbox: password reset (`server/routes/password-reset.ts:30`, branded, Reply-To
  support@), the film-link handoff (`filmLinkHandoff.ts:97`, **plain text only, no brand or footer**, e-021) and the
  request confirmation (`inbound-request.ts:2296`, branded).

## Index

| Email | Kind | Recipient | Builder | Subject | Findings |
| --- | --- | --- | --- | --- | --- |
| `task_received` | `task_received` | Site | `server/utils/taskLifecycleNotifications.ts:33` | Your Blueprint job link | Keep. |
| `fresh_link` | `fresh_link` | Site | `server/routes/site-task-brief.ts:931` | Your new Blueprint job link | e-026 |
| `job_sent` | `job_sent` | Site | `server/utils/taskLifecycleNotifications.ts:40` | Your job is posted | e-003, e-027 |
| `job_sent_description_only` | `job_sent` | Site | `server/utils/taskLifecycleNotifications.ts:40` | Your job is posted | e-003, e-027 |
| `company_answered_interested` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts:47` | A deployment company answered | e-028 |
| `company_answered_declined` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts:47` | A deployment company answered | e-028 |
| `company_answered_needs_something` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts:47` | A deployment company answered | e-028, e-029 |
| `company_answered_tested_can_do` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts:47` | A deployment company answered | e-028 |
| `company_answered_tested_cannot_yet` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts:47` | A deployment company answered | e-028 |
| `introduction_made_site` | `introduction_made_site` | Site | `server/utils/taskLifecycleNotifications.ts:116 (via introductionSiteEmail.ts:7)` | Meet Northwind Robotics | e-001, e-036 |
| `introduction_made_site_minimal` | `introduction_made_site` | Site | `server/utils/taskLifecycleNotifications.ts:116` | Meet Northwind Robotics | e-001 |
| `site_action_needed_sentence` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts:116` | Your job needs something from you | e-019, e-020 |
| `site_action_needed_first_video_reminder` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts:116` | Your job needs something from you | e-019 |
| `site_action_needed_large_video` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts:116` | Your job needs something from you | e-018, e-019 |
| `site_action_needed_recapture_coverage` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts:116` | Your job needs something from you | e-018, e-019 |
| `site_action_needed_recapture_object_placement` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts:116` | Your job needs something from you | e-018, e-019 |
| `site_action_needed_recapture_object_not_seen` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts:116` | Your job needs something from you | e-018, e-019 |
| `job_outcome_question_site` | `job_outcome_question` | Site | `server/utils/jobOutcomes.ts:60` | How did it go with Northwind Robotics? | e-012 |
| `request_confirmation` | `(direct send, not outbox)` | Site | `server/routes/inbound-request.ts:1004` | We received your request | e-025 |
| `film_link_handoff_email` | `(direct send, not outbox)` | Person filming for the site | `server/utils/filmLinkHandoff.ts:97` | You've been asked to film a job for Blueprint | e-021, e-022, e-023, e-024 |
| `film_link_handoff_sms` | `(SMS, when Twilio is configured)` | Person filming for the site | `server/utils/filmLinkHandoff.ts:82` | (SMS, no subject) | Keep. |
| `robot_team_access_approved_applied_no_call` | `robot_team_access_approved` | Approved company (no account yet) | `server/utils/robotTeamAccessEmails.ts:25` | Your company is approved to see jobs on Blueprint | e-009, e-010, e-011 |
| `robot_team_access_approved_applied_call` | `robot_team_access_approved` | Approved company (no account yet) | `server/utils/robotTeamAccessEmails.ts:25` | Your company is approved to see jobs on Blueprint | e-009, e-010, e-011 |
| `robot_team_access_approved_invited` | `robot_team_access_approved` | Approved company (no account yet) | `server/utils/robotTeamAccessEmails.ts:25` | Your company is approved to see jobs on Blueprint | e-009, e-010, e-011 |
| `robot_team_new_task` | `robot_team_new_task` | Approved company (Terms accepted) | `server/utils/robotTeamAccessEmails.ts:152` | New job on Blueprint | e-004, e-005, e-006, e-007, e-008 |
| `job_clarification` | `job_clarification` | Approved company | `server/utils/jobClarifications.ts:67` | The site answered your question | e-017 |
| `introduction_made_company` | `introduction_made_company` | Approved company | `server/utils/robotTeamAccessEmails.ts:164` | A site wants to talk about its job | e-002, e-013, e-016 |
| `introduction_made_company_start_form` | `introduction_made_company` | Approved company | `server/utils/robotTeamAccessEmails.ts:164` | A site wants to talk about its job | e-002, e-014, e-016 |
| `job_withdrawn_company` | `job_withdrawn_company` | Any company the job was sent to | `server/utils/withdrawalCompanyNotice.ts:22` | A job you were sent has been withdrawn | e-030 |
| `job_outcome_question_company` | `job_outcome_question` | Approved company | `server/utils/jobOutcomes.ts:60` | How did it go with Eastside Laundromat? | e-012, e-015 |
| `password_reset` | `(direct send, not outbox)` | Account holder (site or company) | `server/utils/passwordResetEmail.ts:4` | Reset your Blueprint password | Keep. |

Outbox kinds with no fixed copy: `account_notice` (Terms and Privacy update notices). Its subject and body are the
reviewed JSON an operator passes to `scripts/email/account-notice.ts`; the only sample in the repository is the local
preview in `docs/runbooks/account-notice-email.md:21` ("An update to your Blueprint account"). Nothing to render.

Retired kinds (`RETIRED_KINDS`, `captureOutbox.ts:125`) are cancelled at dispatch and never sent; not listed.

## Emails to a site

### `task_received`

- **Kind:** `task_received`
- **Trigger:** A site sends the start form (or a signed-in site starts a job)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:33`
- **Subject:** Your Blueprint job link
- **Buttons (HTML):** Open your job
- **Audit:** Keep.

```text
Your job link is ready.

A video is required to post your job. Use the link to send one or check your upload. This link opens your job without a password, so please don't forward it.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `fresh_link`

- **Kind:** `fresh_link`
- **Trigger:** A site presses the fresh-link button on an expired job link (one per hour)
- **Recipient:** Site
- **Builder:** `server/routes/site-task-brief.ts:931`
- **Subject:** Your new Blueprint job link
- **Buttons (HTML):** Open your job
- **Rendering:** reconstructed from the code (see note)
- **Note:** Built inline in the route; reconstructed here with the same strings and emailGreeting().
- **Audit:** e-026

```text
Hi,

Here is a fresh private link to your job. It opens your job without a password, so please don't forward it.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_sent`

- **Kind:** `job_sent`
- **Trigger:** Job first sent to approved deployment companies (automatic send), and each operator send
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:40`
- **Subject:** Your job is posted
- **Buttons (HTML):** Open your job
- **Audit:** e-003, e-027

```text
Your job is posted for approved deployment companies. We don't share your name, address or contact details with a deployment company unless you ask for an introduction to it. Your job page shows any answer.

To stop, open your job page, choose Job settings, then Stop using my video. Your job then leaves every company's view at once.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_sent_description_only`

- **Kind:** `job_sent`
- **Trigger:** Job first sent to approved companies, job shared with its description only (no video)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:40`
- **Subject:** Your job is posted
- **Buttons (HTML):** Open your job
- **Audit:** e-003, e-027

```text
Your job is posted for approved deployment companies. We don't share your name, address or contact details with a deployment company unless you ask for an introduction to it. Your job page shows any answer.

To stop, open your job page and choose Withdraw my job. Your job then leaves every company's view at once.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_interested`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: interested
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:47`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **Audit:** e-028

```text
A deployment company answered about your job: Interested. Your job page has the details.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_declined`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: declined
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:47`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **Audit:** e-028

```text
A deployment company answered about your job: Not a fit. Your job page has the details.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_needs_something`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: needs_something
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:47`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **Audit:** e-028, e-029

```text
A deployment company answered about your job: Need more details. Your job page has the details. You can answer a company’s question on your job page.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_tested_can_do`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: tested_can_do
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:47`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **Audit:** e-028

```text
A deployment company answered about your job: Tested it: can do. Your job page has the details.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_tested_cannot_yet`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: tested_cannot_yet
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:47`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **Audit:** e-028

```text
A deployment company answered about your job: Tested it: cannot yet. Your job page has the details.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `introduction_made_site`

- **Kind:** `introduction_made_site`
- **Trigger:** Site presses Introduce us (held until the company email is sent)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:116 (via introductionSiteEmail.ts:7)`
- **Subject:** Meet Northwind Robotics
- **Buttons (HTML):** Open your job
- **Note:** Row replyTo is the company's email, but dispatch (captureOutbox.ts:490) sends every row with replyTo hello@tryblueprint.io.
- **Audit:** e-001, e-036

```text
Northwind Robotics answered Interested about your job, and you asked us to introduce you.

Contact: Sam Rivera
Email: sam@northwind.example
Website: https://northwind.example

We've given them your details. Reply to them directly.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `introduction_made_site_minimal`

- **Kind:** `introduction_made_site`
- **Trigger:** Same, company with no contact name or website and no answer label
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts:116`
- **Subject:** Meet Northwind Robotics
- **Buttons (HTML):** Open your job
- **Audit:** e-001

```text
You asked us to introduce you to Northwind Robotics.

Email: sam@northwind.example

We've given them your details. Reply to them directly.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `site_action_needed_sentence`

- **Kind:** `site_action_needed`
- **Trigger:** Job page shows a blocking ask: sentence
- **Recipient:** Site
- **Builder:** `server/utils/siteActionNeeded.ts:116`
- **Subject:** Your job needs something from you
- **Buttons (HTML):** Open your job
- **Audit:** e-019, e-020

```text
Tell us the job in one sentence. Write it at the top of your job page, for example "Pick up each box and put it on the shelf." We start as soon as you send it.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `site_action_needed_first_video_reminder`

- **Kind:** `site_action_needed`
- **Trigger:** Job page shows a blocking ask: first_video_reminder
- **Recipient:** Site
- **Builder:** `server/utils/siteActionNeeded.ts:116`
- **Subject:** Your job needs something from you
- **Buttons (HTML):** Open your job
- **Audit:** e-019

```text
Your job is waiting for its video. Film or upload one full round of the job from this link. Your job stays open until December 3.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `site_action_needed_large_video`

- **Kind:** `site_action_needed`
- **Trigger:** Job page shows a blocking ask: large_video
- **Recipient:** Site
- **Builder:** `server/utils/siteActionNeeded.ts:116`
- **Subject:** Your job needs something from you
- **Buttons (HTML):** Open your job
- **Audit:** e-018, e-019

```text
We need a new video to build the simulation of your site. Please film a shorter clip, or record at 1080p. Then send us the new video.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `site_action_needed_recapture_coverage`

- **Kind:** `site_action_needed`
- **Trigger:** Job page shows a blocking ask: recapture_coverage
- **Recipient:** Site
- **Builder:** `server/utils/siteActionNeeded.ts:116`
- **Subject:** Your job needs something from you
- **Buttons (HTML):** Open your job
- **Audit:** e-018, e-019

```text
We need a new video to build the simulation of your site. Please film again, moving slowly around the work area so it is seen from several angles, with each view overlapping the one before. Then send us the new video.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `site_action_needed_recapture_object_placement`

- **Kind:** `site_action_needed`
- **Trigger:** Job page shows a blocking ask: recapture_object_placement
- **Recipient:** Site
- **Builder:** `server/utils/siteActionNeeded.ts:116`
- **Subject:** Your job needs something from you
- **Buttons (HTML):** Open your job
- **Audit:** e-018, e-019

```text
We need a new video to build the simulation of your site. Please film again with the object clear of clutter, resting where the job starts, and move around it so it is seen from several sides. Then send us the new video.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `site_action_needed_recapture_object_not_seen`

- **Kind:** `site_action_needed`
- **Trigger:** Job page shows a blocking ask: recapture_object_not_seen
- **Recipient:** Site
- **Builder:** `server/utils/siteActionNeeded.ts:116`
- **Subject:** Your job needs something from you
- **Buttons (HTML):** Open your job
- **Audit:** e-018, e-019

```text
We need a new video to build the simulation of your site. Please film again with it in view. Then send us the new video.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_outcome_question_site`

- **Kind:** `job_outcome_question`
- **Trigger:** 14, 45 and 90 days after an introduction
- **Recipient:** Site
- **Builder:** `server/utils/jobOutcomes.ts:60`
- **Subject:** How did it go with Northwind Robotics?
- **Buttons (HTML):** none
- **Audit:** e-012

```text
Press one to tell us what happened with Northwind Robotics.

Still talking: https://tryblueprint.io/api/job-outcomes/<signed-token>
Quote given: https://tryblueprint.io/api/job-outcomes/<signed-token>
Going ahead: https://tryblueprint.io/api/job-outcomes/<signed-token>
Installed: https://tryblueprint.io/api/job-outcomes/<signed-token>
Not going ahead: https://tryblueprint.io/api/job-outcomes/<signed-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `request_confirmation`

- **Kind:** `(direct send, not outbox)`
- **Trigger:** Intake with no private job link (site outside the US without a current description statement); effectively unreachable from today's start form
- **Recipient:** Site
- **Builder:** `server/routes/inbound-request.ts:1004`
- **Subject:** We received your request
- **Buttons (HTML):** How it works
- **Audit:** e-025

```text
Hi,

Thanks for telling us about your site and the job you want a robot to take on. We have your request and will reply by email with the next step.

How it works:
https://tryblueprint.io/how-it-works

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

## Emails to the person filming for a site

### `film_link_handoff_email`

- **Kind:** `(direct send, not outbox)`
- **Trigger:** Site sends the film link to someone on site (job page button or start form field)
- **Recipient:** Person filming for the site
- **Builder:** `server/utils/filmLinkHandoff.ts:97`
- **Subject:** You've been asked to film a job for Blueprint
- **Buttons (HTML):** none
- **Rendering:** reconstructed from the code (see note)
- **Note:** sendEmail is called with text only: no HTML part, no brand header, no postal footer. Reconstructed from the literal strings (the builder sends immediately).
- **Audit:** e-021, e-022, e-023, e-024

```text
Someone has asked you to film a job for "Move totes from the cart to the shelf". Blueprint turns the video into a job packet and shares it, without sound, with the robot deployment companies it approves, so they can decide whether they can do the job.

Open this link on your phone. The recorder opens in your browser. No account is needed, and about thirty seconds of the actual cycle is enough:
https://tryblueprint.io/capture-upload/<film-only-token>

Walk slowly in a half circle around where the job happens, keeping it in view.

You can record and upload from this link. Confirming the job details stays with the person who sent it to you.
```

### `film_link_handoff_sms`

- **Kind:** `(SMS, when Twilio is configured)`
- **Trigger:** Same, when the destination is a phone number
- **Recipient:** Person filming for the site
- **Builder:** `server/utils/filmLinkHandoff.ts:82`
- **Subject:** (SMS, no subject)
- **Buttons (HTML):** none
- **Rendering:** reconstructed from the code (see note)
- **Audit:** Keep.

```text
Blueprint: you've been asked to film a job for "Move totes from the cart to the shelf". Blueprint turns the video into a job packet for robot deployment companies. Open this on your phone to film, no account needed: https://tryblueprint.io/capture-upload/<film-only-token>
```

## Emails to a deployment company

### `robot_team_access_approved_applied_no_call`

- **Kind:** `robot_team_access_approved`
- **Trigger:** Staff approve a company's application (also re-sent on request for a new link)
- **Recipient:** Approved company (no account yet)
- **Builder:** `server/utils/robotTeamAccessEmails.ts:25`
- **Subject:** Your company is approved to see jobs on Blueprint
- **Buttons (HTML):** none
- **Audit:** e-009, e-010, e-011

```text
Hi Dana,

Your company is approved as a deployment company on Blueprint.

Create your account with this email address (dana@northwind.example), or sign in if you already have one:
https://tryblueprint.io/signup/business?invitation=<signed-invitation-token>
This invitation is bound to your approved email and expires in seven days. If it expires, ask for a new link at:
https://tryblueprint.io/contact/robot-team

Once you are signed in, the job library at https://tryblueprint.io/contact/robot-team shows the jobs sites share with approved companies. Open a job to see what the site filmed and what we have found so far, and answer: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet.

If a call would help, say so in your reply and we will find a time.

Approval does not guarantee a job, an introduction, or a deployment. Nothing is charged today.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `robot_team_access_approved_applied_call`

- **Kind:** `robot_team_access_approved`
- **Trigger:** Staff approve a company's application (call link configured) (also re-sent on request for a new link)
- **Recipient:** Approved company (no account yet)
- **Builder:** `server/utils/robotTeamAccessEmails.ts:25`
- **Subject:** Your company is approved to see jobs on Blueprint
- **Buttons (HTML):** none
- **Audit:** e-009, e-010, e-011

```text
Hi Dana,

Your company is approved as a deployment company on Blueprint.

Create your account with this email address (dana@northwind.example), or sign in if you already have one:
https://tryblueprint.io/signup/business?invitation=<signed-invitation-token>
This invitation is bound to your approved email and expires in seven days. If it expires, ask for a new link at:
https://tryblueprint.io/contact/robot-team

Once you are signed in, the job library at https://tryblueprint.io/contact/robot-team shows the jobs sites share with approved companies. Open a job to see what the site filmed and what we have found so far, and answer: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet.

If a call would help, book one here: https://cal.example/blueprint-intro

Approval does not guarantee a job, an introduction, or a deployment. Nothing is charged today.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `robot_team_access_approved_invited`

- **Kind:** `robot_team_access_approved`
- **Trigger:** Staff approve a company they invited (also re-sent on request for a new link)
- **Recipient:** Approved company (no account yet)
- **Builder:** `server/utils/robotTeamAccessEmails.ts:25`
- **Subject:** Your company is approved to see jobs on Blueprint
- **Buttons (HTML):** none
- **Audit:** e-009, e-010, e-011

```text
Hi Dana,

Following our conversation, your company is approved as a deployment company on Blueprint.

Create your account with this email address (dana@northwind.example), or sign in if you already have one:
https://tryblueprint.io/signup/business?invitation=<signed-invitation-token>
This invitation is bound to your approved email and expires in seven days. If it expires, ask for a new link at:
https://tryblueprint.io/contact/robot-team

Once you are signed in, the job library at https://tryblueprint.io/contact/robot-team shows the jobs sites share with approved companies. Open a job to see what the site filmed and what we have found so far, and answer: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet.

Approval does not guarantee a job, an introduction, or a deployment. Nothing is charged today.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `robot_team_new_task`

- **Kind:** `robot_team_new_task`
- **Trigger:** A job is first sent to approved companies (each company that has job emails on)
- **Recipient:** Approved company (Terms accepted)
- **Builder:** `server/utils/robotTeamAccessEmails.ts:152`
- **Subject:** New job on Blueprint
- **Buttons (HTML):** Open your job page
- **Audit:** e-004, e-005, e-006, e-007, e-008

```text
A site is looking for a deployment company for one of its jobs. See the job and answer in a minute: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet.

https://tryblueprint.io/jobs/req_demo_0001

Approved deployment companies get an email for each new job. Turn these off in Settings or unsubscribe below.

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
Privacy: https://tryblueprint.io/privacy
Unsubscribe from optional updates emails: https://tryblueprint.io/api/growth/email/unsubscribe?email=dana%40northwind.example&scope=optional_updates
```

### `job_clarification`

- **Kind:** `job_clarification`
- **Trigger:** The site answers a company's question on its job page
- **Recipient:** Approved company
- **Builder:** `server/utils/jobClarifications.ts:67`
- **Subject:** The site answered your question
- **Buttons (HTML):** View the job
- **Rendering:** reconstructed from the code (see note)
- **Note:** Built inline in answerCompanyQuestion (needs a store); reconstructed from the literal strings.
- **Audit:** e-017

```text
The site added an answer to your question.

View the job:
https://tryblueprint.io/jobs/req_demo_0001

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `introduction_made_company`

- **Kind:** `introduction_made_company`
- **Trigger:** Site presses Introduce us (sent first)
- **Recipient:** Approved company
- **Builder:** `server/utils/robotTeamAccessEmails.ts:164`
- **Subject:** A site wants to talk about its job
- **Buttons (HTML):** none
- **Note:** Row replyTo is the site's email, but dispatch sends replyTo hello@tryblueprint.io.
- **Audit:** e-002, e-013, e-016

```text
Hi Dana,

You answered Interested to a job on Blueprint, and the site has asked for an introduction. Here are its details:

Site: Eastside Laundromat
Email: manager@site.example
Where it is: 1200 E 6th St, Austin, TX

The job: https://tryblueprint.io/jobs/req_demo_0001

We are sending the site your company's name and your contact details now. Reply to them directly.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `introduction_made_company_start_form`

- **Kind:** `introduction_made_company`
- **Trigger:** Same, for a job from the public start form (siteName is the typed location; no name field)
- **Recipient:** Approved company
- **Builder:** `server/utils/robotTeamAccessEmails.ts:164`
- **Subject:** A site wants to talk about its job
- **Buttons (HTML):** none
- **Audit:** e-002, e-014, e-016

```text
Hi Dana,

You answered Interested to a job on Blueprint, and the site has asked for an introduction. Here are its details:

Site: 1200 E 6th St, Austin, TX
Email: manager@site.example

The job: https://tryblueprint.io/jobs/req_demo_0001

We are sending the site your company's name and your contact details now. Reply to them directly.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_withdrawn_company`

- **Kind:** `job_withdrawn_company`
- **Trigger:** A site withdraws a job that was sent to the company
- **Recipient:** Any company the job was sent to
- **Builder:** `server/utils/withdrawalCompanyNotice.ts:22`
- **Subject:** A job you were sent has been withdrawn
- **Buttons (HTML):** none
- **Audit:** e-030

```text
A site has withdrawn a job you were sent on November 12, 2026: Move totes from a cart to a shelf. It has left your job library. If you saved its video or its simulation, delete your copy now.

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_outcome_question_company`

- **Kind:** `job_outcome_question`
- **Trigger:** 14, 45 and 90 days after an introduction
- **Recipient:** Approved company
- **Builder:** `server/utils/jobOutcomes.ts:60`
- **Subject:** How did it go with Eastside Laundromat?
- **Buttons (HTML):** none
- **Audit:** e-012, e-015

```text
Press one to tell us what happened with Eastside Laundromat.

Still talking: https://tryblueprint.io/api/job-outcomes/<signed-token>
Quote given: https://tryblueprint.io/api/job-outcomes/<signed-token>
Going ahead: https://tryblueprint.io/api/job-outcomes/<signed-token>
Installed: https://tryblueprint.io/api/job-outcomes/<signed-token>
Not going ahead: https://tryblueprint.io/api/job-outcomes/<signed-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

## Emails to any account holder

### `password_reset`

- **Kind:** `(direct send, not outbox)`
- **Trigger:** Anyone asks to reset a password
- **Recipient:** Account holder (site or company)
- **Builder:** `server/utils/passwordResetEmail.ts:4`
- **Subject:** Reset your Blueprint password
- **Buttons (HTML):** Reset password
- **Note:** Sent with replyTo support@tryblueprint.io; the HTML footer says to write to hello@.
- **Audit:** Keep.

```text
Hi,

Use this link to choose a new password for your Blueprint account.

Reset password:
https://blueprint-8c1ca.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=CODE&apiKey=KEY&continueUrl=https%3A%2F%2Ftryblueprint.io%2Fsign-in

If you didn’t ask to reset your password, you can ignore this email. Your password will stay the same.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

## Audit findings (summary)

Severity: P0 = untrue, a leak or broken; P1 = confusing or internal; P2 = polish. None of these touches a recorded
statement or a legal page. Full detail (tests that pin the current words, notes) is in the auditor's structured output.

| Id | Sev | Where | Problem | Now | Proposed |
| --- | --- | --- | --- | --- | --- |
| e-001 | P0 | `server/utils/taskLifecycleNotifications.ts:128` | inaccuracy_or_promise | We've given them your details. Reply to them directly. | We've given them your details. Write to them at the email above. |
| e-002 | P0 | `server/utils/robotTeamAccessEmails.ts:185` | inaccuracy_or_promise | We are sending the site your company's name and your contact details now. Reply to them directly. | We are sending the site your company's name and your contact details now. Write to them at the email above. |
| e-003 | P1 | `server/utils/taskLifecycleNotifications.ts:25` | inaccuracy_or_promise | To stop, open your job page, choose Job settings, then Stop using my video. Your job then leaves every company's view at once. | To withdraw your job, open your job page, choose Job settings, then Stop using my video. It then leaves every company's view at once. We ask any company that saved a copy to delete it. |
| e-004 | P1 | `server/utils/robotTeamAccessEmails.ts:155` | not_launch_ready | Open your job page | Open the job: ⏎ {jobUrl} |
| e-005 | P1 | `server/utils/robotTeamAccessEmails.ts:147` | hard_to_scan | A site is looking for a deployment company for one of its jobs. See the job and answer in a minute: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet. | A site has posted a new job. Open it to see the job packet and answer. |
| e-006 | P2 | `server/utils/robotTeamAccessEmails.ts:149` | over_explaining | Approved deployment companies get an email for each new job. Turn these off in Settings or unsubscribe below. | You get this email for each new job. Turn these off in Settings or unsubscribe below. |
| e-007 | P1 | `server/utils/email-suppression.ts:65` | internal_leak | Unsubscribe from optional updates emails: {url} | Unsubscribe from job emails and Blueprint updates: {url} |
| e-008 | P1 | `server/utils/captureOutbox.ts:408` | not_launch_ready | -- ⏎ Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757 ⏎ Privacy: https://tryblueprint.io/privacy ⏎ Unsubscribe from optional updates emails: https://tryblueprint.io/api/growth/email/unsubscribe?email=dana%40northwind.example&scope=optional_updates | REMOVE |
| e-009 | P1 | `server/utils/robotTeamAccessEmails.ts:39` | hard_to_scan | Create your account with this email address (dana@northwind.example), or sign in if you already have one: ⏎ https://tryblueprint.io/signup/business?invitation=... ⏎ This invitation is bound to your approved email and expires in seven days. If it expires, ask for a new link at: ⏎ https://tryblueprint.io/contact/robot-team | Use this email address (dana@northwind.example) to create your account, or sign in if you already have one. ⏎  ⏎ Set up your account: ⏎ https://tryblueprint.io/signup/business?invitation=... ⏎  ⏎ The link works only for this email address and expires in 7 days. If it expires, get a new one at https://tryblueprint.io/contact/robot-team. |
| e-010 | P1 | `server/utils/robotTeamAccessEmails.ts:44` | inconsistency | Once you are signed in, the job library at https://tryblueprint.io/contact/robot-team shows the jobs sites share with approved companies. Open a job to see what the site filmed and what we have found so far, and answer: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet. | Once you are signed in, open Browse jobs to see the jobs sites have posted. Open a job to see its job packet and answer. ⏎  ⏎ Browse jobs: ⏎ https://tryblueprint.io/contact/robot-team |
| e-011 | P2 | `server/utils/robotTeamAccessEmails.ts:52` | over_explaining | Approval does not guarantee a job, an introduction, or a deployment. Nothing is charged today. | Nothing is charged today. |
| e-012 | P1 | `server/utils/jobOutcomes.ts:66` | not_launch_ready | Press one to tell us what happened with Northwind Robotics. ⏎  ⏎ Still talking: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Quote given: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Going ahead: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Installed: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Not going ahead: https://tryblueprint.io/api/job-outcomes/<token> | Press one to tell us what happened with Northwind Robotics. ⏎  ⏎ Still talking: ⏎ {link} ⏎  ⏎ Quote given: ⏎ {link} ⏎  ⏎ Going ahead: ⏎ {link} ⏎  ⏎ Installed: ⏎ {link} ⏎  ⏎ Not going ahead: ⏎ {link} |
| e-013 | P2 | `server/utils/robotTeamAccessEmails.ts:181` | inconsistency | Where it is: {location} | Address: {location} |
| e-014 | P2 | `server/utils/robotTeamAccessEmails.ts:177` | odd_for_business | Site: 1200 E 6th St, Austin, TX | Address: 1200 E 6th St, Austin, TX |
| e-015 | P2 | `server/utils/jobOutcomes.ts:55` | odd_for_business | How did it go with 1200 E 6th St, Austin, TX? | How did it go with the site at 1200 E 6th St, Austin, TX? |
| e-016 | P2 | `server/utils/robotTeamAccessEmails.ts:183` | inconsistency | The job: https://tryblueprint.io/jobs/{jobId} | Open the job: ⏎ https://tryblueprint.io/jobs/{jobId} |
| e-017 | P2 | `server/utils/jobClarifications.ts:68` | over_explaining | The site added an answer to your question. ⏎  ⏎ View the job: ⏎ {url} | Read it on the job page. ⏎  ⏎ Open the job: ⏎ {url} |
| e-018 | P1 | `server/utils/siteActionNeeded.ts:120` | not_launch_ready | We need a new video to build the simulation of your site. Please film again with it in view. Then send us the new video. | We need a new video to build the simulation of your site. We could not find the blue tote in your video. Please film again with it in view. Then send us the new video. |
| e-019 | P2 | `server/utils/siteActionNeeded.ts:32` | hard_to_scan | Your job needs something from you | Use the ask's own title as the subject: "Your job is waiting for its video" / "Tell us the job in one sentence" / "We need a new video to build the simulation of your site" |
| e-020 | P2 | `server/utils/taskPreparationOutcome.ts:327` | inaccuracy_or_promise | Write it at the top of your job page, for example "Pick up each box and put it on the shelf." We start as soon as you send it. | Write it at the top of your job page, for example "Pick up each box and put it on the shelf." Once you send it, we'll start building the simulation of your site. |
| e-021 | P1 | `server/utils/filmLinkHandoff.ts:97` | not_launch_ready | (sent as plain text only: no HTML part, no Blueprint header, no postal footer, no button) | Send it through brandedEmail() with CUSTOMER_JOB_EMAIL_IDENTITY like every other job email, with the link as its own labelled paragraph: "Film the job:\n{filmUrl}" |
| e-022 | P2 | `server/utils/filmLinkHandoff.ts:104` | inconsistency | Open this link on your phone. The recorder opens in your browser. No account is needed, and about thirty seconds of the actual cycle is enough: ⏎ {filmUrl} | Open this link on your phone. The recorder opens in your browser, and no account is needed. One full round of the job, about 30 seconds, is enough. ⏎  ⏎ Film the job: ⏎ {filmUrl} |
| e-023 | P2 | `server/utils/filmLinkHandoff.ts:106` | over_explaining | You can record and upload from this link. Confirming the job details stays with the person who sent it to you. | You can record and upload from this link. |
| e-024 | P2 | `server/utils/filmLinkHandoff.ts:101` | hard_to_scan | Someone has asked you to film a job for "{job}". Blueprint turns the video into a job packet and shares it, without sound, with the robot deployment companies it approves, so they can decide whether they can do the job. | Someone has asked you to film a job for "{job}". Blueprint turns the video into a job packet. We share it, without sound, with robot deployment companies we've approved, so they can decide if they can do the job. |
| e-025 | P1 | `server/routes/inbound-request.ts:1007` | inaccuracy_or_promise | Thanks for telling us about your site and the job you want a robot to take on. We have your request and will reply by email with the next step. | Thanks for telling us about your site and its job. We have your request. |
| e-026 | P2 | `server/routes/site-task-brief.ts:933` | inconsistency | Hi, | REMOVE |
| e-027 | P2 | `server/utils/taskLifecycleNotifications.ts:43` | inconsistency | Your job page shows any answer. | Company responses will show on your job page. |
| e-028 | P2 | `server/utils/taskLifecycleNotifications.ts:49` | hard_to_scan | A deployment company answered about your job: Interested. Your job page has the details. | A deployment company answered "Interested" about your job. To meet them, press Introduce us on your job page. |
| e-029 | P2 | `server/utils/taskLifecycleNotifications.ts:50` | over_explaining | A deployment company answered about your job: Need more details. Your job page has the details. You can answer a company’s question on your job page. | A deployment company needs more details about your job. Read their question and answer it on your job page. |
| e-030 | P2 | `server/utils/withdrawalCompanyNotice.ts:24` | inconsistency | It has left your job library. | It is no longer in Browse jobs. |
| e-031 | P2 | `server/utils/emailLayout.ts:103` | not_launch_ready | If the button doesn't open, use this link: {button label}. | If the button doesn't work, copy this link: {url} |
| e-032 | P1 | `server/routes/email-preferences.ts:50` | internal_leak | Stop these Blueprint emails? Confirm the preference for dana@northwind.example (optional updates). No preference has changed yet. | Unsubscribe? We'll stop sending new-job emails and Blueprint updates to dana@northwind.example. |
| e-033 | P2 | `server/routes/email-preferences.ts:51` | inconsistency | Confirm opt-out | Unsubscribe |
| e-034 | P2 | `server/routes/email-preferences.ts:63` | inconsistency | Your opt-out has been recorded. You will not receive these Blueprint emails. | You're unsubscribed. We won't send you new-job emails or Blueprint updates. |
| e-035 | P2 | `server/routes/email-preferences.ts:34` | not_launch_ready | {"ok":false,"error":"Valid email is required"} | This unsubscribe link is incomplete. Use the link in your latest Blueprint email, or turn emails off in Settings. |
| e-036 | P2 | `server/utils/taskLifecycleNotifications.ts:122` | inconsistency | Northwind Robotics answered Tested it: can do about your job, and you asked us to introduce you. | Northwind Robotics answered "Tested it: can do" about your job, and you asked us to introduce you. |

### Keep as is

- `task_received` body: one idea, says a video is needed, warns the link opens the job without a password, one button.
- `job_sent`: "We don't share your name, address or contact details with a deployment company unless you ask for an introduction to it." (privacy promise; matches the Terms).
- `job_withdrawn_company`: "If you saved its video or its simulation, delete your copy now." (carries the site's recording statement).
- `introduction_made_site`: subject "Meet {company}" and the Contact / Email / Website lines.
- First-video reminder: "Your job is waiting for its video. Film or upload one full round of the job from this link. Your job stays open until {date}."
- Password reset email, whole.
- Approval email: subject, greeting, the reader's address in brackets (the invitation works only for it), "Nothing is charged today.", the call offer.
- Outcome question: "Press one to tell us what happened with {name}." and the confirm page ("Record your answer" / "Record this answer").
- Film-link SMS, whole.
- Layout footer: "Questions? Reply to this email or write to hello@tryblueprint.io." and the postal line.

## Pages an email link opens (not emails, but only reachable from one)

- **Unsubscribe** (`server/routes/email-preferences.ts:48-63`), from the new-job email's unsubscribe line. GET shows
  "Stop these Blueprint emails?" / "Confirm the preference for {email} (optional updates). No preference has changed
  yet." and a "Confirm opt-out" button; POST answers in plain text "Your opt-out has been recorded. You will not receive
  these Blueprint emails." A bad or incomplete link answers raw JSON. Findings e-032 to e-035.
- **Outcome answer** (`server/routes/job-outcomes.ts:39-46`), from the outcome-question links: "Record your answer" /
  "Your answer: {label}" / "Record this answer"; a bad link shows "This link no longer works." Keep.

## Not covered here

- Emails Firebase sends from its own console templates (email verification via `sendEmailVerification`,
  `client/src/lib/accountAuth.ts:42`): their text is not in either repository.
- Blueprint's own ops and founder mail (not customer-facing).
- The test-inbox redirect prefix `[test → {address}]` (`email.ts:544`): only when `BLUEPRINT_EMAIL_TEST_REDIRECT` is set
  and, in production, armed.
- The robot-team branch of the request confirmation ("Thanks for getting in touch. Deployment companies apply..."):
  no page posts `buyerType: "robot_team"` to `/api/inbound-request` today.

## Guard coverage gap

`client/tests/publicClaims.guard.test.ts` scans `taskLifecycleNotifications.ts`, `captureOutbox.ts`, `robotTeamAccessEmails.ts`,
`filmLinkHandoff.ts`, `accountNotice.ts`, `taskPreparationOutcome.ts` and `jobCompanies.ts`, but not these files, which also
build customer email or email-landing text: `jobClarifications.ts`, `withdrawalCompanyNotice.ts`, `siteActionNeeded.ts`,
`jobOutcomes.ts`, `introductionSiteEmail.ts`, `passwordResetEmail.ts`, `emailLayout.ts`, `email-suppression.ts`,
`server/routes/email-preferences.ts`, `server/routes/job-outcomes.ts` and `requestConfirmationText` in
`server/routes/inbound-request.ts`. A banned phrase (a price, "stop sharing", the old frame's words) planted there today
would not be caught.

