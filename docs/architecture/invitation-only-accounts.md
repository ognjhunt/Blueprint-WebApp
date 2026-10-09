# Intake-first site accounts; robot-team invitations

Site operators start at `/contact/site-operator` with the existing site/job intake.
Saving a job returns a signed `/claim/:token` account link automatically, including
on a retry of the same anonymous submission. Sites need no staff invitation,
approval, confirmed brief, screening disposition, or recording consent to
create an account. Their evidence rights checks still apply to the relevant work.

The claim page fixes the account email to the submission and supports password
or Google sign-in. It reuses submitted identity, organization, site and current
terms; it does not ask for another workspace form. Password accounts verify
their email; verified Google accounts can attach immediately. The saved job
then opens in their workspace. Existing sign-in remains available.

Site workspace setup validates the signed job token against the stored intake,
matching authenticated email and current ownership in a transaction. The token
proves the prior submission, not staff approval. A missing job, another email,
a robot intake or another owner cannot create a site workspace. Existing site
owners can edit settings using server-owned job ownership instead of an old
claim link, and continue using their normal authenticated job routes. Empty
legacy accounts choosing a site workspace go directly to intake.

Robot teams register interest without an account. Staff review capabilities,
real task fit, and prior work at `/admin/robot-team-access`, then explicitly
approve or invite the team after a call. The decision records reviewer and time
and queues an email-bound, signed invitation valid for seven days. Matching
scores and listed-task counts never approve a team automatically.

`/signup/business` and legacy site signup links redirect to intake, or resume a
valid signed claim path supplied by the existing verification flow. Robot-team signup URLs and
signed invitations show the robot-team flow instead. An uninvited robot team
sees registration of interest; an approved invitation fixes the email and team
type. Inspection and redemption recheck the current decision and revision.
The invitation endpoint provisions the approved robot identity through the
Firebase Admin SDK, never resets existing credentials, and never returns a
session merely from Google preparation. Password accounts verify their email;
existing accounts use sign-in. Verified approved teams continue to the job
library. **Get invitation link** renews an expired link; **Not yet** revokes the
underlying approval and invalidates its links.

Public Firebase identity creation stays enabled to preserve the existing site
signup and one-click Google flow. Anyone can therefore create a basic login;
that login or a client-writable profile is not robot-team authorization. The
workspace setup endpoint requires a server-owned robot approval before selecting
`robot_team`, and every robot workspace request rechecks admission, independent
of profile fields and library-open switches. Site setup checks the saved intake and ownership, without a staff admission check.
The existing verified-email and approval checks on the robot job library remain.

Invitation endpoints use CSRF, rate limiting, strict redemption input and
no-store responses. Invitation URLs are removed from analytics and request logs.
Approval does not authorize an evaluation, introduction, deployment, or paid
pilot; those retain their own agreed scope and rights checks.

Merge and deploy through the existing exact-SHA, CI-gated release workflow.
No Firebase project signup permission change is part of this release.

Password recovery uses `/api/password-reset` with CSRF and IP/email rate limits.
Firebase Admin generates the one-time reset credential; the existing Resend
transport sends the shared Blueprint HTML/plain-text template from the brand
sender. Firebase still validates and consumes the credential. Public responses
are identical for existing, absent, throttled and undeliverable accounts; reset
credentials and provider error payloads are never returned or logged. Unknown
transport outcomes are not automatically resent.
