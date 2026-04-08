# WebApp Architecture Graph Pilot

This workspace is the first runnable graphify-style pilot for `Blueprint-WebApp`.

## Purpose

The pilot is meant to map:

- Blueprint doctrine
- autonomous-org design
- Hermes KB structure
- agent runtime and automation orchestration code

into one derived, reviewable graph workspace.

## Tracked Files

This workspace intentionally tracks only the stable scaffold:

- this `README`
- `corpus.manifest.txt`

Generated artifacts are expected to appear under:

```text
derived/graphify/webapp-architecture/corpus/
derived/graphify/webapp-architecture/corpus/graphify-out/
```

and are ignored by git.

## How To Run

Prepare the staged pilot corpus only:

```bash
npm run graphify:pilot:webapp-architecture -- --prepare-only
```

Prepare the staged corpus and run graphify:

```bash
npm run graphify:pilot:webapp-architecture
```

Run with deeper inferred-edge extraction:

```bash
npm run graphify:pilot:webapp-architecture -- --mode deep
```

Run without HTML visualization:

```bash
npm run graphify:pilot:webapp-architecture -- --no-viz
```

## Promotion Rule

Nothing generated here is canonical.

If the pilot produces a useful finding:

1. review it
2. write a graph-audit report
3. promote only the verified finding into the correct canonical location
