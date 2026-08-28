# Capture Day — protocol DRAFT (partner-facing §1–5; internal operator checklist §6)

*The capture visit is the only part of the service the partner physically experiences.
It should feel like a well-run inspection: short, scheduled, respectful of the site, and
visibly careful about what is and isn't recorded.*

---

## 1. What we capture, in plain terms

Two passes of the one workcell, with a phone-based capture rig — no fixed installation,
no cabling, nothing left behind:

- **Clean-background pass:** the cell without the task objects present.
- **Object-present pass:** the same cell with the task objects staged as they are on a
  normal day.

Both passes are registered against each other; together they are the complete input. We
do not roam the facility: the capture scope is the workcell and the approach to it, agreed
in writing before the visit.

## 2. What we need from the site (one page to return before the visit)

- A 2–4 hour access window with the cell out of production, and a named escort.
- The task objects available for staging, plus whoever owns "what counts as success."
- The no-capture list: people, products, signage, or equipment that must never appear.
  We plan camera paths around them; anything that slips through is suppressed in
  processing and covered by takedown rights (see the data-handling one-pager).
- Any badging/safety training requirements ahead of time so the window isn't spent in a
  lobby.

## 3. What the day looks like

| When | What | Partner involvement |
|------|------|---------------------|
| T-0:00 | Walkthrough: confirm scope + no-capture list against the room | Escort, 10 min |
| T-0:15 | Clean-background pass | None — cell stays clear |
| T-1:00 | Stage task objects; confirm normal-day placement | Task owner, 10 min |
| T-1:15 | Object-present pass | None |
| T-2:00 | On-device QA review; re-shoot any thin coverage immediately | None |
| T-2:30 | Depart. Nothing installed, nothing left running | Escort sign-out |

The immediate on-device QA review is the point of the schedule: a re-shoot while we're
standing there costs twenty minutes; discovering thin coverage after we leave costs a
second visit.

## 4. What happens next

Reconstruction and testbed build begin the same day. Turnaround from capture to the run
report is a **target** we engineer toward (12–24h design target), and the partner gets a
named contact plus status at each stage rather than a silent gap.

## 5. What the partner never has to do

Learn our tools, host our hardware, export their CAD, or clean their facility to a
showroom standard. A normal working cell is the correct input — the capture is of the
site as it actually is.

---

## 6. INTERNAL — operator checklist (do not send)

**Before the visit**
- [ ] Scope + no-capture list countersigned; consent record created *before* any frame is
      captured (consent machinery is fail-closed — a missing consent record blocks the
      pipeline downstream, so capturing without it wastes the visit).
- [ ] Capture app on the current build; storage headroom ≥ 2× last comparable site;
      battery bricks; spare phone.
- [ ] Print the two-pass shot plan for the cell class (approach arcs, loop closures,
      handle/fixture close-ups for any articulated mechanism — rim/handle geometry at
      multiple heights; the arena campaign proved handle-lip geometry is decision-load-bearing).

**During capture**
- [ ] Clean-background pass FIRST, always (registration depends on it; the pair must be
      registered, not just both present).
- [ ] Slow arcs, high overlap; close every loop; capture the task mechanism through its
      motion range where safe (door open AND closed states for articulated tasks).
- [ ] On-device QA before leaving: coverage map has no holes around the task fixture;
      registration sanity on the paired passes; re-shoot immediately if thin.

**After capture**
- [ ] Ingest same-day; run capture QA (registration rate, coverage) before releasing the
      escort thank-you note — if QA fails, schedule the re-visit within 48h while access
      logistics are still warm.
- [ ] Consent + rights receipts attached to the capture root before reconstruction
      starts; no-capture-list items verified suppressed in the first render.
- [ ] Log actual timestamps at each stage — every real capture builds the evidence that
      lets "target" become a measured service level (the copy rule: promote the wording
      only when telemetry supports it).
