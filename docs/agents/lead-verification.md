# Evidence verification before lead promotion

Owner-requested completion artifact for the partner-intake research blocker:
discovery lists and broad source-support flags did not establish each named
operator's physical site, relevant task or human workflow. The same criteria
must apply to every candidate in a provider comparison.

`server/agents/lead-verification.ts` evaluates retained agent assessments without
network access or provider calls. Agents assess what sources mean and how they
link to the exact operator, physical location and task. The harness binds that
judgment to the exact candidate digest and enforces promotion. Public evidence
does not establish buying intent, consent/rights, commercial qualification,
robot compatibility or deployment readiness. Those gates remain separate.

Use `blueprint.lead-verification.v1` assessments with `candidate_digest`,
`assessed_at` and `valid_until`. Record claims for `operator`, `physical_site`,
`site_task`, `human_workflow` and `plausible_fit`, each with a reason, retained
source IDs and one of `verified_fact`, `inference`, `unresolved`, `contradicted`,
`stale` or `unreachable`. The first four claims need current retrieved primary
or operator evidence. Explain exact site/task linkage; an organization's general
service list or robot vendor marketing does not establish a human workflow at
that physical site. Plausible fit may remain an evidence-based inference and
cannot certify a robot or predict deployment success.

Sources retain their ID, URL, publisher, quote, publication/event dates (or
unknown dates), check time, retrieval method, classification, freshness and
freshness reason. A snippet or unreachable URL cannot supply positive retrieved
evidence. Historical material remains useful background. Checks cannot occur
after assessment, and the assessment must be current at promotion. Preserve
original date precision, quotes and extra inert metadata rather than inventing
dates or rewriting evidence to pass.

Counterevidence records actual searches or retrieved sources, a reason and a
`checked`, `unresolved` or `contradicted` status. Assess automation, closures,
wrong-site references and contradictory task/operator statements. Missing
evidence and unsupported contradictions remain `unresolved`; retrieved supported
contradictions can yield `rejected`. All outcomes retain the raw assessment,
assessment/candidate hashes, identity, reasons and separate gates. Repair feedback
identifies missing binding, source, scope, freshness or counterevidence. It does
not create a retry loop, search quota or forced rejection.

Identity retains normalized operator, site label, location and task together.
Two named physical sites in the same city remain distinct. A retained,
reasoned `duplicate_of` assessment links aliases to the same physical site;
city or shared contact alone cannot establish equivalence.

The authenticated reviewed-research endpoint accepts optional raw
`leadVerification` data so raw validation remains useful. Staging recomputes it
and requires `verified` before admission; no supplied status or approval flag
grants authority. New immutable packets store both assessment and evaluated
result. GET/export and legacy publication readers preserve intact historical
records. Records without verification remain readable and ineligible for new
qualified/outreach promotion. Intake, preview, approval, worker publication
readback and first-contact source consumption recompute the gate. Existing
draft-only, sending-off, suppression, budget, access and idempotency controls
continue to apply.

Correlated observed replies remain durable untrusted evidence even after lead
verification expires. Their immutable handoff retains original source dates;
the derived job records the assessment and waits in `awaiting_research`. Receipt
of a reply neither refreshes sources nor launches paid drafting. Opt-outs retain
their independent suppression authority.

The Pipeline QA contract stores raw assessment at each
`checks[].lead_verification`; its decision stores the full cohort at
`lead_verification.results`. WebApp compares raw QA evidence with the retained
decision's assessment digest before using it. Source objects include raw
`leadVerification` only when present, preserving old source digest shapes.
New `verification_cohort_version` packets preserve original discovered rows in
`candidates` and full `duplicates`, ordered by `discovery_index`. All raw
assessments and semantic duplicate checks are bound to the retained QA artifact.
WebApp recomputes the full cohort, resolves original/alias chains and blocks
conflicting or unresolved duplicate equivalence before promotion. A later
declared original can be canonical; cycles or missing originals cannot inflate
verified yield.
`research-digest.ts` retains the existing Python-compatible packet encoding.
Verification uses separate typed canonical encoding: finite numbers serialize as
unquoted `n:<IEEE754 float64 big-endian hex>` tokens, while strings, booleans and
null keep ASCII-escaped JSON encoding. This accepts inert float metadata without
losing cross-language identity; large numeric IDs must remain strings. Exact
report/evidence bytes have their own hashes. Portable protected JSON and
report-byte export routes are documented in
[communications evidence admission](communications-evidence-admission.md).

Deduplication uses normalized operator + physical location + task. Distinct tasks
at one site and distinct sites remain candidates. Existing mailbox first-touch
and send fences still prevent duplicate effects. Report provider quality from
full-cohort verification coverage, unique verified site/task candidates and
unresolved/rejected counts. Six selected source checks or narrative specificity
cannot establish an accuracy winner. Compare cost-normalized yield only with
known actual costs for the same scope.

Hermetic tests use explicitly synthetic operators and evidence. Retained real
contact fixtures remain unchanged and lack site/task/human-workflow verification;
they must not be promoted by relabeling them. Runtime proof would need separate
authorized verification work. This implementation requests no paid jobs,
FindAll allocation, credentials, outreach or production activation.
