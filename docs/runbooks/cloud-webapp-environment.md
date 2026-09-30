# Blueprint WebApp cloud environment

Use one private, reusable WebApp coding environment with GitHub access. The
existing GitHub Actions workflow owns production deployment. Coding sessions
do not need `RENDER_API_KEY`, `RENDER_SERVICE_ID`, or
`RENDER_WORKER_SERVICE_ID` in their shell.

This setup removes the observed release-access blocker for partner intake and
evidence-review changes. It does not start research agents, send email, launch
GPUs, change Pipeline controls, or authorize merges. Existing scene work uses
[the scene environment](cloud-scene-runs.md).

## Codex setup

In Settings → Codex Cloud → Environments, create or edit **Blueprint WebApp**.
Select `ognjhunt/Blueprint-WebApp`, use `main`, and keep privacy **Only me**.

Install script, run from the selected checkout:

```bash
bash scripts/cloud/setup-webapp.sh
```

Set `BLUEPRINT_CLOUD_PROFILE=webapp`. Install Node 20 or newer in the image.
Installation is strict: missing tools or failed dependency installation must
be repaired before publishing. The setup installs WebApp dependencies and
headless Chromium; it does not install the Pipeline, torch, or a GPU runtime.

For normal builds and browser sign-in, add the public Firebase client values
as direct environment variables: `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and
`VITE_FIREBASE_APP_ID`. Use the intended development project's configuration.
These are browser configuration, separate from Firebase Admin credentials.
For a compile-only build that will never be served, the existing CI opt-out is
`BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1 npm run build`. Do not publish or
serve that build as a working sign-in experience.

Allow package-manager hosts plus these HTTPS destinations:

```text
api.github.com
github.com
objects.githubusercontent.com
release-assets.githubusercontent.com
cdn.playwright.dev
playwright.download.prss.microsoft.com
playwright.azureedge.net
tryblueprint.io
```

Connect GitHub for the selected repository. If the session must push or create
PRs through `git`/`gh`, request `GH_TOKEN` in the environment and supply it
through **Personal vault → Environment variable**, applying it only to this
private environment. Git's credential helper needs a directly readable value;
do not assume that a proxy placeholder survives Git's credential encoding.
Use a repository-scoped token with Contents read/write, Pull requests
read/write, and Actions read; add Workflows write only for workflow edits.
Repository access and network reachability are separate checks. A GitHub
connector in another chat does not establish CLI authentication here.

In an isolated cloud clone, configure the supported CLI credential helper:

```bash
git remote set-url origin https://github.com/ognjhunt/Blueprint-WebApp.git
gh auth setup-git --hostname github.com
node scripts/cloud/release-doctor.mjs
```

Do not copy a Mac keychain or credential directory into the environment. Do
not embed tokens in Git URLs, setup scripts, prompts, or tracked files. A direct
value is readable by session code, so scope it to this repository and keep the
environment private. Network secrets are preferable for API-only requests:
they supply placeholders and inject credentials for allowed HTTPS destinations,
but cannot provide a real local value for credential encoding or Firebase JWT
signing. Validate the chosen credential path in a new session.

Use this as the environment's Start skill/instructions:

> Read AGENTS.md and the required repository guidance. Run
> `node scripts/cloud/release-doctor.mjs` before promising CLI push, PR, merge,
> or deployment work. Resolve failed access checks first. Use the existing
> CI-gated deploy.yml workflow; unset local Render variables are expected.
> Preserve unrelated changes. Merge only when authorized and checks pass;
> verify the deployment artifact for the exact merged SHA and both Render
> services before claiming deployment. A successful read-only git probe does
> not prove a push or a branch-protection bypass.

Save and publish (or republish), then verify in a **new task**. Existing tasks
retain their own environment snapshot. Confirm all live doctor checks, run
`npm run check` and the task's targeted tests, and verify the first authorized
branch push/PR. Installation or an offline doctor alone is insufficient.

The same commands can be used in a legacy Codex setup/maintenance script. For
platform-managed PR creation, use the supported PR control when available;
the doctor specifically verifies CLI release access.

## Claude setup

Create a WebApp-only environment or reuse the WebApp setup above. Set
`BLUEPRINT_CLOUD_PROFILE=webapp`, use the same HTTPS access and GitHub token
scope, and call `setup-webapp.sh` from its checkout. The repository's
SessionStart hook runs the release doctor for this profile. The default
scene profile retains its existing bootstrap.

Do not reuse the screenshot's exposed Firebase service-account key for a new
environment. Replace that key in the existing scene environment through the
supported credential flow, verify a new session, then revoke the old key.
WebApp coding and mocked tests need no production Firebase Admin key.

## Deployment and verification

The repository owner can audit the deployment configuration without reading
secret values:

```bash
node scripts/cloud/release-doctor.mjs --audit-deploy-config
```

This requires access to Actions secret/variable metadata; normal coding tokens
need not have it. The report distinguishes denied metadata access from proven
missing configuration. Secret presence alone does not establish validity.

`deploy.yml` runs after green main CI, pins the exact SHA, verifies web and
worker deploy records, then checks `/version.json`, `/health`, and
`/health/ready`. Inspect its `deploy-verification` artifact. The doctor checks
access and workflow state; it does not deploy or certify a future release.

An environment-creation HTTP 403 belongs to the OpenAI account/workspace setup
boundary. Check the active workspace's cloud access and environment-management
permissions. Provider keys and server restarts do not repair that denial.

A coding environment is also separate from a continuously hosted research
worker. Use the existing Render worker for approved durable jobs and the
authenticated Pipeline operator door for Pipeline operations; do not install
a general coding executor on the production Pipeline host to bypass access.

Official setup reference:
[OpenAI cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments).
