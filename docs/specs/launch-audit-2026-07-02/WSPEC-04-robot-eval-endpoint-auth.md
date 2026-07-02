# WSPEC-04: Auth + rate limits on the robot-eval job-request endpoint

- Status: Proposed
- Priority: **P1 — major** (unauthenticated write path into the eval pipeline)
- Area: `server/routes.ts`, `server/routes/robot-eval-job-requests.ts`

## Problem

`server/routes.ts:77` mounts the router with no protection:

```ts
app.use("/api/robot-eval/job-requests", robotEvalJobRequestsRouter);
```

It sits above the CSRF-protected block and has neither `verifyFirebaseToken` nor rate
limiting; the handler (`server/routes/robot-eval-job-requests.ts:60`,
`router.post("/", ...)`) persists to a Firestore inbox and forwards to the capture
pipeline. Anyone on the internet can spam job requests — filling Firestore (quota cost),
triggering pipeline intake work, and polluting the ops inbox with fabricated demand
(doctrine: no fake operational states).

## Proposed fix

1. Decide the intended caller:
   - If buyer-facing: require `verifyFirebaseToken` + CSRF like sibling routes, and
     attach `requesterUid` server-side.
   - If a public lead-capture form: keep it unauthenticated but add per-IP rate limiting,
     an anti-bot measure (turnstile/captcha or signed form token), strict payload
     validation, and mark records `unverified_public_intake` so ops/pipeline treat them
     as leads, not authenticated demand.
2. Either way: add per-IP and global rate limits (the repo already has middleware
   patterns for this on other routes), payload size caps, and structured logging of
   rejects.
3. Forwarding to the pipeline should only happen after the record passes
   validation/verification — never synchronously trust raw public input into pipeline
   intake (pipeline side already requires an intake token; confirm this endpoint doesn't
   bypass ops review).

## Acceptance criteria

- [ ] Unauthenticated POST is either rejected (401) or accepted only as rate-limited, bot-checked, `unverified_public_intake`-flagged lead data.
- [ ] Load test: burst of requests from one IP is throttled with 429s.
- [ ] Pipeline forwarding occurs only for validated/verified records.
