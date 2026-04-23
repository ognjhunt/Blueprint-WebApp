# BLU-3567 Status

- Issue: Route unblock path for Keep Durham buyer threads inside standard commercial handling
- Date: 2026-04-22
- Owner: ops-lead
- Status: done

## What I Checked

- Read the Durham launch system, the Durham execution issue bundle, the Durham intake rubric, and the current issue heartbeat context.
- Confirmed the Durham launch artifacts already require standard commercial handling for buyer threads, but the repo did not yet have a Durham-specific buyer-handoff rubric.
- Confirmed the current public pricing anchors exposed in `client/src/data/siteWorlds.ts` are still `Site Package` at `$2,100 - $3,400` and `Hosted Evaluation` at `$16 - $29 / session-hour`.

## Result

- Added `ops/paperclip/playbooks/city-buyer-handoff-escalation-rubric-durham.md` so Durham buyer follow-up now has a truthful standard-commercial routing path in repo truth.
- The commercial lane can now route standard Durham quotes against the published `Site Package` and `Hosted Evaluation` anchors and escalate only non-standard terms.
- The Paperclip child issue can be closed without changing the parent Durham launch blocker, because the parent still depends on real buyer signal or further commercial-policy work.

## Next Step

- Keep Durham buyer threads on the published standard paths and escalate only requests that change package shape, rights posture, or support scope.
