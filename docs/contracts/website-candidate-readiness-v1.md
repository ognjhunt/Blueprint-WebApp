# Candidate preparation in the job workspace

The optional `candidateReadiness` workflow field is a read-only preparation
projection, separate from `managedEvidence[].screening`. It never has scores,
planned trials, budget, a campaign or an execution authority. Each row is always
`compatibility: not_evaluated`; no remaining catalog findings does not mean ready
to run. Scripted baselines are labeled separately from learned policies.

The server requests the new `website_candidate_readiness.v1` companion at the
configured Pipeline origin using existing HMAC credentials. The existing v4
preparation receipt and its 8192-byte limit remain unchanged. The companion has
strict fields, a 256 KiB streamed limit, at most 256 unique stable candidate IDs,
and source/context, preparation, registry/profile and catalog digests. A changed
source, withdrawn permission, invalid digest or excessive response yields a safe
unavailable note. Overflow explicitly explains that the complete list cannot be
shown; there is no silent first-page subset. No caller-selected URLs are allowed.

The existing current-source preparation verifier runs before and after the
companion read. The job's verified owner link or admin account is required;
filming-only links have no access. Nothing is persisted or published, and the
companion has an eight-second read-only deadline. An unavailable companion does
not break the workflow or replace real evidence. Older Pipelines can return 404
without breaking existing results; deploy the producer when available to populate
the optional view.

The client displays fixed plain-English notes rather than raw blockers, hashes,
host paths, credential names or endpoints. Genuine current screening rows replace
preview rows by candidate ID, while superseded/historical results remain history.
The live Firestore RobotTeam routing and deployment inventory remain unchanged.

Tests exercise strict payload/source/digest/size refusal, overflow copy, two-phase
current-source checks, actual Express owner/admin middleware in memory, real
Pipeline ASGI HMAC/source checks, and distinct script/UI evidence. Local socket
listening is unavailable in this sandbox, so the route test uses actual Express
handlers without a listening server. These checks do not claim a live deployment
or successful robot/policy execution.
