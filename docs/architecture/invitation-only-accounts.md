# Invitation-only team accounts

Robot teams and site operators submit intake without an account. Blueprint staff
approve access only after reviewing the prerequisites. The homepage and existing
sign-in remain public; `/signup/business` shows intake links unless a current
invitation is supplied. A `buyerType`, email, review link, claim link, fit score,
listed-task count, or open-library switch cannot authorize account creation.

## Staff workflow

- Robot teams: open `/admin/robot-team-access`. Review the application, robot
  capabilities, real task fit, and the required prior conversation/work. Choose
  Approve and confirm that review. Staff can also invite a team after a call.
  Approval records the reviewer and decision time and queues the email-bound
  account invitation. Automated fit checks remain advisory. Use **Get invitation
  link** on an approved application to replace an expired link. Choosing **Not
  yet** invalidates links for that decision.
- Sites: open the submission in `/admin/leads`. Complete the existing screening
  and review the operator's authority. The invitation panel requires a confirmed
  job brief, `qualified` screening disposition, current Terms/Privacy acceptance,
  and current recording consent. Check the staff review attestation and choose
  **Approve and invite site**. The server rechecks those facts inside the approval
  transaction, records the reviewer/time/revision in `siteAccountAccess`, and
  queues an invitation in the existing durable outbox. Repeating the action
  returns a fresh link without duplicate email for the same approval revision.
  Use **Revoke invitation** to invalidate outstanding links; reapproval creates
  a new revision. This action does not delete existing accounts or task data.

No automated process decides someone is invited. Meeting stored prerequisites
makes a site eligible for staff review; it does not approve the site. A robot
team's matching score does not approve the team either. Account approval does
not authorize a robot evaluation, recording, introduction, or paid pilot; those
retain their own scope and rights checks.

## Recipient workflow and enforcement

The signed invitation expires after seven days and binds the approved email,
workspace type, source submission, and approval revision. Both inspection and
redemption recheck the current server-owned decision; sites also recheck the
prerequisites. The form cannot change the email or workspace type. Recipients
accept the Terms/Privacy Policy and use a password or the matching Google
identity. Only the Firebase Admin SDK provisions the approved account. Existing
credentials are never reset by an invitation, and Google preparation returns no
session or custom token. Existing account holders use ordinary sign-in.

Password accounts start with an unverified email and receive a verification
email. Verified robot teams continue to the job library, whose existing approval
and verified-email checks still apply. Sites continue to the existing site claim
flow; attachment still requires the correct verified email. Workspace setup
checks the admission independently of client profile fields. Brief confirmation
and screening can finish without asking a site to create an account first.

The public invitation endpoints have CSRF protection, a rate limit, no-store
responses, and strict redemption input. Approval collections remain private
under the existing Firestore default-deny rules. No invitation secret or password
is stored in a client profile, source-control file, or request log.

## Release sequence and Firebase setting

1. Run checks, merge through CI, and deploy the invitation-aware web and worker
   through the existing exact-SHA GitHub Actions deployment workflow.
2. Read the project permission with
   `node scripts/firebase/disable-public-signup.mjs`.
3. With the authorized release credentials, run the same helper with `--apply`.
   It patches only `client.permissions.disabledUserSignup=true` on the existing
   `blueprint-8c1ca` project and verifies the readback. It preserves deletion,
   provider, and other client configuration and emits only a redacted receipt.
4. Verify public Firebase REST signup is refused and public invitation redemption
   is denied without approval. Existing users continue to sign in; the Admin SDK
   can create approved accounts through the invitation route.

Firebase's project permission blocks end-user account creation across password,
Google, and other public SDK/API methods, including other clients sharing this
project. Do not re-enable public signup during a web rollback. Restore the
invitation-capable server before resuming new account enrollment. The narrow
setting can be restored separately by an authorized incident owner if required;
the helper deliberately has no public-signup enable mode.

[Firebase project client permissions API](https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects.config#Permissions)
