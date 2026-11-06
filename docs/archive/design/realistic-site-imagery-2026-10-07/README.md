# Realistic site imagery (founder-made, 2026-10-07)

Candidate photoreal scenes for the homepage examples and the How it works story,
kept here instead of `client/public/` so none of them ship until we choose to use them.

| File | Scene | Pairs with homepage example |
|---|---|---|
| `warehouse-biped-humanoid-tote-conveyor.webp` | Bipedal humanoid lifting a tote off a roller conveyor, people packing behind | Warehouse |
| `cafe-fixed-arm-dual-cups.webp` | Dual-arm robot on a pedestal filling cups beside a barista | Café |
| `factory-cobot-cnc-tending.webp` | Collaborative arm loading parts into a CNC machine while a machinist checks a part | Factory |
| `laundromat-bimanual-towel-folding.webp` | Two-armed robot folding towels on a counter, attendant bagging orders | Laundromat |

All are 1672×941 WebP.

Before any of these go on a public page:

- They are generated images, not Blueprint deployments. Label them as illustrations,
  the way the current task-evaluation pair carries "Illustrative example".
- Several robots resemble real commercial products. Do not imply a vendor relationship,
  a customer, or Blueprint-prepared work (see `CLAUDE.md`). Prefer captions that name the
  task, not the robot.
- Add the responsive `-840` variants and `width`/`height` like the existing
  `client/public/illustrations/task-evaluation/` assets.
