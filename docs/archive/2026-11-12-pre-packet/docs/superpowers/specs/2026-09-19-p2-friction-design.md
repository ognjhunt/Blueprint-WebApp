# P2 friction and fragmentation: design (2026-09-19)

Bare-bones implementation of the P2 items in
`docs/onboarding-time-to-value-audit-2026-09-19.md`, on top of Astra's P1
branch (`codex/onboarding-p1`, browse-before-checkpoint, device handoff,
capture page, committed update times) and the P0 loop work. Amendments from
the review discussion are kept: forms stay allowed on phones, an account is
offered rather than withheld, and nothing is measured that was not measured.

## Item 8. Prose before the first field

Site page: the heading and one line, then the capture form, then a closed
"How this works" disclosure holding the geography and screening prose. The
six-question screening form is removed from the public page; "Talk to a
person" is a mail link. Robot page: P1's browse page already leads with the
library; a cross-link to the site page is added so both personas point at each
other, as the brand-polish contract requires.

## Item 9. One design system

`/sites` is already minimal on P1. `/claim/:token` moves into the same auth
shell as sign-in and sign-up. The runway header now serves only capturer and
ops pages, which are not part of these funnels; `/sites/:slug` stays as the
legacy pipeline-record view that the configured-scene spec depends on.

## Item 10. Country from the address

The location autocomplete reports the chosen suggestion's country code. The
country control moves under the address and is set from the pick; it stays
visible as one tap to correct, because it decides whether footage may be
collected at all.

## Item 11. Sign-up attaches to the funnel

A site that creates an account lands on the capture form, not a nine-field
duplicate intake. `/app/tasks/new` becomes a pointer to that form. A robot
team lands on the task library. The workspace keeps its task pages, results
table and pilot feed; it stops being a second front door.

## Item 12. The robot's facts, in two taps and one link

The plan form asks two deployment facts a simulation cannot measure: whether the hardware exists today, and whether the team would deploy
in the Austin metro. Both are stored on the team at `self_reported` grade,
so `compareGeography` stops returning "unknown" for every self-serve team.
An optional website or spec-sheet URL is stored as the team's `website`,
which the existing capability-refresh lane already reads into proposals a
person promotes. Embodiment is stored as a structured field rather than glued
into free text. The six-question robot application is gone from the public
page; those questions belong to the pilot conversation.

## Not built

Datasheet parsing on the form itself, a unified projection for the workspace
pilot feed, and restyling the capturer pages.


## Review corrections

The selected address resolves country from Google Place Details as well as
Photon. Unknown country is empty; manual address edits invalidate inference.
The signed-in capture path binds the new draft to Firebase identity and uses
one request ID across retries. Claiming existing work still verifies the owner
email, supports verification recovery, and makes no unproven scene-ready claim.
Task and signed-claim context survives signup through a validated local return
path. The two human robot answers are required but retain self-reported grade;
the agent registration API keeps optional fields for compatibility.

The outstanding lifecycle-email portion of item 7 is included in this closeout:
video received, a viewable scene ready, and worker pickup of evaluation. The
existing outbox supplies deduplication and delivery; no new service is added.
