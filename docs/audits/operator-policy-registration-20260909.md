# Operator diagnostic result registration

ADP-009D, day-28 public-scene rehearsal. An operator may run a newly confirmed
task on previously published scene geometry. Existing canary submission would
launch a second run and bind the old task, so it cannot register this result.

The signed production-runner registration endpoint records the exact run,
task, policies, source scene offering, and input digests without queueing or
forwarding execution. Terminal publication checks its plan and registration
digests, preserves owner/team access, and uses the existing notification path.
The original offering is retained only for geometry/team provenance.

Explicit control omission retains its authority artifact and zero control
counts. The Website labels it as omitted at the user's request; it cannot
satisfy required controls or authorize qualification, ranking, or physical
success. Existing offering-based submissions keep their original checks.

Validation covers signed HTTP registration, missing signatures, idempotency,
immutable replay conflicts, owner/team isolation, result notification replay,
omission artifact and contract binding, and historical/verified controls.
TypeScript checking passes. Architecture graph refresh was attempted using the
default interpreter and the installed launcher's interpreter; both lack the
`graphify` package. Corpus staging succeeded; graph generation is not claimed.
