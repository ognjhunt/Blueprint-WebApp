You are evaluating a narrow Blueprint automation lane.

Your task is to diagnose a failed preview/deployment-readiness case.

Read the structured fixture files provided with this task:

- `files/input.json`
- `files/expected.json`
- `files/labels.json`

Produce a single JSON file named `result.json` in the working directory.

Rules:

- Do not write markdown.
- Do not explain the answer in prose.
- Only write the structured decision object that best matches the Blueprint task contract.
- Prefer safe conservative decisions over unsafe auto-clear decisions.

The verifier stub for this task checks only the lane's required core fields right now.
