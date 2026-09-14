# Internal evaluation page preview

Owner-directed public-page design, with locally retained research episodes.
The owner confirmed on 2026-09-13 that this is internal only and that their own
captures will replace these videos before beta. Do not publish the research
clips, posters, or screenshots to the public repository or deployed website.

## Page and design

`/how-it-works#evaluation-example` holds a compact comparison between the two
introductory steps and the pilot recommendation. The existing homepage method
link jumps directly to it. The ivory/green palette, typography, rules, spacing,
and paired panels follow `how-it-works-concept.png`.

The concept was generated with the native Codex imagegen tool; `prompt.txt`
retains the prompt and `docs/design/site-led-concept.png` was the style reference.
The tool did not return a model identity; requesting Sunburst in a prompt is
not proof of its backend identity. Episode pixels are original recorded media,
not image-generated replacements. Posters are frames extracted from those clips.

## Exact run and selection

Source record: `capture-run-c257ae6e11a18e883637739477e5ded8`.
Run: `scene839873-artifixer-corrective-68d36be3-r13-web-20260901T031158Z-policy-canary-abe19c87-5997-4c7c-aedf-6d10fb6abd27`.

Six external-camera episodes from cells 00 (baseline), 02 (placement/approach),
and 04 (illumination). Both policies use the Franka/DROID embodiment. Cell 02
starts the cup 2 cm from baseline; initial task positions and seeds match within
each selected pair. The default selection is cell 02.

| Condition | pi05_droid | groot_n17_droid |
| --- | --- | --- |
| Baseline | Destination/height criteria missed | Destination/height/travel criteria missed |
| Cup shifted 2 cm | Destination/travel criteria missed | Pushed and settled; corrected criteria met |
| Lighting | Contact threshold and destination criteria missed | Settling criteria missed |

Outcomes come from the current verified `score_correction.correction.score_updates`
returned by the source result endpoint, not the superseded original 0/10 summary
or a learned visual interpretation. The scoring contract permits pushing and
does not require lifting. Controls were not verified; this does not declare a
winner, rank the policies generally, or establish physical performance.

Original video bytes were retrieved with read-only archive range requests,
validated against the archive member hashes, and independently matched to each
video descriptor in the published run. No policy or simulator was rerun.

## Local media and replacement

Original files and extracted posters are under the locally ignored directory
`client/public/proof/cup-evaluation/`. Each filename is
`<cell>-<pi05|groot>-external.mp4` or `<cell>-<pi05|groot>-poster.webp`.
The exact source bindings, corrected receipts, and hashes are retained locally
under `output/qa/public-eval/source/selected-provenance.json` and the private
Codex visualization artifact folder for this task. They are not public assets.

Before beta, replace these clips and update the condition descriptions, outcomes,
poster frames, and source attribution together. Use the new capture's own
success criteria and verified receipts; do not reuse this run's outcomes.

For this preview, start Vite on loopback port 5197. No API credentials are needed
for playback once the local media is present. The normal website deployment and
source result access permissions are unchanged. This work remains local and the
existing PR stays a draft.

## Validation

Eight Playwright checks pass: recorded outcomes and condition controls, keyboard
input, privacy explanation, homepage anchor, desktop/mobile layout, all six
original videos playing at native 1280px width, clean player reset on condition
switch, and recovery from an interrupted media load without changing scores.
Client TypeScript passes. All six video digests and sizes match the source run.
Graphify was attempted; its `graphifyy` dependency is unavailable locally.
