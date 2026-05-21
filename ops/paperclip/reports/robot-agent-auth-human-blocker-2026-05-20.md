# Robot Agent Machine Auth Human Blocker Packet

## 1. Blocker Title

Provision scoped robot-team machine credentials for protected headless hosted-session access.

## 1a. Blocker Id

`human-blocker:robot-agent-machine-auth-2026-05-20`

## 2. Why This Is Blocked

The repo now has public docs, OpenAPI, CLI, MCP, and a mock headless smoke path. Protected site worlds still require the existing Firebase bearer flow and `buyerType === "robot_team"` or admin authorization. Creating a new production machine credential would affect access control and audit posture, so the agent cannot safely invent it or bypass Firebase.

## 3. Recommended Answer

Approve a scoped robot-team machine credential plan that maps to Firebase/Admin-verified identity, preserves the current robot_team/admin gate, and logs session creation/reset/step/batch/export calls with the calling integration identity.

## 4. Alternatives

- Keep protected agent access on short-lived Firebase ID tokens only.
- Limit the agent layer to public-demo and local mock use until a buyer integration exists.
- Add a separate service-account adapter later after a security/procurement review.

## 5. Downside / Risk

A machine token that bypasses Firebase or buyer profile checks could expose protected site worlds, package details, or runtime operations to the wrong integration. Overly broad credentials would also make session actions harder to audit.

## 6. Exact Response Needed

Confirm one of these options:

- `approve-firebase-scoped-machine-token`: implement a scoped bearer credential that resolves through Firebase/Admin and robot_team/admin checks.
- `firebase-id-token-only`: keep protected CLI/MCP use on user-provided Firebase ID tokens for now.
- `public-demo-only`: keep headless automation limited to public demo and mock flows.

## 7. Execution Owner After Reply

`webapp-codex`

## 8. Immediate Next Action After Reply

If approved, implement the selected credential path without weakening `server/routes/site-world-sessions.ts` launch access checks, then add route tests proving non-robot-team users still receive `403 forbidden`.

## 9. Deadline / Checkpoint

Before any external robot-team integration receives protected hosted-session access.

## 10. Evidence

- Public docs route: `/agents`
- Contract source: `server/utils/robot-agent-contract.ts`
- CLI/MCP source: `scripts/agent-access/`
- Existing protected gate: `server/routes/site-world-sessions.ts`
- Auth middleware: `server/middleware/verifyFirebaseToken.ts`
- Safe proof command: `npm run smoke:agent-headless`

## 11. Non-Scope

This does not authorize live provider spend, Stripe/payment mutation, production deployment, broad package access, rights clearance, export approval, or a second primary auth stack.
