# Preserve inventory evidence during owner edits and removal

After the first-read initializer repair, inspection found the same lost-update pattern in `upsertItem` and `removeItem`: both loaded an inventory, changed their copy and replaced the stored record. A photo transaction or another owner's edit accepted after that read could be silently erased. Separately, the whole-record storage helper returned successfully when the database was unavailable, allowing an unsaved mutation to be reported as accepted.

Owner edit and removal now run in a Firestore transaction. Each callback reads the latest inventory, normalizes legacy item defaults and reapplies only the requested operation. A conflict retries against the newer photo/owner record. The generated ID for a new owner item and the operation timestamp are selected outside the callback, so replay of that callback cannot invent another item identity. Merge writes retain unrelated top-level fields; current images and Pipeline-owned asset status remain in the read inventory. Database absence fails explicitly. The existing signed owner/film route authorization and photo transaction are unchanged.

`saveItemInventory` remains an explicit whole-record save helper, used by fixtures rather than the inspected production routes; it now also rejects missing storage. Production first-read initialization uses the create-only helper, owner edit/removal use transactions, and photo registration retains its existing authority-checked transaction. This is not a claim that arbitrary external writers obey those contracts.

## Evidence

`server/tests/task-item-mutations.test.ts` exercises the real inventory utility functions with a deliberately bounded optimistic-conflict fixture. Unlike the shared serial fake, it snapshots document versions, stages writes, rejects reads after writes and reruns a callback after a concurrent commit. It is not a general Firestore emulator or a live-contention proof.

The six cases failed before the mutation repair:

1. Owner edit paused after reading, then a photo is accepted for that item; the late edit must retain the photo and measured asset status.
2. Owner removal paused after reading, then a photo is accepted for a surviving item; removal must retain that photo and remove only its requested item.
3. Two additions overlap; both survive, and the first operation uses one identical generated ID in its two staged callback attempts.
4. Edit with unavailable database rejects instead of claiming acceptance.
5. Removal with unavailable database rejects instead of claiming acceptance.
6. Whole-record save with unavailable database rejects instead of silently returning.

The three conflict cases assert exactly three callback invocations: the competing writer once and the delayed owner twice. The tests preserve an unrelated legacy receipt field as well as photo/asset evidence. For the initializer's actual installed-SDK `exists:false` proof, see `task-item-initialization.test.ts` and `item-initialization.md`.

After the repair, **32 passed across four files**: mutation 6, route 11, pure inventory 10 and SDK initializer 5. TypeScript, required Graphify refresh and diff whitespace checks passed. Local logs are `work/item-mutations-before.log`, `work/item-mutations-after.log`, `work/item-mutations-typecheck.log` and `work/item-mutations-graphify.log`.

```bash
NODE_OPTIONS='--require /workspace/work/reliability-baseline/deny-egress.cjs' \
BLUEPRINT_TEST_EGRESS_LOG=/workspace/work/backend-contracts/work/items-egress.jsonl \
node node_modules/vitest/vitest.mjs run \
  server/tests/task-item-mutations.test.ts \
  server/tests/task-item-routes.test.ts \
  server/tests/task-item-inventory.test.ts \
  server/tests/task-item-initialization.test.ts --maxWorkers=1 --minWorkers=1
```

All sinks are local mocks; route listeners use loopback and the preload blocks external egress. No external attempt was recorded. No live database, storage, model, messaging, deployment or paid operation was invoked. The root coordinator owns integration and release; independent review must examine this follow-up separately from the initializer commit.
