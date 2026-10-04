# Robot Team Intelligence

Two saved research agents share the existing Firestore `robotTeams` directory:

- **Discovery:** weekly searches for new hardware, software, full-stack, world-model, learned-policy and manipulation/component teams. Signals include announcements, funding, emerging from stealth and substantive releases.
- **Refresh:** weekly checks of existing teams and a deeper monthly review. It pages the complete directory, checks previous evidence and retains both meaningful changes and unchanged checks. Teams need not fit only one category.

The proposed calendar is Monday at 9am America/Chicago for weekly work and the first of each month at 9am for monthly work. The owner-controlled settings can change these times. A missed scheduled time catches up within its calendar period; a polling tick does not create another daily job. Discovery and refresh are separate durable jobs, and only one paid run is active at a time.

This lane has its own paused configuration and worker flag. It does not change the existing 7am sites-first research, communications, mailbox, $10 research/comms authority or sending settings. Code availability is not proof that saved agents have been created or weekly work activated.

## Agent behavior

1. Read existing team records and their dated change/check history.
2. Choose searches and filters based on the question, recent results, missing information and promising task hypotheses.
3. Search the web and inspect sources. The agent chooses relevant teams; no fixed result shortlist or prospect quota is supplied.
4. Fetch full public team records before judging compatibility. Funding, demos and similarity do not establish physical capability, deployment or a Blueprint relationship.
5. Save useful public evidence through `save_robot_team_update`. The tool fetches the quoted sources independently, retains hashes/original text, returns actionable field issues and preserves supported siblings. It never replaces measured/self-reported capability with weaker public material or changes account/relationship status.
6. Record checks and return a report with actual coverage, changed capabilities, conflicts, unknowns and useful task hypotheses.
7. Missing coverage/report is returned to the same session as feedback while its original execution window remains. A disconnected observer reconnects to that session. Unknown creates cannot trigger another create, and lost tool acknowledgments reconcile exact retained results before any stable-key result replay.

There is no routine human proposal-approval queue for these sourced directory updates. The existing intake/evaluation registry retains its separate behavior. The new agents have no message-sending, account-creation or arbitrary database-write function.

## Retrieval and embeddings

`search_robot_teams`, `fetch_robot_team` and `read_robot_team_history` are reusable host tools. Search supports categories, embodiment, task, geography, news type and change date. An empty query browses the directory with stable cursors, including beyond 200 records. Wheeled-humanoid/mobile-manipulator and CNC/machine-tending aliases improve keyword search.

Optional semantic retrieval reuses the existing company-owned history index, normally with **`text-embedding-3-small`**. Exact filters apply first; semantic and keyword relevance help the agent select records to inspect. Only changed public projections need new vectors. Source/text/model/dimension hashes exclude stale vectors, and failures fall back to keyword/filter search with diagnostics.

Semantic search starts off. Turning it on requires both this lane's setting and valid retained embedding settings at `blueprintResearchLearning/default/historySearchSettings/current`. Credentials or model arguments cannot grant spending authority. The current embedding helper returns vectors without paid-usage receipts; that uncertainty remains explicit. Similarity is never a measured capability or matching decision.

The current daily research worker's frozen history profile is not silently broadened by this release. To use these directory tools in another agent, its authenticated host must explicitly register them with its retained directory read scope. Existing history snapshot access alone does not imply access to all live teams.

## Prepare the saved agents

Preview is local and makes no provider/database calls:

```sh
node --import tsx scripts/agents/setup-robot-team-intelligence.ts
```

The existing release/configuration owner can provision only these two new saved definitions using the runtime's existing key/project:

```sh
node --import tsx scripts/agents/setup-robot-team-intelligence.ts --apply --project EXISTING_PROJECT_ID
```

The script durably claims each creation, reads back the saved IDs/configuration and creates a **paused** root. An uncertain acknowledgment is reconciled from the original metadata rather than creating another agent. No key, vault, credential, live session, access grant or budget is created. The definitions live under `robotTeamIntelligence/default/definitions/{discovery,refresh}` and their instructions also remain in company-owned GitHub source.

Optional MCP connections can be added to these saved agents later. Prospective sessions freeze the current owner connections and attach only their matching existing singleton vaults. Set the exact public-read tool subset in the retained `mcpReadTools` settings; absent scope does not expose every service tool. Directory updates continue through the typed company writer. Secret headers and unrestricted mail/database mutation profiles are not copied into this lane.

## Activation and evidence

The root `robotTeamIntelligence/default` must validate against `intelligenceControlSchema` before paid admission. Activation requires actual retained directory read/update authority, an unexpired robot-intelligence spending authority with daily soft allocation/per-run reservations, saved agent IDs, project, first date and calendar. The existing $10 research/comms direction is not automatically a budget for this additional weekly work. Enable `BLUEPRINT_ROBOT_TEAM_INTELLIGENCE_ENABLED` only through the existing release owner after review. The generic automation flag does not enable it.

The worker polls every 30 seconds, observes the existing durable job and admits work only when a weekly/monthly period is due. Reservations and missing/partial receipts remain visible; token receipts and soft envelopes are not provider invoice proof. Disabled/expired access still permits observing the already-bound run; it cannot execute functions, submit corrections or create work. The original run's deadline has a separately claimed one-use cancellation followed by GET retirement.

Before claiming live readiness, verify saved-agent readback, authenticated source/search tools, one source-backed directory update, exact history/check readback, a later agent consuming that evidence, complete directory coverage and the natural scheduler trigger. No live readiness, paid embeddings or native MCP authentication is established by mocked tests.

## Canonical storage and portability

- `robotTeams/{team_id}`: current company-owned directory. Research-created teams are domain-deduplicated prospects; intake/account identity and private fields remain intact.
- `robotTeamIntelligence/default/changes/{sha256}` and `/checks/{sha256}`: content-addressed updates/checks, original dates, source provenance and public before/after hashes. Corrections retain prior records.
- `robotTeamIntelligence/default/sources/{raw_sha256}` plus `/chunks/{index}`: complete fetched source bytes, base64 chunks and hash/size manifest.
- `robotTeamIntelligence/default/runs/{period_id}`: compact durable period/session binding, reservation, state, coverage and full checkpoint reference.
- `agentCheckpoints/robot-intelligence-{period_id}`: exact JSON workflow/tool/provider evidence. The existing private-evidence helper offloads large payloads into Blueprint's existing private object storage with generation/hash readback. Provider IDs are provenance, not canonical business IDs.

Directory search/fetch/history tools export public records as standard JSON. For full internal recovery, export the Firestore records above, all source chunks and the checkpoint's referenced private JSON object; verify their hashes before replay. Another authorized host can resume the same pending required actions from these company records without provider-only memory or a new paid create.

## Import the existing directory and mirror it

The existing Team Directory is `https://app.notion.com/p/3eb80154161d817aa3e6d9b9d7eba938`. The import preview must retain all 47 BP-TEAM records, full original notes, the actual page last-edited timestamp and each original source-check date. Importing is not a new source check or partnership qualification. The operator uses a private JSON preview with schema `blueprint.robot-team-directory-import-preview.v1`; it is never committed to this public repository.

```sh
node --import tsx scripts/agents/import-robot-team-directory.ts --input PRIVATE_PREVIEW_JSON
node --import tsx scripts/agents/import-robot-team-directory.ts --input PRIVATE_PREVIEW_JSON --apply --authority-ref RETAINED_ROBOT_DIRECTORY_AUTHORITY
```

Apply only while the robot lane is paused. Import preserves existing identities and fields, including measured capabilities and private account/contact data, and leaves rehearsal records intact. Its content-addressed import receipt binds all 47 original notes hashes and verifies canonical readback. Existing dates remain original dates; `directoryImportedAt` records the separate import operation. Exact retries observe the receipt rather than replacing newer data.

Configure `notionMirror` with `enabled: true`, the existing Team Directory parent page ID, and the retained robot-directory/mirror owner authority. Each agent can then call `mirror_robot_team_to_notion` after saving useful evidence. Full public canonical records are mirrored into one child page per team, with append-only content-hash versions, exact page/batch binding and actual Notion readback. Private account/contact fields are excluded. Existing researched notes on the parent are preserved. Uncertain creates/appends are observed on the same binding; they are never blindly repeated.

For the initial imported directory only, the release owner can preview and apply the same mirror path without inference:

```sh
node --import tsx scripts/agents/mirror-robot-team-directory.ts
node --import tsx scripts/agents/mirror-robot-team-directory.ts --apply
```

Provision the final six-tool saved definitions before activation. Retain Nijel's October 3 direction for this lane's separate $10 soft allocation per scheduled day; use `dailySoftUsd: 10` and `perRunReservationUsd: 5` so two weekly jobs can be admitted within that soft allocation. Monthly review can consume the remaining allocation on its scheduled day; this is a soft target, not a measured invoice cap. Actual authority references and expiry come from the retained robot-specific owner direction, never the research/comms grant or model arguments. Verify both saved IDs/configurations, 47 imported-note hashes, each initial mirror binding/readback, actual worker flag and calendar before claiming activation. Source availability or rehearsal directory reads do not prove autonomous discovery, full refresh coverage or subsequent use of changes.
