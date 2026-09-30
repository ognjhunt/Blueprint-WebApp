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
> services before claiming deployment. The doctor uses a dry-run push with
> local hooks disabled to test Git authentication without updating a branch.
> This does not prove a real push or a branch-protection bypass.

Save and publish (or republish), then verify in a **new task**. Existing tasks
retain their own environment snapshot. Confirm all live doctor checks, run
`npm run check` and the task's targeted tests, and verify the first authorized
branch push/PR. Installation or an offline doctor alone is insufficient.

The same commands can be used in a legacy Codex setup/maintenance script. For
platform-managed PR creation, use the supported PR control when available;
the doctor specifically verifies CLI release access.

## Dot setup and acceptance

Use the same published Blueprint WebApp environment when dot delegates coding
or Agents API setup. Dot's connected live computer is separate from the
authorized repository execution environment. Access granted to Claude or the
local Mac does not automatically propagate to dot's cloud task.

The current web entry point is
[Create a cloud environment](https://chatgpt.com/cloud-environments/new).
Select `ognjhunt/Blueprint-WebApp`, configure the installation and required
vault keys described above, and publish the environment. During review of this
PR, the new scripts are on `codex/agent-environment`; use merged `main` for the
final reusable environment.

Have dot launch a fresh coding task in that environment and retain the outputs
of `npm run cloud:doctor:release` and `npm run cloud:doctor:openai`. Neither a
connected-computer badge nor a local success proves that dot received the
credentials. Verify the actual authorized branch push and Agents API creation
separately when those actions are requested. Do not send credential values in
dot messages, copy all Mac secrets, or treat a ChatGPT scheduled task as an
Agents API agent.

For Pipeline access, configure the existing `operator-door` credential for
`paperclip.tryblueprint.io` using the supported secret flow and verify `whoami`
and `status` in dot's own task. A token with `read` scope suffices for diagnostics;
keep broader operations within the scope the owner approved. If dot's selected
computer cannot make authenticated HTTPS calls, connect an approved execution
environment or a bounded server tool before claiming server access.

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

## OpenAI and Agents API credentials

Claude's scene environment has a saved `operator-door` bearer credential for
`paperclip.tryblueprint.io`. Its proxy adds the real Authorization header after
requests leave the VM. The existing door runs fixed Pipeline operations with
provider credentials retained on the host; it does not expose OpenAI agent
creation. A working door credential therefore does not grant direct Agents API
access to a coding session.

For direct Agents API setup, request `OPENAI_API_KEY` as a **Network secret** in
the private Codex environment's vault, restricted to `api.openai.com`, and use
the supported vault entry flow to supply the existing project key. Allow that
host in the network policy. Send the value unchanged in `Authorization: Bearer`
headers; do not encode it, inspect it, or copy it into tracked files. The key
needs `api.agents.read`, `api.agents.write`, and `api.responses.write`; add vault
permissions only if the approved application manages vaults.

In a fresh cloud task, run:

```bash
npm run cloud:doctor:openai
```

This uses the HTTPS proxy and a read-only Agents API list request. It reports
only status, never credentials or session contents. Success proves read
access; agent creation and model execution require their own authorized
verification. On a trusted local controller, `OPENAI_API_KEY_FILE` can refer
to an existing mode-0600 credential file for this check without copying it.

For a self-hosted Agents API executor, retain the application's OpenAI key in
the controller. Create a separate restricted environment key and pass that
as `CODEX_API_KEY` to the executor, as required by
[OpenAI's authentication guide](https://developers.openai.com/api/docs/guides/agents-api/environments/self-hosted#authentication).
Persistent schedules and checkpoints belong to an approved hosted service;
publishing a coding environment alone does not create a continuously running
research agent.

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
