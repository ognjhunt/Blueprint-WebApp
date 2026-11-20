# Launch copy audit: emails, after the fixes

Fixer F4 (emails), 2026-11-20. Every subject and body a site, the person filming for a site, or a deployment company can
receive, as the code builds it once the launch-copy branches ship. Same format as [emails.md](emails.md), which shows them
before. The change list and its decisions are in [decisions.md](decisions.md).

## How these were rendered

- Rendered from a scratch merge of branch `launch-copy/emails` with `launch-copy/site` (the site area's status sentences
  that some emails read: the job's sentence ask, the new-video asks), by calling each builder with sample inputs from a
  small `tsx` script run from that tree (`NODE_ENV=test`, a throwaway signing secret, `APP_URL=https://tryblueprint.io`).
  No store, no send. The scratch tree was removed afterwards; nothing was committed from it.
- The body shown is the **plain-text part exactly as sent**: the builder's text passed through `brandedEmail()`
  (`server/utils/emailLayout.ts`), as the outbox does for every row at dispatch (`server/utils/captureOutbox.ts`), with
  the commercial footer's unsubscribe link passed as `unsubscribeUrl` the way dispatch now does.
- "Buttons" lists the button labels the HTML part draws. A paragraph that is `Label:` + newline + an https URL becomes a
  button with that label; a bare URL paragraph would become **"Open your job page"**, which no email reaches any more;
  any other URL is linked in place. "HTML footer" is the line under the card.
- Signed tokens are replaced by placeholders (`<private-job-link-token>`, `<signed-invitation-token>`, `<signed-token>`).
- Marked **reconstructed** where the builder cannot be called without a store or a real send (copied from the literal
  strings in the code). Only the fresh-link email (built inline in a route) and the SMS are reconstructed now; the
  clarification and film-link emails have builders of their own since this change.
- Sample data: site "Eastside Laundromat" (or, for a public start-form job, the typed address), company "Northwind
  Robotics", contact Dana Lee / Sam Rivera. None of it is real.

## The shared layout (every outbox email)

- **From:** `Blueprint <hello@tryblueprint.io>`; **Reply-To:** `hello@tryblueprint.io` for every outbox row, whatever
  the row stores (`captureOutbox.ts` spreads `CUSTOMER_JOB_EMAIL_IDENTITY` over the call). Unchanged (decision 9). The
  two introduction emails now say "Write to them at the email above." instead of "Reply to them directly." (e-001, e-002).
- **HTML:** wordmark, the subject as the heading, the body, buttons. Under each button: "If the button doesn't work, copy
  this link: {url}" (e-031). Footer: "Questions? Reply to this email or write to hello@tryblueprint.io." then
  "Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757", and "Unsubscribe" (a link) on the new-job email.
- **Text footer:** `--`, the postal line, `https://tryblueprint.io`. The new-job email carries its own commercial footer
  instead (Privacy and "Unsubscribe from new-job emails and Blueprint updates: {url}", e-007). The HTML part no longer
  prints a template's own text footer inside the card (e-008).
- Sign-off "— The Blueprint team" (`EMAIL_SIGN_OFF`) appears only in the approval, company introduction, password
  reset and request-confirmation emails; site job emails have none.
- Direct sends that bypass the outbox: password reset (branded, Reply-To support@), the film-link handoff (now branded,
  from and Reply-To hello@, e-021) and the request confirmation (branded).

## Index

| Email | Kind | Recipient | Builder | Subject | Findings |
| --- | --- | --- | --- | --- | --- |
| `task_received` | `task_received` | Site | `server/utils/taskLifecycleNotifications.ts` | Your Blueprint job link | Keep. |
| `task_received_outside_us` | `task_received` | Site | `server/utils/taskLifecycleNotifications.ts` | Your Blueprint job link | v-B-005 |
| `fresh_link` | `fresh_link` | Site | `server/routes/site-task-brief.ts` | Your new Blueprint job link | e-026 (site area) |
| `job_sent` | `job_sent` | Site | `server/utils/taskLifecycleNotifications.ts` | Your job is posted | e-003, e-027 |
| `job_sent_description_only` | `job_sent` | Site | `server/utils/taskLifecycleNotifications.ts` | Your job is posted | e-003, e-027 |
| `company_answered_interested` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered | e-028 |
| `company_answered_declined` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered | e-028 |
| `company_answered_needs_something` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered | e-029 |
| `company_answered_tested_can_do` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered | e-028 |
| `company_answered_tested_cannot_yet` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered | e-028 |
| `company_answered_needs_something_recorded_by_blueprint` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered | e-029 |
| `company_answered_tested_can_do_already_introduced` | `company_answered` | Site | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered | e-028 |
| `introduction_made_site` | `introduction_made_site` | Site | `server/utils/taskLifecycleNotifications.ts (via introductionSiteEmail.ts)` | Meet Northwind Robotics | e-001, e-036 |
| `introduction_made_site_minimal` | `introduction_made_site` | Site | `server/utils/taskLifecycleNotifications.ts` | Meet Northwind Robotics | e-001 |
| `site_action_needed_sentence` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts` | Tell us the job in one sentence | e-019 (e-020: site area) |
| `site_action_needed_first_video_reminder` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts` | Your job is waiting for its video | e-019 |
| `site_action_needed_large_video` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts` | We need a new video to build the simulation of your site | e-018, e-019 |
| `site_action_needed_recapture_coverage` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts` | We need a new video to build the simulation of your site | e-018, e-019 |
| `site_action_needed_recapture_object_placement` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts` | We need a new video to build the simulation of your site | e-018, e-019 |
| `site_action_needed_recapture_object_not_seen` | `site_action_needed` | Site | `server/utils/siteActionNeeded.ts` | We need a new video to build the simulation of your site | e-018, e-019 |
| `job_outcome_question_site` | `job_outcome_question` | Site | `server/utils/jobOutcomes.ts` | How did it go with Northwind Robotics? | e-012 |
| `request_confirmation` | `(direct send, not outbox)` | Site | `server/routes/inbound-request.ts` | We received your request | e-025 (site area) |
| `film_link_handoff_email` | `(direct send, not outbox)` | Person filming for the site | `server/utils/filmLinkHandoff.ts` | You've been asked to film a job for Blueprint | e-021, e-022, e-023, e-024 |
| `film_link_handoff_sms` | `(SMS, when Twilio is configured)` | Person filming for the site | `server/utils/filmLinkHandoff.ts` | (SMS, no subject) | Keep. |
| `robot_team_access_approved_applied_no_call` | `robot_team_access_approved` | Approved company (no account yet) | `server/utils/robotTeamAccessEmails.ts` | Your company is approved to see jobs on Blueprint | e-009, e-010, e-011 |
| `robot_team_access_approved_applied_call` | `robot_team_access_approved` | Approved company (no account yet) | `server/utils/robotTeamAccessEmails.ts` | Your company is approved to see jobs on Blueprint | e-009, e-010, e-011 |
| `robot_team_access_approved_invited` | `robot_team_access_approved` | Approved company (no account yet) | `server/utils/robotTeamAccessEmails.ts` | Your company is approved to see jobs on Blueprint | e-009, e-010, e-011 |
| `robot_team_new_task` | `robot_team_new_task` | Approved company (Terms accepted) | `server/utils/robotTeamAccessEmails.ts` | New job on Blueprint | e-004, e-005, e-006, e-007, e-008, e-031 |
| `job_clarification` | `job_clarification` | Approved company | `server/utils/jobClarifications.ts` | The site answered your question | e-017 |
| `introduction_made_company` | `introduction_made_company` | Approved company | `server/utils/robotTeamAccessEmails.ts` | A site wants to talk about its job | e-002, e-013, e-016, e-036 |
| `introduction_made_company_start_form` | `introduction_made_company` | Approved company | `server/utils/robotTeamAccessEmails.ts` | A site wants to talk about its job | e-002, e-014, e-016, e-036 |
| `job_withdrawn_company` | `job_withdrawn_company` | Any company the job was sent to | `server/utils/withdrawalCompanyNotice.ts` | A job you were sent has been withdrawn | e-030, v-B-001 |
| `job_outcome_question_company` | `job_outcome_question` | Approved company | `server/utils/jobOutcomes.ts` | How did it go with Eastside Laundromat? | e-012 |
| `job_outcome_question_company_start_form` | `job_outcome_question` | Approved company | `server/utils/jobOutcomes.ts` | How did it go with the site at 1200 E 6th St, Austin, TX? | e-012, e-015 |
| `password_reset` | `(direct send, not outbox)` | Account holder (site or company) | `server/utils/passwordResetEmail.ts` | Reset your Blueprint password | Keep. |

Outbox kinds with no fixed copy: `account_notice` (Terms and Privacy update notices), the reviewed JSON an operator passes
to `scripts/email/account-notice.ts`. Retired kinds (`RETIRED_KINDS`, `captureOutbox.ts`) are cancelled at dispatch and
never sent; not listed.

## Emails to a site

### `task_received`

- **Kind:** `task_received`
- **Trigger:** A site sends the start form (or a signed-in site starts a job)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** Your Blueprint job link
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** Keep.

```text
Your job link is ready.

A video is required to post your job. Use the link to send one or check your upload. This link opens your job without a password, so please don't forward it.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `task_received_outside_us`

- **Kind:** `task_received`
- **Trigger:** A site outside the US saves its job (its link is issued for the description alone)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** Your Blueprint job link
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Note:** Reached from the job-link repair path (`enqueueTaskLifecycleNotification` reads the saved region) and, since the final read-through, from the start form's own first email too (`inbound-request.ts` passes `captureRegion`; test in `server/tests/site-task-received-email.test.ts`).
- **Findings:** v-B-005

```text
Your job is saved.

We can only take videos from sites in the United States for now, so please don't send a video yet. This link opens your job without a password, so please don't forward it.

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
- **Builder:** `server/routes/site-task-brief.ts`
- **Subject:** Your new Blueprint job link
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Rendering:** reconstructed from the code (see note)
- **Note:** Built inline in the route (the site area's file, after its e-026 fix); reconstructed from its literal strings.
- **Findings:** e-026 (site area)

```text
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
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** Your job is posted
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-003, e-027

```text
Your job is posted for approved deployment companies. We don't share your name, address or contact details with a deployment company unless you ask for an introduction to it. Your job page shows any responses.

To withdraw your job, open your job page, choose Job settings, then Stop using my video. It then leaves every company's view at once. Each company it was sent to is asked to delete any copy it saved.

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
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** Your job is posted
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-003, e-027

```text
Your job is posted for approved deployment companies. We don't share your name, address or contact details with a deployment company unless you ask for an introduction to it. Your job page shows any responses.

To withdraw your job, open your job page and choose Withdraw my job. It then leaves every company's view at once. Each company it was sent to is asked to delete any copy it saved.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_interested`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: interested (no introduction yet)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-028

```text
A deployment company answered "Interested" about your job. To meet them, press Introduce us on your job page.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_declined`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: declined (no introduction yet)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-028

```text
A deployment company answered "Not a fit" about your job. Your job page has the details.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_needs_something`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: needs_something (no introduction yet)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-029

```text
A deployment company needs more details about your job. Read their question and answer it on your job page.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_tested_can_do`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: tested_can_do (no introduction yet)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-028

```text
A deployment company answered "Tested it: can do" about your job. To meet them, press Introduce us on your job page.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_tested_cannot_yet`

- **Kind:** `company_answered`
- **Trigger:** A deployment company answers: tested_cannot_yet (no introduction yet)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-028

```text
A deployment company answered "Tested it: cannot yet" about your job. Your job page has the details.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_needs_something_recorded_by_blueprint`

- **Kind:** `company_answered`
- **Trigger:** Blueprint records a company's emailed "Need more details" (no question box on the job page)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-029

```text
A deployment company needs more details about your job. Your job page has the details.

Open your job:
https://tryblueprint.io/capture-upload/<private-job-link-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `company_answered_tested_can_do_already_introduced`

- **Kind:** `company_answered`
- **Trigger:** A company already introduced to the site changes its answer to Tested it: can do (no button to press)
- **Recipient:** Site
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** A deployment company answered
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-028

```text
A deployment company answered "Tested it: can do" about your job. Your job page has the details.

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
- **Builder:** `server/utils/taskLifecycleNotifications.ts (via introductionSiteEmail.ts)`
- **Subject:** Meet Northwind Robotics
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Note:** The row records the company's email as replyTo, but dispatch sends every row with Reply-To hello@tryblueprint.io; the body now says to write to the address it gives.
- **Findings:** e-001, e-036

```text
Northwind Robotics answered "Tested it: can do" about your job, and you asked us to introduce you.

Contact: Sam Rivera
Email: sam@northwind.example
Website: https://northwind.example

We've given them your details. Write to them at the email above.

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
- **Builder:** `server/utils/taskLifecycleNotifications.ts`
- **Subject:** Meet Northwind Robotics
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-001

```text
You asked us to introduce you to Northwind Robotics.

Email: sam@northwind.example

We've given them your details. Write to them at the email above.

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
- **Builder:** `server/utils/siteActionNeeded.ts`
- **Subject:** Tell us the job in one sentence
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-019 (e-020: site area)

```text
We need one sentence saying what the robot should do before we can build the simulation of your job. Write it in the box on your job page, for example “Pick up each box and put it on the shelf.” Once you send it, we'll start building the simulation of your site.

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
- **Builder:** `server/utils/siteActionNeeded.ts`
- **Subject:** Your job is waiting for its video
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-019

```text
Film or upload one full round of the job from this link. Your job stays open until December 3.

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
- **Builder:** `server/utils/siteActionNeeded.ts`
- **Subject:** We need a new video to build the simulation of your site
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-018, e-019

```text
Your video is too large for us to process. Please film a shorter clip, or record at 1080p. Then send us the new video.

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
- **Builder:** `server/utils/siteActionNeeded.ts`
- **Subject:** We need a new video to build the simulation of your site
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-018, e-019

```text
Your video does not show the work area from enough different angles, with each view overlapping the next, for us to rebuild it. Please film again, moving slowly around the work area so it is seen from several angles, with each view overlapping the one before. Then send us the new video.

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
- **Builder:** `server/utils/siteActionNeeded.ts`
- **Subject:** We need a new video to build the simulation of your site
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-018, e-019

```text
We could not place the object in our rebuild of your space: what your video shows of it did not line up with the room around it in one clear position. Please film again with the object clear of clutter, resting where the job starts, and move around it so it is seen from several sides. Then send us the new video.

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
- **Builder:** `server/utils/siteActionNeeded.ts`
- **Subject:** We need a new video to build the simulation of your site
- **Buttons (HTML):** Open your job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-018, e-019

```text
We could not find the blue tote in your video. Please film again with it in view. Then send us the new video.

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
- **Builder:** `server/utils/jobOutcomes.ts`
- **Subject:** How did it go with Northwind Robotics?
- **Buttons (HTML):** Still talking, Quote given, Going ahead, Installed, Not going ahead
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-012

```text
Press one to tell us what happened with Northwind Robotics.

Still talking:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Quote given:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Going ahead:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Installed:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Not going ahead:
https://tryblueprint.io/api/job-outcomes/<signed-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `request_confirmation`

- **Kind:** `(direct send, not outbox)`
- **Trigger:** Intake with no private job link; effectively unreachable from today's start form
- **Recipient:** Site
- **Builder:** `server/routes/inbound-request.ts`
- **Subject:** We received your request
- **Buttons (HTML):** How it works
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-025 (site area)

```text
Hi,

Thanks for telling us about your site and its job. We have your request.

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
- **Builder:** `server/utils/filmLinkHandoff.ts`
- **Subject:** You've been asked to film a job for Blueprint
- **Buttons (HTML):** Film the job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Note:** Now sent in the branded layout, from and replying to hello@tryblueprint.io (CUSTOMER_JOB_EMAIL_IDENTITY).
- **Findings:** e-021, e-022, e-023, e-024

```text
Someone has asked you to film a job for "Move totes from the cart to the shelf". Blueprint turns the video into a job packet. We share it, without sound, with robot deployment companies we've approved, so they can decide if they can do the job.

Open this link on your phone. The recorder opens in your browser, and no account is needed. One full round of the job, about 30 seconds, is enough.

Film the job:
https://tryblueprint.io/capture-upload/<film-only-token>

Walk slowly in a half circle around where the job happens, keeping it in view.

You can record and upload from this link.

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `film_link_handoff_sms`

- **Kind:** `(SMS, when Twilio is configured)`
- **Trigger:** Same, when the destination is a phone number
- **Recipient:** Person filming for the site
- **Builder:** `server/utils/filmLinkHandoff.ts`
- **Subject:** (SMS, no subject)
- **Buttons (HTML):** none
- **Rendering:** reconstructed from the code (see note)
- **Findings:** Keep.

```text
Blueprint: you've been asked to film a job for "Move totes from the cart to the shelf". Blueprint turns the video into a job packet for robot deployment companies. Open this on your phone to film, no account needed: https://tryblueprint.io/capture-upload/<film-only-token>
```

## Emails to a deployment company

### `robot_team_access_approved_applied_no_call`

- **Kind:** `robot_team_access_approved`
- **Trigger:** Staff approve a company's application (also re-sent on request for a new link)
- **Recipient:** Approved company (no account yet)
- **Builder:** `server/utils/robotTeamAccessEmails.ts`
- **Subject:** Your company is approved to see jobs on Blueprint
- **Buttons (HTML):** Set up your account, Find jobs
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-009, e-010, e-011

```text
Hi Dana,

Your company is approved as a deployment company on Blueprint.

Use this email address (dana@northwind.example) to create your account, or sign in if you already have one.

Set up your account:
https://tryblueprint.io/signup/business?invitation=<signed-invitation-token>

The link works only for this email address and expires in 7 days. If it expires, get a new one at https://tryblueprint.io/contact/robot-team.

Once you are signed in, open Find jobs to see the jobs sites have posted. Open a job to see its job packet and respond.

Find jobs:
https://tryblueprint.io/contact/robot-team

If a call would help, say so in your reply and we will find a time.

Nothing is charged today.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `robot_team_access_approved_applied_call`

- **Kind:** `robot_team_access_approved`
- **Trigger:** Staff approve a company's application (call link configured) (also re-sent on request for a new link)
- **Recipient:** Approved company (no account yet)
- **Builder:** `server/utils/robotTeamAccessEmails.ts`
- **Subject:** Your company is approved to see jobs on Blueprint
- **Buttons (HTML):** Set up your account, Find jobs
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-009, e-010, e-011

```text
Hi Dana,

Your company is approved as a deployment company on Blueprint.

Use this email address (dana@northwind.example) to create your account, or sign in if you already have one.

Set up your account:
https://tryblueprint.io/signup/business?invitation=<signed-invitation-token>

The link works only for this email address and expires in 7 days. If it expires, get a new one at https://tryblueprint.io/contact/robot-team.

Once you are signed in, open Find jobs to see the jobs sites have posted. Open a job to see its job packet and respond.

Find jobs:
https://tryblueprint.io/contact/robot-team

If a call would help, book one here: https://cal.example/blueprint-intro

Nothing is charged today.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `robot_team_access_approved_invited`

- **Kind:** `robot_team_access_approved`
- **Trigger:** Staff approve a company they invited (also re-sent on request for a new link)
- **Recipient:** Approved company (no account yet)
- **Builder:** `server/utils/robotTeamAccessEmails.ts`
- **Subject:** Your company is approved to see jobs on Blueprint
- **Buttons (HTML):** Set up your account, Find jobs
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-009, e-010, e-011

```text
Hi Dana,

Following our conversation, your company is approved as a deployment company on Blueprint.

Use this email address (dana@northwind.example) to create your account, or sign in if you already have one.

Set up your account:
https://tryblueprint.io/signup/business?invitation=<signed-invitation-token>

The link works only for this email address and expires in 7 days. If it expires, get a new one at https://tryblueprint.io/contact/robot-team.

Once you are signed in, open Find jobs to see the jobs sites have posted. Open a job to see its job packet and respond.

Find jobs:
https://tryblueprint.io/contact/robot-team

Nothing is charged today.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `robot_team_new_task`

- **Kind:** `robot_team_new_task`
- **Trigger:** A job is first sent to approved companies (each company that has job emails on)
- **Recipient:** Approved company (Terms accepted)
- **Builder:** `server/utils/robotTeamAccessEmails.ts`
- **Subject:** New job on Blueprint
- **Buttons (HTML):** Open the job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757 / Unsubscribe
- **Findings:** e-004, e-005, e-006, e-007, e-008, e-031

```text
A site has posted a new job. Open it to see the job packet and respond.

Open the job:
https://tryblueprint.io/jobs/req_demo_0001

You get an email like this for each new job. Turn them off in Settings or unsubscribe below.

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
Privacy: https://tryblueprint.io/privacy
Unsubscribe from new-job emails and Blueprint updates: https://tryblueprint.io/api/growth/email/unsubscribe?email=dana%40northwind.example&scope=optional_updates
```

### `job_clarification`

- **Kind:** `job_clarification`
- **Trigger:** The site answers a company's question on its job page
- **Recipient:** Approved company
- **Builder:** `server/utils/jobClarifications.ts`
- **Subject:** The site answered your question
- **Buttons (HTML):** Open the job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-017

```text
Read it on the job page.

Open the job:
https://tryblueprint.io/jobs/req_demo_0001

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `introduction_made_company`

- **Kind:** `introduction_made_company`
- **Trigger:** Site presses Introduce us (sent first)
- **Recipient:** Approved company
- **Builder:** `server/utils/robotTeamAccessEmails.ts`
- **Subject:** A site wants to talk about its job
- **Buttons (HTML):** Open the job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Note:** The row records the site's email as replyTo, but dispatch sends Reply-To hello@tryblueprint.io; the body now says to write to the address it gives.
- **Findings:** e-002, e-013, e-016, e-036

```text
Hi Dana,

You answered "Interested" to a job on Blueprint, and the site has asked for an introduction. Here are its details:

Site: Eastside Laundromat
Email: manager@site.example
Address: 1200 E 6th St, Austin, TX

Open the job:
https://tryblueprint.io/jobs/req_demo_0001

We are sending the site your company's name and your contact details now. Write to them at the email above.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `introduction_made_company_start_form`

- **Kind:** `introduction_made_company`
- **Trigger:** Same, for a job from the public start form (siteName is the typed location; no name field)
- **Recipient:** Approved company
- **Builder:** `server/utils/robotTeamAccessEmails.ts`
- **Subject:** A site wants to talk about its job
- **Buttons (HTML):** Open the job
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-002, e-014, e-016, e-036

```text
Hi Dana,

You answered "Tested it: can do" to a job on Blueprint, and the site has asked for an introduction. Here are its details:

Email: manager@site.example
Address: 1200 E 6th St, Austin, TX

Open the job:
https://tryblueprint.io/jobs/req_demo_0001

We are sending the site your company's name and your contact details now. Write to them at the email above.

— The Blueprint team

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_withdrawn_company`

- **Kind:** `job_withdrawn_company`
- **Trigger:** A site withdraws a job that was sent to the company
- **Recipient:** Any company the job was sent to
- **Builder:** `server/utils/withdrawalCompanyNotice.ts`
- **Subject:** A job you were sent has been withdrawn
- **Buttons (HTML):** none
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-030, v-B-001

```text
A site has withdrawn a job you were sent on November 12, 2026: Move materials. It is no longer listed in Find jobs. If you saved its video or its simulation, delete your copy now.

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_outcome_question_company`

- **Kind:** `job_outcome_question`
- **Trigger:** 14, 45 and 90 days after an introduction
- **Recipient:** Approved company
- **Builder:** `server/utils/jobOutcomes.ts`
- **Subject:** How did it go with Eastside Laundromat?
- **Buttons (HTML):** Still talking, Quote given, Going ahead, Installed, Not going ahead
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-012

```text
Press one to tell us what happened with Eastside Laundromat.

Still talking:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Quote given:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Going ahead:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Installed:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Not going ahead:
https://tryblueprint.io/api/job-outcomes/<signed-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

### `job_outcome_question_company_start_form`

- **Kind:** `job_outcome_question`
- **Trigger:** Same, to the company, for a job from the public start form (its stored name is the typed address)
- **Recipient:** Approved company
- **Builder:** `server/utils/jobOutcomes.ts`
- **Subject:** How did it go with the site at 1200 E 6th St, Austin, TX?
- **Buttons (HTML):** Still talking, Quote given, Going ahead, Installed, Not going ahead
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Findings:** e-012, e-015

```text
Press one to tell us what happened with the site at 1200 E 6th St, Austin, TX.

Still talking:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Quote given:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Going ahead:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Installed:
https://tryblueprint.io/api/job-outcomes/<signed-token>

Not going ahead:
https://tryblueprint.io/api/job-outcomes/<signed-token>

--
Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
https://tryblueprint.io
```

## Emails to any account holder

### `password_reset`

- **Kind:** `(direct send, not outbox)`
- **Trigger:** Anyone asks to reset a password
- **Recipient:** Account holder (site or company)
- **Builder:** `server/utils/passwordResetEmail.ts`
- **Subject:** Reset your Blueprint password
- **Buttons (HTML):** Reset password
- **HTML footer:** Questions? Reply to this email or write to hello@tryblueprint.io. / Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757
- **Note:** Sent with replyTo support@tryblueprint.io; the HTML footer says to write to hello@.
- **Findings:** Keep.

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

## Findings: what shipped

Every finding of the emails area (F4), once. Outcome: applied (the final text as decided), adjusted (changed minimally to
be true to the code; the note says why). Recorded statements and legal pages are untouched.

| Id | Sev | Where | Before | Outcome | Note |
| --- | --- | --- | --- | --- | --- |
| e-001 | P0 | `server/utils/taskLifecycleNotifications.ts` | We've given them your details. Reply to them directly. | adjusted | introductionMadeSiteCopy now says 'We've given them your details. Write to them at the email above.' The unused fallback body (introduction_made_site entry of copy) shows no email, so 'the email above' would be untrue there; it says 'We've given them your details. Their contact details are on your job page.' (the job page shows the introduced company's details). Reply-To sending code unchanged; only a misleading code comment was corrected. |
| e-002 | P0 | `server/utils/robotTeamAccessEmails.ts` | We are sending the site your company's name and your contact details now. Reply to them directly. | applied | Company introduction: '... Write to them at the email above.' (the site's Email line is above). |
| e-003 | P1 | `server/utils/taskLifecycleNotifications.ts` | To stop, open your job page, choose Job settings, then Stop using my video. Your job then leaves every company's view at once. | applied | HOW_TO_WITHDRAW and HOW_TO_WITHDRAW_DESCRIPTION_ONLY now name withdrawal and add 'Each company it was sent to is asked to delete any copy it saved.' Verified: both withdrawal paths go through recordWebsiteCaptureWithdrawal, which plans the deletion notice to every company the job was sent to. |
| e-004 | P1 | `server/utils/robotTeamAccessEmails.ts` | Open your job page | applied | New-job email link is a labelled paragraph 'Open the job:' + URL, so the HTML draws 'Open the job'. |
| e-005 | P1 | `server/utils/robotTeamAccessEmails.ts` | A site is looking for a deployment company for one of its jobs. See the job and answer in a minute: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet. | applied | NEW_JOB_EMAIL_BODY = 'A site has posted a new job. Open it to see the job packet and respond.' COMPANY_ANSWERS import removed. |
| e-006 | P2 | `server/utils/robotTeamAccessEmails.ts` | Approved deployment companies get an email for each new job. Turn these off in Settings or unsubscribe below. | applied | 'You get this email for each new job. Turn these off in Settings or unsubscribe below.' |
| e-007 | P1 | `server/utils/email-suppression.ts` | Unsubscribe from optional updates emails: {url} | applied | Footer line maps scope to words: optional_updates -> 'Unsubscribe from new-job emails and Blueprint updates: {url}'; any other scope 'these emails'. No scope name printed. |
| e-008 | P1 | `server/utils/captureOutbox.ts` | -- ⏎ Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757 ⏎ Privacy: https://tryblueprint.io/privacy ⏎ Unsubscribe from optional updates emails: https://tryblueprint.io/api/growth/email/unsubscribe?email=dana%40northwind.example&scope=optional_updates | applied | brandedEmail's HTML part no longer draws a template's own text footer (everything after the '--' marker); captureOutbox passes the footer's unsubscribe link as unsubscribeUrl, so the HTML footer reads 'Questions? ...' / postal line / 'Unsubscribe'. Text part unchanged. |
| e-009 | P1 | `server/utils/robotTeamAccessEmails.ts` | Create your account with this email address (dana@northwind.example), or sign in if you already have one: ⏎ https://tryblueprint.io/signup/business?invitation=... ⏎ This invitation is bound to your approved email and expires in seven days. If it expires, ask for a new link at: ⏎ https://tryblueprint.io/contact/robot-team | applied | Account block split: address sentence, 'Set up your account:' button, then 'The link works only for this email address and expires in 7 days. If it expires, get a new one at https://tryblueprint.io/contact/robot-team.' (7 days verified: createAccountInvitationToken ttl). |
| e-010 | P1 | `server/utils/robotTeamAccessEmails.ts` | Once you are signed in, the job library at https://tryblueprint.io/contact/robot-team shows the jobs sites share with approved companies. Open a job to see what the site filmed and what we have found so far, and answer: Interested, Not a fit or Need more details; once the simulation can be downloaded, also Tested it: can do or Tested it: cannot yet. | applied | 'Once you are signed in, open Find jobs to see the jobs sites have posted. Open a job to see its job packet and respond.' + 'Find jobs:' button to /contact/robot-team. |
| e-011 | P2 | `server/utils/robotTeamAccessEmails.ts` | Approval does not guarantee a job, an introduction, or a deployment. Nothing is charged today. | applied | Closing line is 'Nothing is charged today.' only. |
| e-012 | P2 | `server/utils/jobOutcomes.ts` | Press one to tell us what happened with Northwind Robotics. ⏎  ⏎ Still talking: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Quote given: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Going ahead: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Installed: https://tryblueprint.io/api/job-outcomes/<token> ⏎ Not going ahead: https://tryblueprint.io/api/job-outcomes/<token> | applied | Each outcome answer is its own 'Label:\nURL' paragraph: five labelled buttons. First sentence unchanged. |
| e-013 | P2 | `server/utils/robotTeamAccessEmails.ts` | Where it is: {location} | applied | 'Where it is:' -> 'Address:'. |
| e-014 | P2 | `server/utils/robotTeamAccessEmails.ts` | Site: 1200 E 6th St, Austin, TX | applied | When the stored site name equals the typed location (start-form job), the 'Site:' line is dropped and the one 'Address:' line remains; a real site name keeps 'Site: {name}' plus 'Address:'. |
| e-015 | P2 | `server/utils/jobOutcomes.ts` | How did it go with 1200 E 6th St, Austin, TX? | applied | recipientsOf reads siteShared.location; when the stored name equals it, the company is asked about 'the site at {address}' (subject and sentence). |
| e-016 | P2 | `server/utils/robotTeamAccessEmails.ts` | The job: https://tryblueprint.io/jobs/{jobId} | applied | Company introduction job link is 'Open the job:' + URL (a button). |
| e-017 | P2 | `server/utils/jobClarifications.ts` | The site added an answer to your question. ⏎  ⏎ View the job: ⏎ {url} | applied | Clarification email body 'Read it on the job page.' + 'Open the job:' button; subject and body moved to exported constants (CLARIFICATION_SUBJECT, clarificationEmailBody). |
| e-018 | P1 | `server/utils/siteActionNeeded.ts` | We need a new video to build the simulation of your site. Please film again with it in view. Then send us the new video. | adjusted | With e-019 the ask's title is the subject (and the HTML heading), so the body starts at the reason instead of repeating the title: '{reason} {nextStep}' (the verifier's note). The first-video reminder has no reason, so its body is its next step. The ask key still hashes title and next step only. |
| e-019 | P2 | `server/utils/siteActionNeeded.ts` | Your job needs something from you | applied | Subject = the ask's own title. SITE_ACTION_SUBJECT deleted. |
| e-021 | P1 | `server/utils/filmLinkHandoff.ts` | (sent as plain text only: no HTML part, no Blueprint header, no postal footer, no button) | applied | Film-link email sent through brandedEmail() with CUSTOMER_JOB_EMAIL_IDENTITY (from and reply-to hello@); link is 'Film the job:' + URL. The text is now built by an exported filmLinkHandoffEmail(). |
| e-022 | P2 | `server/utils/filmLinkHandoff.ts` | Open this link on your phone. The recorder opens in your browser. No account is needed, and about thirty seconds of the actual cycle is enough: ⏎ {filmUrl} | applied | 'Open this link on your phone. The recorder opens in your browser, and no account is needed. One full round of the job, about 30 seconds, is enough.' (start form's words). |
| e-023 | P2 | `server/utils/filmLinkHandoff.ts` | You can record and upload from this link. Confirming the job details stays with the person who sent it to you. | applied | Closing line 'You can record and upload from this link.' |
| e-024 | P2 | `server/utils/filmLinkHandoff.ts` | Someone has asked you to film a job for "{job}". Blueprint turns the video into a job packet and shares it, without sound, with the robot deployment companies it approves, so they can decide whether they can do the job. | applied | Opening split in two; what is shared, with whom and why unchanged. |
| e-027 | P2 | `server/utils/taskLifecycleNotifications.ts` | Your job page shows any answer. | applied | 'Your job page shows any responses.' |
| e-028 | P2 | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered about your job: Interested. Your job page has the details. | applied | Interested / Tested it: can do: 'A deployment company answered "{label}" about your job. To meet them, press Introduce us on your job page.' only when the job page offers the button: callers in jobCompanies.ts pass introductionOffered (the company's own answer is always under the current line, an operator-recorded one consents too; false when an introduction to that company is already on record, made or cancelled). Other labels and the no-button case: '... answered "{label}" about your job. Your job page has the details.' |
| e-029 | P2 | `server/utils/taskLifecycleNotifications.ts` | A deployment company answered about your job: Need more details. Your job page has the details. You can answer a company’s question on your job page. | adjusted | 'A deployment company needs more details about your job. Read their question and answer it on your job page.' for a company's own answer. An answer Blueprint records from a company's email carries no question box (questionOnReply needs recordedBy company), so that email says '... Your job page has the details.' instead. Curly apostrophe gone. |
| e-030 | P2 | `server/utils/withdrawalCompanyNotice.ts` | It has left your job library. | applied | 'It is no longer listed in Find jobs.' The deletion sentence is word for word. |
| v-B-001 | P2 | `server/utils/withdrawalCompanyNotice.ts` | A site has withdrawn a job you were sent on November 12, 2026: Pallet handling opportunity. It has left your job library. | applied | withdrawalCompanyBody passes the title through jobTitleForDisplay ('Pallet handling opportunity' -> 'Handle pallets'). |
| e-031 | P2 | `server/utils/emailLayout.ts` | If the button doesn't open, use this link: {button label}. | applied | Under every button: 'If the button doesn't work, copy this link: {url}' (the URL as link text, wrapping). |
| e-036 | P2 | `server/utils/taskLifecycleNotifications.ts` | Northwind Robotics answered Tested it: can do about your job, and you asked us to introduce you. | applied | Labels quoted in the site introduction ('answered "Tested it: can do" about your job'), the company introduction ('You answered "Interested" to a job') and the answer email. |
| v-B-005 | P2 | `server/utils/taskLifecycleNotifications.ts` | Your job link is ready. ⏎  ⏎ A video is required to post your job. Use the link to send one or check your upload. This link opens your job without a password, so please don't forward it. | adjusted | Builder done: buildTaskLifecycleNotification takes captureRegion and, for a known non-approved region, sends 'Your job is saved.' + 'We can only take videos from sites in the United States for now, so please don't send a video yet. This link opens your job without a password, so please don't forward it.' The repair path (enqueueTaskLifecycleNotification) reads the saved region. The start form's first email is built in server/routes/inbound-request.ts:2010 (not this area's file), which does not pass the region yet: cross-area request. |
| e-032 | P1 | `server/routes/email-preferences.ts` | Stop these Blueprint emails? Confirm the preference for dana@northwind.example (optional updates). No preference has changed yet. | applied | optional_updates page: 'Unsubscribe from new-job emails and Blueprint updates?' / 'We'll stop sending them to {email}.' |
| f-104 | P1 | `server/routes/email-preferences.ts` | Stop these Blueprint emails? / Confirm the preference for {email} ({scope}). No preference has changed yet. / Confirm opt-out | applied | Same words as e-032, button 'Unsubscribe', in a small styled frame copied from the outcome pages (job-outcomes.ts page() is not exported and is not this area's file). |
| d-072 | P1 | `server/routes/email-preferences.ts` | Stop these Blueprint emails? / Confirm the preference for {email} ({scope}). No preference has changed yet. / Confirm opt-out / (after) Your opt-out has been recorded. You will not receive these Blueprint emails. | adjusted | Its generic words ship for scopes no email links to (all, lifecycle, growth_campaign): 'Stop these emails from Blueprint?' / 'We'll stop sending this kind of email to {email}. Nothing has changed yet.' / Unsubscribe / 'You're unsubscribed. We won't send you these emails again.' The new-job email's own link (optional_updates) gets the more specific e-032/f-104 words. |
| e-033 | P2 | `server/routes/email-preferences.ts` | Confirm opt-out | applied | Button 'Unsubscribe'. |
| e-034 | P2 | `server/routes/email-preferences.ts` | Your opt-out has been recorded. You will not receive these Blueprint emails. | applied | After confirming (optional_updates): 'You're unsubscribed. We won't send you new-job emails or Blueprint updates.' as a styled HTML page. |
| f-106 | P2 | `server/routes/email-preferences.ts` | Your opt-out has been recorded. You will not receive these Blueprint emails. | applied | Applied with e-034 (same string). |
| e-035 | P2 | `server/routes/email-preferences.ts` | {"ok":false,"error":"Valid email is required"} | applied | Browser (HTML) request with a bad email: styled page 'This unsubscribe link is incomplete. Use the link in your latest Blueprint email, or write to hello@tryblueprint.io.' JSON callers keep the JSON error. |
| f-105 | P1 | `server/routes/email-preferences.ts` | {"ok":false,"error":"Valid email is required"} (raw JSON in the browser) | applied | Applied with e-035; mismatch: 'This link changed. Open it again from the email.'; storage down: 'We couldn't save that just now. Open the link again shortly.' Status codes unchanged (400/503). |
| v-A-005 | P2 | `server/routes/email-preferences.ts` | {"ok":false,"error":"Confirm the matching email preference before submitting","confirmationRequired":true} / {"ok":false,"error":"Email preference storage is unavailable"} | adjusted | Same two error paths as f-105: shipped f-105's wording (the primary, P1) as a styled HTML page rather than v-A-005's plain-text wording, so the page reads like the rest of the unsubscribe flow. JSON stays for JSON callers. |
| c-011 | P1 | `server/utils/accountInvitations.ts` | Robot-team signup requires a current Blueprint invitation. Apply and wait for approval. | applied | Shipped the corrected text. The message is the deny() of accountInvitations.ts, shown on /signup/business under the page's own 'get a new invitation link' (RobotTeamSignUpFlow.tsx:91). Edge case noted under uncertain: the same deny() also answers a redeem whose approval changed between page load and submit, when the form (without that link) is on screen. |
| f-083 | P1 | `server/utils/accountInvitations.ts` | Robot-team signup requires a current Blueprint invitation. Apply and wait for approval. | adjusted | Same string as c-011 (applied once there): 'Get a new one below' was wrong about position, the error renders after the link, so c-011's 'Use the link on this page to get a new one.' ships. |

### Kept as is

- `task_received` body for a US site, the private-link warning and its one button.
- `job_sent`: "We don't share your name, address or contact details with a deployment company unless you ask for an introduction to it."
- `job_withdrawn_company`: "If you saved its video or its simulation, delete your copy now." (word for word).
- `introduction_made_site`: subject "Meet {company}" and the Contact / Email / Website lines.
- First-video reminder's next step: "Film or upload one full round of the job from this link. Your job stays open until {date}."
- Password reset email, whole.
- Approval email: subject, greeting, the reader's address in brackets (the invitation works only for it), "Nothing is charged today.", the call offer.
- Outcome question: "Press one to tell us what happened with {name}." and the confirm page.
- Film-link SMS, whole.
- Layout footer: "Questions? Reply to this email or write to hello@tryblueprint.io." and the postal line (true: every outbox row has Reply-To hello@).

## Pages an email link opens (not emails, but only reachable from one)

- **Unsubscribe** (`server/routes/email-preferences.ts`), from the new-job email's unsubscribe line. GET shows, in a small
  styled page, "Unsubscribe from new-job emails and Blueprint updates?" / "We'll stop sending them to {email}." and an
  "Unsubscribe" button; POST answers "You're unsubscribed. We won't send you new-job emails or Blueprint updates." A link
  with another scope (none is sent today) reads "Stop these emails from Blueprint?" / "We'll stop sending this kind of
  email to {email}. Nothing has changed yet." and "You're unsubscribed. We won't send you these emails again." A browser
  that opens a broken link, submits a changed one, or hits a storage failure gets a page: "This unsubscribe link is
  incomplete. Use the link in your latest Blueprint email, or write to hello@tryblueprint.io." / "This link changed. Open
  it again from the email." / "We couldn't save that just now. Open the link again shortly." JSON callers are answered
  as before. No scope name is printed (e-032 to e-035, f-104 to f-106, d-072, v-A-005).
- **Outcome answer** (`server/routes/job-outcomes.ts`, the site area's file): "Record your answer" / "Your answer:
  {label}" / "Record this answer"; unchanged here.
- **Expired invitation** (`/signup/business?invitation=…`): the server's message is now "This invitation link no longer
  works. Use the link on this page to get a new one." (c-011), shown under the page's "get a new invitation link".

## Not covered here

- Emails Firebase sends from its own console templates (email verification): their text is not in either repository.
- Blueprint's own ops and founder mail (not customer-facing).
- The test-inbox redirect prefix `[test → {address}]`, only when `BLUEPRINT_EMAIL_TEST_REDIRECT` is set.

## Guard coverage

`client/tests/publicClaims.guard.test.ts` now also scans `jobClarifications.ts`, `withdrawalCompanyNotice.ts`,
`siteActionNeeded.ts`, `jobOutcomes.ts`, `introductionSiteEmail.ts`, `passwordResetEmail.ts`, `emailLayout.ts`,
`email-suppression.ts` and `server/routes/email-preferences.ts`, and checks that a planted banned phrase is caught in
two of them. Still unscanned: `server/routes/job-outcomes.ts` and `requestConfirmationText` in
`server/routes/inbound-request.ts` (the site area's files).

