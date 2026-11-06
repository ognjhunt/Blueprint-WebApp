# Minimal account and workspace signup

Owner-requested replacement of the legacy three-step sales intake signup.

## Flow

1. Account: email and password, or Google authentication.
2. Workspace: name, organization, one Site/Robot team choice, and Terms/Privacy acceptance.

Task/site fields, budgets, referral questions, company size, phone/title, legacy
requested lanes, benchmark dossiers, and permission matrices are removed from
signup. A new site user goes to `/app/tasks/new`; a robot team goes to
`/app/opportunities`, with robots/policies available in Settings.

Signup no longer creates an inbound sales request or claims that a task/dossier
has been submitted. It uses the existing authenticated `/api/workspace/setup`
endpoint, which preserves existing privileges and writes current legal
acceptance with server-owned versions. No evaluation, visibility, training, or
commercialization permission is inferred from account creation. URL attribution
continues in consent-governed signup analytics with zero requested lanes.

Firebase credentials are created at final submit only. The resulting user is
retained across retries; failures keep form values. Authenticated incomplete
accounts resume at workspace details. Configured accounts return to their
workspace without overwriting its type, including ambiguous successful saves.
Google supplies identity; users still provide workspace details and accept terms.

## Design

The native imagegen tool created `concept.png`; the exact prompt is in
`prompt.txt`. It is a layout reference, not a replacement logo or illustration.
The implementation retains the existing Blueprint AuthLayout, DM Sans, ivory
background, forest-green buttons, and current packing illustration. The native
tool does not expose a model selector or verifiable model ID.

Labels remain readable dark text, input text is 16px on mobile, choices have
large click areas, and fields use browser autocomplete. No dark dossier panel
is rendered. Tests cover both steps at desktop and mobile widths.

## Validation

Component tests cover email/Google completion, both roles, required consent,
existing account preservation, save retries, ambiguous saves, unfinished-account
recovery, and back-navigation values. Browser tests cover field count, preselected
role links, legibility, overflow, keyboard focus, and adjacent auth routes.
Existing workspace server tests verify authenticated account setup and terms.
No real account, Google login, task request, or external message is created in QA.
