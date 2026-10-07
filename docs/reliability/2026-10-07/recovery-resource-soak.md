# Optional bounded outbox recovery resource soak

This is a separate heavy test tier, intentionally outside ordinary Vitest discovery. It measures the actual outbox implementation with fake Firestore/provider sinks, in one warmed process. It does not establish live provider memory use, Firestore scaling, production throughput, or absence of long-term leaks.

```bash
NODE_OPTIONS="--require=$PWD/server/tests/helpers/deny-outbox-network.cjs" \
BLUEPRINT_RECOVERY_SOAK_REPORT="$PWD/work/recovery-soak.json" \
node node_modules/vitest/vitest.mjs run --config vitest.recovery-soak.config.ts
```

Create the report parent directory first. The dedicated config starts exactly one Node fork with exposed GC and a 30-second test timeout. In a separately constrained container, also set `BLUEPRINT_RECOVERY_SOAK_EXPECT_MEMORY_MAX_BYTES=536870912`; the runner requires the observed cgroup limit to match, requires available cgroup observations, and checks peak memory below 90% of that limit. The root coordinator owns the container command, image provenance, limits and results. A normal workspace run reports its ambient cgroup and must not be described as an isolated 512 MiB run.

## Fixed protocol and criteria

The protocol and thresholds were written before the first measurement. One 64-case warm-up round is followed by eight measured 64-case rounds. Each round repeats eight scenario kinds eight times: accepted overlapping callers, known rejection then acceptance, unknown returned outcome, thrown transport error, pre-dispatch write failure/recovery, acceptance-write failure/unknown quarantine, expired pre-dispatch claim, and cancelled retired notice. This is **512 measured repeats plus 64 warm-up cases**, not 512 distinct failures or additional distinct concurrency schedules.

Each case asserts the terminal/unknown state, exact provider-call count and attempt count, and zero pending/claimed/dispatching rows before fixture cleanup. Unknown outcomes remain retained until the test deliberately clears its in-memory fixture; they are not automatically resent. Fake-store reset models a remote database and is not a production deletion/recovery action. Each round reports the maximum fixture size, provider calls and count of verified unknown rows.

After every round, explicit GC precedes a sample of RSS, heap total/used, external memory, array buffers, open FD count, test-owned temporary files/bytes, queue storage, and cgroup current/peak/limit/anonymous/file memory plus events. TMPDIR is redirected to the owned directory during the workload. Startup caches and unrelated temporary directories are outside that metric. Cgroup counters cover the entire execution cgroup, including the test launcher; they are only isolated when the coordinator runs an isolated container.

Fixed pass criteria, relative to the post-warm-up baseline:

| Signal | Final increase ceiling | Least-squares slope ceiling |
| --- | ---: | ---: |
| Heap used | 8 MiB | 1 MiB/round |
| RSS | 32 MiB | 4 MiB/round |
| External memory | 4 MiB | 0.5 MiB/round |

Every sample additionally requires FD growth at most two, zero owned temporary files/bytes, and zero fake-store rows between cases. OOM and OOM-kill event growth must be zero when available. When a container limit is explicitly required, cgroup peak must be at most 90% of the observed limit. The short-run criteria allow positive bounded growth; passing does **not** establish a plateau or leak-free runtime. Explicit GC measures retained state, not allocation peaks; cgroup peak complements that measurement at container scope.

The runner emits `blueprint.outbox_recovery_resource_soak.v1` JSON, including criteria, scenario names, every round/sample, derived trends, exact Node version and limitations. It writes the same JSON to the optional report path. Save that artifact and command output with the coordinator's container evidence; assertions failing after report assembly retain `passed:false`.

Local initial validation passed on Node v24.19.0: one test, 576 cases including warm-up. The ambient-workspace run showed positive retained heap growth (~1.60 MiB across eight measured rounds) below the predeclared threshold, not a flat-memory claim. Isolated container observations belong to the coordinator's separate measured artifact. No production source was changed, no live provider was contacted and no deployment was performed.

## Coordinator's isolated final measurement

The coordinator ran the final runner from `54aa013e3` with Docker networking disabled, memory and memory-swap limits both 512 MiB, one CPU, and 128 PIDs. The local Node 24 image digest was `sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20`; observed runtime was **Node v24.21.0** on Linux x64. No credentials or live provider were needed. The 512 MiB limit is a chosen fixture constraint; this measurement does not verify the deployed Render process limit or native production resource use. The expected cgroup limit was explicitly set to 536,870,912 bytes and checked by the test.

The retained result is [recovery-soak-512m.json](./recovery-soak-512m.json), schema `blueprint.outbox_recovery_resource_soak.v1`, SHA-256 `e32104890de939d53581e5a5b2c33057059067cfb58a2420472d2438edfd0fdb`. It contains every baseline/round sample and all predeclared criteria.

| Signal | Post-warm-up baseline | After eight measured rounds |
| --- | ---: | ---: |
| Process RSS | 104,435,712 B | 106,401,792 B |
| Heap used after GC | 33,824,856 B | 35,509,104 B |
| External memory | 4,431,019 B | 4,430,672 B |
| Open FDs | 20 | 20 |
| Cgroup anonymous memory | 149,762,048 B | 151,719,936 B |
| Cgroup file memory | 1,245,184 B | 1,245,184 B |

Observed cgroup lifetime peak was **160,497,664 bytes (153.1 MiB)**, below the checked 512 MiB cap and the 90% criterion. OOM/OOM-kill/max events were zero. All nine samples reported zero owned temporary files/bytes and zero fake-store rows after fixture reset. Measured heap slope was +205,039.2 bytes/round; RSS slope was +233,745.1 bytes/round. These positive slopes passed the predeclared bounded-growth criteria and do not establish a flat plateau.

The 576 total cases (64 warm-up plus 512 measured repeats) passed in approximately 1.616 seconds including warm-up; the complete Vitest command took 2.91 seconds. This is a seconds-long isolated fake-provider recovery check, not sustained production or long-running provider feasibility evidence. Its value is a repeatable resource ceiling and retained-state regression check for this specific path.
