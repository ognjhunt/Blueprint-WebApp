# GitHub main-branch protection — intended configuration (2026-07-17)

Status: **BLOCKED_GITHUB_ADMIN_PERMISSION** from the automated remediation
session — the session's GitHub tooling has no branch-protection/ruleset
endpoints. A repository admin should apply this exact ruleset via
Settings → Rules → Rulesets → New branch ruleset. As of the 2026-07-17 audit,
GitHub reported **zero rules on `main` and no classic branch protection**.

## Ruleset: `main-protection`

- Enforcement: Active
- Target branches: include default branch (`main`)
- Rules:
  - **Restrict deletions** — on
  - **Block force pushes** — on
  - **Require a pull request before merging** — on
    - Required approvals: 1 when a second reviewer exists.
      *Known limitation:* this is currently a solo-maintainer repository
      (`ognjhunt` is the only collaborator), so a required independent
      approval would deadlock every merge. Until a second reviewer is added,
      set required approvals to 0 and rely on the required checks below; record
      this as an explicit governance limitation, not an equivalent control.
    - Require conversation resolution before merging — on
  - **Require status checks to pass** — on, strict (branch must be up to date):
    - `check` (typecheck, shared robot-eval contract, Firebase rules parity,
      asset audit, claims guard, dependency audit)
    - `rules-emulator` (Firebase security-rules emulator suite)
    - `test` (coverage suite + tracked-file mutation guard)
    - `e2e` (Playwright suites incl. brand polish + operator-surfaces QA)
    - `build` (build, build-output tests, isolated local launch smoke,
      headless hosted-session smoke)
- Bypass list: **empty**. Nobody bypasses to merge red code.

## Repository security settings (Settings → Advanced Security)

- Secret scanning: enabled (verified on in the 2026-07-17 audit)
- Push protection: enabled (verified on)
- Dependabot security updates: **enable** (was disabled at audit time)

## Merge methods

Keep a single merge strategy for auditability (squash or merge commit — pick
one and disable the rest) so the deploy gate's exact-SHA reasoning stays
simple.
