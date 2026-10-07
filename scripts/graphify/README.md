# Graphify setup

Run the existing required command from any checkout:

```bash
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

The runner automatically installs the pinned dependencies in `requirements.txt`
into `.graphify_venv/` on first use and selects that interpreter. Future sessions
reuse it without activation, PATH changes or a saved environment variable. A new
checkout, Python version or requirements revision gets its own environment.
The environment is ignored by Git and graph extraction. The checked-in setup,
dependency pins and CI smoke remain the portable source for rebuilding it.

First use requires Python 3.10+ with `venv`/`pip` and access to PyPI. To provision
before entering an offline session, run `npm run graphify:setup` in the checkout.
Repeat runs with a ready environment require no package downloads. Setup uses a
lock so concurrent agents do not install over one another; failed installations
are retried on the next run and never recorded as ready.

`BLUEPRINT_GRAPHIFY_PYTHON` remains an optional explicit interpreter override.
It is never modified. If it is missing or cannot import the required AST helpers,
the runner falls back to automatic pinned setup. `--help`, `--prepare-only` and `--publish-only` do not install
dependencies. If the managed environment is damaged, the next run repairs it;
if Python or package-download access is unavailable, restore that prerequisite
and retry the same command.

The official package is [`graphifyy`](https://pypi.org/project/graphifyy/), while
its import and CLI are named `graphify`. This setup installs only the local AST
dependencies. It does not register assistant skills or hooks, change global
Python, configure providers, send code to a service, or run semantic/paid models.
Graph outputs remain local derived navigation artifacts under `graphify-out/`
and `derived/graphify/`, governed by the existing corpus policy.
