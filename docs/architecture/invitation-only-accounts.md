# Robot-team invitations; open site signup

Site operators retain public password and Google signup, brief confirmation,
and the existing site-claim flow. Sites need no staff invitation, approval,
confirmed brief, screening disposition, or recording consent to create an
account. Their task/evidence rights checks still apply to the relevant work.

Robot teams register interest without an account. Staff review capabilities,
real task fit, and prior work at `/admin/robot-team-access`, then explicitly
approve or invite the team after a call. The decision records reviewer and time
and queues an email-bound, signed invitation valid for seven days. Matching
scores and listed-task counts never approve a team automatically.

`/signup/business` is the open site signup flow. Robot-team signup URLs and
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
of profile fields and library-open switches. Site setup has no admission check.
The existing verified-email and approval checks on the robot job library remain.

Invitation endpoints use CSRF, rate limiting, strict redemption input and
no-store responses. Invitation URLs are removed from analytics and request logs.
Approval does not authorize an evaluation, introduction, deployment, or paid
pilot; those retain their own agreed scope and rights checks.

Merge and deploy through the existing exact-SHA, CI-gated release workflow.
No Firebase project signup permission change is part of this release.
