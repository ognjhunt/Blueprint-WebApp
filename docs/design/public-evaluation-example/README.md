# Public evaluation example

Owner-requested public page on How it works, with a direct homepage link.
The owner explicitly requested public playback of these exact videos before
merging. Preserve the research framing, source attribution, and exact outcomes.
This does not make the source scene a customer capture or physical proof.

## Design

The ivory/green palette, typography, rules, spacing, paired panels, and compact
condition controls follow `how-it-works-concept.png`. The concept was generated
with the native Codex imagegen tool using `docs/design/site-led-concept.png` as a
style reference; `prompt.txt` retains the exact prompt. The tool returned no
model identity, so the requested Sunburst backend is not independently confirmed.
Episode pixels are original recordings, not image-generated replacements.

## Exact run and selection

Source: https://tryblueprint.io/app/results/capture-run-c257ae6e11a18e883637739477e5ded8

Six external-camera episodes: cells 00 (baseline), 02 (placement/approach), and
04 (illumination). Both policies use the Franka/DROID embodiment. Cell 02 starts
the cup 2 cm from baseline; recorded initial positions and seeds match within
each pair. It is selected by default.

| Condition | pi05_droid | groot_n17_droid |
| --- | --- | --- |
| Baseline | Destination/height criteria missed | Destination/height/travel criteria missed |
| Cup shifted 2 cm | Destination/travel criteria missed | Pushed and settled; corrected criteria met |
| Lighting | Contact threshold and destination criteria missed | Settling criteria missed |

Outcomes use the current verified correction sidecar, not the superseded 0/10
summary or learned visual interpretation. This scoring contract permits pushing
and does not require lifting. The page states that controls were not verified
and that these selected outcomes establish neither a winner nor physical
performance. It describes evaluation variations without claiming these six
clips are a full test campaign.

## Media and replacement

Files are in `client/public/proof/cup-evaluation/`; the public `provenance.json`
retains each policy/cell/seed, source descriptor hash and size, and corrected
outcome. Original bytes were recovered through read-only archive range requests,
checked against the archive member hash, then independently matched to the
published result's video descriptor. Posters are extracted source frames.
There are no signed URLs, private storage credentials, or result API dependencies
in the page. Videos load on demand with native controls; changing conditions
remounts the players and prevents old footage from continuing under new labels.

The source scene is InteriorGS, attributed on the page. Its standard terms limit
dataset use to noncommercial research and education; no broader rights clearance
is asserted by this implementation. The owner intends to replace these research
videos with their own capture recordings before beta. Replace clips, posters,
condition descriptions, outcomes, and provenance together rather than carrying
these results onto a different task.

## Validation

Eight browser checks cover condition outcomes, keyboard input, privacy text,
homepage anchor navigation, desktop/mobile layout, all six original videos
playing at their 1280px native width, player resets, and failed-load recovery.
The build-output suite requires the prerendered video example and all twelve
media/poster files. Every original video hash and size matches its source run.
Graphify was attempted; the local interpreter lacks `graphifyy`.
