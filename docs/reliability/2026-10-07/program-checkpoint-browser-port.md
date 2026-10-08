# Checkpoint browser contract correction and reload counterexample

This port preserves the original 12 intercepted-API browser cases and adds zero unique cases. It changes only test expectations and evidence documentation. Current production was not exercised or changed. Exact client overlay used for these executions: `88476cb8bb367573e8cf5d1664721e9fac71b8d8`; the four source fingerprints are in the JSON companion. Author production bytes were restored before this commit.

UI-CROSS-TAB-003 must reject an obsolete acknowledgement after another tab explicitly clears the old identity, preserve the complete fresh row in localStorage and IndexedDB, retain the fresh draft across reload, and dispatch a new job only through an explicit new Start with its new identity and body. The obsolete success-link assertion was incorrect after stricter checkpoint fencing and prevented reaching the original new-identity assertions. The port requires safe failure and absence of the old success link; it retains and strengthens those original assertions. An optional, unsubmitted recording grant must be unchecked after reload and explicitly granted afresh.

UI-CROSS-TAB-004 simulates unavailable Web Locks in actual Chromium. Hydration now blocks before displaying a form. The port asserts the supported-browser guidance, no form/Start/POST, and the actual `Talk to a person` link to `mailto:hello@tryblueprint.io`. It does not mistake an absent form for a fillable customer flow. Existing saved-link wording for a fresh visitor remains a P2 clarity issue.

The integration owner's original exact884 full run retained 10 passes and two partial failures. This author's first port selected run had one pass (004) and one failure (003). One diagnostic003 attempt failed, and the final minimized baseline-v2 attempt failed: four attempts total, one pass and three failures, covering the same two original cases. Counts are attempts, not independent coverage. The original remaining ten cases were unattempted in these selected runs.

The newly reached 003 failure is a real reload counterexample. Both mirrors preserve the complete fresh row before reload. After reload, ordinary visible fields/FormData still contain the four answers, but the canonical draft is empty. Mount `retainDraft()` runs while `interactive=false`; its fieldset is disabled, so FormData omits the controls and autosaves empty strings. On explicit Start the body has the visible answers while the retained snapshot is empty, and strict canonical validation rejects before a second POST. The final minimized baseline fails at the after-reload stored-draft equality assertion. Runtime repair belongs to the coordinator/cloud source owner; no runtime repair is included here. The independent reviewer's separate same-fields stale-Recover probe found no second POST, refuting that suspected duplication; the stale action remains a clarity issue.

Private native traces, screenshots, diagnostic attachments, logs and JSON results are under `output/reliability-program/checkpoint-browser-port/{selected,diagnostic003,baseline-v2}`. They contain only disposable synthetic identities; shareable fingerprints/counts are in the JSON companion. Preserve original failed receipts with bounded 30-day local retention. These intercepted API results establish UI/local-checkpoint behavior, not real backend, assessment, provider, email, or production correctness.

Replay the minimized baseline or repaired candidate in an isolated worktree with dependencies installed, the four exact client runtime files from the desired revision, and port 42879 free. Do not overlay another owner's checkout or reuse shared emulator ports. The runner starts and cleans its own local Vite child. No provider credentials or real notification transport is needed:

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" \
  RELIABILITY_INTAKE_OUTPUT=output/reliability-program/checkpoint-browser-port/replay \
  node node_modules/@playwright/test/cli.js test \
  --config playwright.reliability-intake.config.ts --grep 'UI-CROSS-TAB-00[34]'
```

Remove `--grep` for all 12 original cases. Final candidate evaluation remains pending the exact runtime repair; historical receipts must not be relabeled as that candidate.
