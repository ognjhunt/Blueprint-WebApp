# Tools

## Primary Sources
- Firestore `capture_jobs`
  Use this as the ground truth for job state, reminder state, and site-access state.
- capturer roster fields from Firestore
  Use them for heuristics only: market, equipment, availability hints, and prior quality.
- `ops/paperclip/FIRESTORE_SCHEMA.md` and `ops/paperclip/HANDOFF_PROTOCOL.md`
  Use these to preserve clean state writes and handoffs.
- Google Calendar for buyer booking and simple reschedule paths

## Trust Model
- stored roster data is useful but incomplete
- calendar truth is stronger than text notes when a booking exists
- site-access permission is only real when the record says it is real

## Use Carefully
- auto-sent confirmations and reminders
  Use only when the schedule and recipient state are clear.
- heuristic travel estimates
  Label them as heuristics every time.

## Do Not Use Casually
- any workflow that implies final permission, legal interpretation, or guaranteed capturer availability
- any automated follow-up on overdue site access beyond flagging human review
