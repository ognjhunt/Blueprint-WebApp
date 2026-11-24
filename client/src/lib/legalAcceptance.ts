/**
 * Shared Terms of Service / Privacy Policy acceptance contract.
 *
 * Used by the buyer/site-operator webapp signup UI (to gate submission) and by
 * the server inbound-request route (to persist a server-derived consent record).
 *
 * Audit finding R047: buyers and site operators must accept Terms/Privacy at
 * signup, and that acceptance must be recorded server-side with the version and
 * timestamp derived on the server rather than trusting a client-only flag.
 *
 * Bump these versions whenever the published Terms or Privacy documents change
 * so new signups record consent against the current revision.
 *
 * A version's date is its effective date, and it may be in the future: the
 * owner decided on 2026-10-15 that an update is published ahead of time with
 * notice, and the previous version stays in force until the new date. The
 * previous versions below are frozen at /terms/previous and /privacy/previous.
 *
 * Owner, 2026-11-02: the corrected documents (D-16: people are not removed from
 * job footage; faces are blurred only in the frames sent to World Labs) take
 * effect at once instead of on November 15. Every job with footage was the
 * owner's own, and the corrected text is the accurate one.
 */
/*
 * 2026-11-12 (owner: "sharing is the service"; PACKAGE_D D1.2). The new version says a started job is shared with the
 * deployment companies Blueprint approves. It takes effect at once, as the 2026-11-02 correction did, and it replaces
 * the version published ahead as 2026-11-25.1 before that version took effect. Its text keeps everything 2026-11-25.1
 * changed (the filming visits retired) and adds the sharing.
 *
 * Who it binds, and how: a person accepts it only by an act of their own, never by continuing to use the Service.
 * - A site starting a job from the release accepts it under the start form's line (recorded in `terms_acceptance`).
 * - A site with an older job accepts it by agreeing to recording statement v4 on the job's page, which records it on the
 *   job (`server/utils/jobSharedListing.ts`). Until then the job keeps what it was promised: it is not shown to any
 *   company, and its stored acceptance stays as it is under its own version id.
 * - A signed-in account whose recorded acceptance is 2026-11-02.1 or 2026-11-25.1 is asked to accept the current
 *   versions the next time it is checked (`acceptedVersionsAreCurrent` is false for them; `server/routes/workspace.ts`).
 * The permission to share a job never rests on the Terms alone: it rests on recording statement v4.
 */
/*
 * 2026-11-12, later the same day (owner: "if they want to talk to 1 that should be fine if they want to go through the
 * steps with 8 that should be fine"). Version 2026-11-12.2 removes one sentence from the Terms, "You can ask for up to
 * three introductions for each job.", and changes nothing else. It takes effect at once, as 2026-11-12.1 did. The text of
 * 2026-11-12.1 is frozen at `client/src/pages/TermsPrevious.tsx` (/terms/previous). The Privacy Policy shares the version
 * id, so it moves to 2026-11-12.2 with its text unchanged: Privacy 2026-11-12.1 and 2026-11-12.2 are the same words
 * (the same `Privacy.tsx`, same digest).
 *
 * Who it binds, and how, exactly as for 2026-11-12.1: only by an act of the person's own.
 * - A site starting a job from this release accepts it under the start form's line.
 * - A signed-in account whose recorded acceptance is 2026-11-12.1 (or older) is asked to accept the current versions the
 *   next time it is checked (`acceptedVersionsAreCurrent` is false for it; `server/routes/workspace.ts`).
 * - A deployment company whose access record holds 2026-11-12.1 sees the Terms prompt and presses "I agree" again
 *   (`server/utils/companyTerms.ts`); until then `companyMaySeeJobs` is false for it.
 */
/*
 * 2026-11-13 (owner decision 1 of 2026-11-13: Anthropic may process a site's job like OpenAI, for jobs started under the
 * new version only). Privacy Policy 2026-11-13.1 changes its AI rows and its "AI in the Service" paragraph and nothing
 * else: Anthropic's row reads like OpenAI's for jobs started and requests sent under it (with "may": Anthropic is not
 * first anywhere until a paid test passes), Google Gemini's row says it receives the job description with the footage,
 * and the row of the provider no longer used (DeepSeek) leaves. It takes effect at once. Its text of 2026-11-12.2 is
 * frozen at `client/src/pages/PrivacyPrevious.tsx` (/privacy/previous), and the 2026-11-02.1 page byte for byte at
 * `PrivacyEarlier.tsx` (not routed).
 *
 * The Terms do not change: they keep 2026-11-12.2 (planner, 2026-11-13: nobody is asked to agree again to text that
 * did not change). From here on the Terms and the Privacy Policy have their own ids.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again. It changes only what may happen to jobs started and requests sent from now on, so
 *   an account or a deployment company that accepted Terms 2026-11-12.2 with Privacy 2026-11-12.2 keeps everything it
 *   had (`acceptedVersionsAreCurrent`: a Privacy-only change gates nothing; a Terms change still does).
 * - A site starting a job from this release accepts Terms 2026-11-12.2 and Privacy 2026-11-13.1 under the start form's
 *   line, recorded as two versions; that job is under Privacy 2026-11-13.1.
 * - A job started earlier keeps what it was promised: the data-class gate reads the Privacy version recorded when the
 *   job was started (`server/agents/runtime.ts`), and a later acceptance on the job's page does not move it.
 */
/*
 * 2026-11-17 (owner: "idc about face blurring - please find where this comes from and remove it."). Terms and Privacy
 * Policy 2026-11-17.1 no longer promise face blurring: for a job started under them, the frames sent to World Labs are
 * not blurred. A job started under an earlier Privacy version keeps the blurring that was promised to it; the Pipeline
 * decides by the version recorded on the job (`privacy_version_at_submission`, sent in the grant as
 * `privacy_policy_version`), so a job started from a form opened before this release stays under the version it showed.
 * The documents share the id. They take effect at once (owner, 2026-11-17), with no advance email: the owner was told
 * that Terms section 12 and the Privacy Policy's "Changes to this policy" promise account holders an email before a
 * material change takes effect, and chose this. The text of Terms 2026-11-12.2 is frozen at `TermsPrevious.tsx`
 * (/terms/previous) and of Privacy 2026-11-13.1 at `PrivacyPrevious.tsx` (/privacy/previous); the pages that were there
 * (Terms 2026-11-12.1, Privacy 2026-11-12.2) are kept byte for byte at `TermsOlder.tsx` and `PrivacyOlder.tsx` (not
 * routed).
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again (owner, 2026-11-17: earlier acceptances keep counting). The change concerns only
 *   jobs started from now on, so an account or a deployment company that accepted Terms 2026-11-12.2 with Privacy
 *   2026-11-12.2 or 2026-11-13.1 keeps everything it had: `EARLIER_TERMS_VERSIONS_STILL_COUNTING` and
 *   `EARLIER_PRIVACY_VERSIONS_STILL_COUNTING` list those versions for 2026-11-17.1, and `companyMaySeeJobs` stays true.
 * - A site starting a job from this release accepts Terms and Privacy 2026-11-17.1 under the start form's line; that
 *   job is under Privacy 2026-11-17.1 and its frames are not blurred.
 * - A job started earlier keeps its recorded version and its blurring; a later acceptance does not move it.
 */
/*
 * 2026-11-19 (owner: the early trial dropped on 2026-11-14; permission to update the Privacy Policy and Terms given on
 * 2026-11-19). Terms and Privacy Policy 2026-11-19.1 no longer say Blueprint runs, keeps or shares an early trial of
 * robot software or its result: the uses, the sharing sentence (both documents), the retention row, the Service
 * description, the bounded-estimate sentence, the site's license and the free-beta cost line lose it, and nothing else
 * changes in meaning. One sentence on each page is reworded so its meaning stays: "a job started under an earlier
 * version" of the Privacy Policy (still blurred for World Labs) now says "a version ... published before November 17,
 * 2026", because under 2026-11-19.1 "an earlier version" would take in 2026-11-17.1, whose jobs are not blurred. The
 * documents share the id and take effect at once, as 2026-11-12.1, 2026-11-13.1 and 2026-11-17.1 did.
 *
 * The texts are frozen as before, and the chain moves one place: Terms and Privacy 2026-11-17.1 are frozen at
 * `TermsPrevious.tsx` and `PrivacyPrevious.tsx` (/terms/previous, /privacy/previous); the pages that were there (Terms
 * 2026-11-12.2, Privacy 2026-11-13.1) are kept byte for byte at `TermsOlder.tsx` and `PrivacyOlder.tsx`; the pages that
 * were at those (Terms 2026-11-12.1, Privacy 2026-11-12.2) are kept byte for byte at `TermsFormer.tsx` and
 * `PrivacyFormer.tsx`, a slot added the same way because `*Earlier.tsx` already holds 2026-11-02.1. None of these is
 * routed but the previous pages. Same digests as before the move: each kept page is the same bytes.
 *
 * No advance email. Terms section 12 and the Privacy Policy's "Changes to this policy" promise account holders an email
 * before a material change takes effect. This version only narrows: Blueprint stops one use of a site's footage and
 * stops sharing one item with deployment companies, and the Terms already let a beta feature be withdrawn (section
 * 1). Nobody gains an obligation or loses a right, and no data is used or shared in a new way, so there is nothing to
 * give notice of before it takes effect: it is not a material change in the sense those promises protect.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again: every Terms and Privacy version that counted before still counts
 *   (`EARLIER_TERMS_VERSIONS_STILL_COUNTING`, `EARLIER_PRIVACY_VERSIONS_STILL_COUNTING`), so accounts keep what they
 *   had and `companyMaySeeJobs` stays true for every deployment company that could see jobs.
 * - A job's listing does not read these versions: it rests on recording statement 2026-11-12.v4
 *   (`server/utils/jobSharedListing.ts`), whose words do not change (they never named the early trial). No job is
 *   hidden and no site is asked to accept anything again.
 * - A site starting a job from this release accepts Terms and Privacy 2026-11-19.1 under the start form's line; a job
 *   started earlier keeps its recorded version (and, before 2026-11-17.1, its blurring).
 * - Footage: 2026-11-19.1 promises no blurring, as 2026-11-17.1 does. The Pipeline decides by the version recorded on
 *   the job (`NO_FACE_BLUR_PRIVACY_VERSIONS` in BlueprintCapturePipeline `atlas_privacy_screen.py`) and blurs any
 *   version it does not list, so it must list 2026-11-19.1 too; until it does, a job started under it is blurred.
 */
/*
 * 2026-11-21 (owner, 2026-11-21: the launch-copy legal edits approved). Terms and Privacy Policy 2026-11-21.1 correct
 * the documents to match what the Service already does, and change nothing it does:
 * - they disclose the questions already sent after an introduction: both sides are asked what happened up to three
 *   times, 14, 45 and 90 days after it (`OUTCOME_QUESTION_DAYS`, `server/utils/jobOutcomeGate.ts`), and the answers are
 *   recorded on the job;
 * - they drop what is retired or never reached a site: the refund and pre-beta balance clauses (no outside customer
 *   ever bought a balance; the /refunds page leaves and redirects to /terms), Blueprint filming visits (no outside site
 *   had one), the phone line and voice assistant (none exists: Twilio sends texts only, ElevenLabs is not used) and
 *   restricted areas a site marks (sites cannot mark them);
 * - they say "job" for "task", "job description" for "job brief", name the answers by their labels
 *   (`COMPANY_RESPONSE_LABELS`, `client/src/lib/companyResponses.ts`: Interested, Not a fit, Need more details, Tested
 *   it: can do, Tested it: cannot yet), and drop the "review" and "evaluation" wording, since no person reviews a job
 *   and Blueprint tests no robot;
 * - they say what the Service already does where they said otherwise: a job is shared once it has its video; a site
 *   withdraws from the job's page; a site reads a company's reason with its name and contact details taken out; a site
 *   whose introduced company drops out can ask for another introduction itself (no person reviews a replacement); a
 *   person accepts a change that asks something new only by agreeing to it (Terms section 11, section 12 before).
 * The retention row for site footage does not change: no scheduled deletion exists, so no period is stated. The money
 * sentence "Blueprint charges no fee for and takes no percentage of any pilot or deployment." stays word for word. The
 * documents share the id and take effect at once, as 2026-11-12.1, 2026-11-13.1, 2026-11-17.1 and 2026-11-19.1 did.
 *
 * The texts are frozen as before, and the chain moves one place: Terms and Privacy 2026-11-19.1 are frozen at
 * `TermsPrevious.tsx` and `PrivacyPrevious.tsx` (/terms/previous, /privacy/previous); 2026-11-17.1 moves to
 * `TermsOlder.tsx` and `PrivacyOlder.tsx`; Terms 2026-11-12.2 and Privacy 2026-11-13.1 move to `TermsFormer.tsx` and
 * `PrivacyFormer.tsx`; Terms 2026-11-12.1 and Privacy 2026-11-12.2 move to `TermsPrior.tsx` and `PrivacyPrior.tsx`, a
 * slot added the same way `*Former.tsx` was, because `*Earlier.tsx` already holds 2026-11-02.1. The slots run Previous,
 * Older, Former, Prior, Earlier, newest first. None of these is routed but the previous pages. Same digests as before
 * the move: each kept page is the same bytes.
 *
 * No advance email. Terms section 12 (section 11 from this version) and the Privacy Policy's "Changes to this policy"
 * promise account holders an email before a material change takes effect. The owner was told so and chose, on
 * 2026-11-21, to publish at once without an advance email, as with 2026-11-17.1.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again: every Terms and Privacy version that counted before still counts
 *   (`EARLIER_TERMS_VERSIONS_STILL_COUNTING`, `EARLIER_PRIVACY_VERSIONS_STILL_COUNTING`), so accounts keep what they
 *   had and `companyMaySeeJobs` stays true for every deployment company that could see jobs. A company's reason
 *   reaches a site under the line it gave its answer under (`company-response-2026-11-12`), not under the Terms.
 * - A job's listing does not read these versions: it rests on recording statement 2026-11-12.v4
 *   (`server/utils/jobSharedListing.ts`), whose words do not change. No job is hidden and no site is asked to accept
 *   anything again.
 * - A site starting a job from this release accepts Terms and Privacy 2026-11-21.1 under the start form's line; a form
 *   opened before the release records the 2026-11-19.1 pair it showed (`PAIRS_A_PAGE_SHOWED`), and a job started
 *   earlier keeps its recorded version (and, before 2026-11-17.1, its blurring).
 * - Footage: 2026-11-21.1 promises no blurring, as 2026-11-17.1 and 2026-11-19.1 do. The Pipeline decides by the version
 *   recorded on the job (`NO_FACE_BLUR_PRIVACY_VERSIONS` in BlueprintCapturePipeline `atlas_privacy_screen.py`) and
 *   blurs any version it does not list, so it lists 2026-11-21.1 (and 2026-11-22.1, should the release land after
 *   midnight UTC); until that is deployed, a job started under it is blurred.
 */
/*
 * 2026-11-23 (owner, 2026-11-23: "yes to the privacy wording"). Privacy Policy 2026-11-23.1 changes one sentence and
 * nothing else: the Location row's second sentence, "A deployment company sees the country of the job, not the address
 * you typed.", becomes "A deployment company sees the city, state and country of the job, not the address you typed."
 * A job recorded under recording statement 2026-11-23.v6 shows a company the job's city and state
 * (`RECORDING_VERSION_PLACE_LEVEL`, `server/utils/teamJobAccess.ts`); a job recorded under an earlier statement still
 * shows the country alone. It takes effect at once, as 2026-11-13.1 did. The Terms do not change: they keep 2026-11-21.1.
 *
 * The Privacy texts are frozen as before, and the Privacy chain moves one place: 2026-11-21.1 is frozen at
 * `PrivacyPrevious.tsx` (/privacy/previous); 2026-11-19.1 moves to `PrivacyOlder.tsx`, 2026-11-17.1 to
 * `PrivacyFormer.tsx`, 2026-11-13.1 to `PrivacyPrior.tsx`, and 2026-11-12.2 to `PrivacyPast.tsx`, a slot added the same
 * way `*Prior.tsx` was, because `*Earlier.tsx` already holds 2026-11-02.1. The Privacy slots run Previous, Older,
 * Former, Prior, Past, Earlier, newest first. The Terms slots do not move. None of these is routed but the previous
 * pages. Same digests as before the move: each kept page is the same bytes.
 *
 * Advance email: the Privacy Policy's "Changes to this policy" promises account holders an email before a material
 * change takes effect. The change applies only to jobs started under the new sentence; whether it is material, and any
 * email, is the owner's decision. No email is sent by code.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again: every Privacy version that counted before still counts
 *   (`EARLIER_PRIVACY_VERSIONS_STILL_COUNTING`), so accounts keep what they had and `companyMaySeeJobs` stays true for
 *   every deployment company that could see jobs.
 * - A site starting a job from this release accepts Terms 2026-11-21.1 and Privacy 2026-11-23.1 under the start form's
 *   line; a form opened before the release records the 2026-11-21.1 pair it showed (`PAIRS_A_PAGE_SHOWED`).
 * - Footage: 2026-11-23.1 promises no blurring, as every version from 2026-11-17.1 does; the Pipeline compares the
 *   recorded version with 2026-11-17.1, so a job under 2026-11-23.1 is not blurred.
 */
/*
 * 2026-11-23, later the same day (owner, 2026-11-23: "yes, update both"). Terms and Privacy Policy 2026-11-23.2 say what
 * a site sees of a deployment company's answer given under the answer line `company-response-2026-11-23`: a company
 * applies to a job (the answer labelled Apply; the site sees it as Applied, where the documents said Interested), the site
 * sees the company's name and website with each answer and its reason, with the company's contact details taken out,
 * and the site accepts the companies it wants to meet. Only then does the site get the company's contact details, and
 * the company the site's name, address and contact details. An answer given before November 23, 2026 stays under an
 * alias ("Company A"). The sentences that change, and nothing else:
 * - both documents' company sentence (`COMPANY_ALIAS_SENTENCE`, renamed `COMPANY_APPLICATION_SENTENCE`) becomes "A site
 *   sees your company's name and website with each answer you give and the reason you give, with your contact details
 *   taken out. It gets your contact details only when it accepts your application, after you applied or answered Tested
 *   it: can do. Answers you gave before November 23, 2026 stay under an alias.";
 * - the Privacy Policy's paragraph for deployment companies: "When a site asks for an introduction, we give you the
 *   site's name, address and contact details." becomes "When a site accepts your application, we give you ...";
 * - the Privacy Policy's "Who we share it with": "A site's name, address and contact details go to a company only when
 *   the site asks for an introduction to it, and the site then receives the company's name and contact details." becomes
 *   "A site sees a company's name and website with each answer the company gives (an answer given before November 23,
 *   2026 stays under an alias). A site's name, address and contact details go to a company only when the site accepts
 *   it, and the site then receives the company's contact details.";
 * - the Terms name the answers by their new labels: "can answer Apply, Not a fit or Need more details." (section 1) and
 *   "can answer each one: Apply, Not a fit or Need more details." (section 4);
 * - Terms section 3: "A deployment company's answer reaches you under an alias. When you ask for an introduction to a
 *   company that answered Interested or Tested it: can do, we give it ..." becomes "A deployment company's answer reaches
 *   you with its name and website, with its contact details taken out. An answer given before November 23, 2026 reaches
 *   you under an alias. When you accept a company that applied or answered Tested it: can do, we give it ...";
 * - the replacement sentence (`REPLACEMENT_SENTENCE`, and `pilotReplacementPolicy` with it) becomes "If a company you
 *   were introduced to drops out, you can accept another company that applied or answered Tested it: can do."
 * Every other sentence stays word for word, the sharing promises with them: `CONTACT_DETAILS_SENTENCE` still says "unless
 * you ask for an introduction to it", which accepting a company is, and the sentences about what happens after an
 * introduction stay. The documents share the id and take effect at once, as 2026-11-21.1 did.
 *
 * The texts are frozen as before, and both chains move one place. Terms 2026-11-21.1 is frozen at `TermsPrevious.tsx`
 * (/terms/previous); 2026-11-19.1 moves to `TermsOlder.tsx`, 2026-11-17.1 to `TermsFormer.tsx`, 2026-11-12.2 to
 * `TermsPrior.tsx`, and 2026-11-12.1 to `TermsPast.tsx`, a slot added the way `PrivacyPast.tsx` was. Privacy 2026-11-23.1
 * is frozen at `PrivacyPrevious.tsx` (/privacy/previous); 2026-11-21.1 moves to `PrivacyOlder.tsx`, 2026-11-19.1 to
 * `PrivacyFormer.tsx`, 2026-11-17.1 to `PrivacyPrior.tsx`, 2026-11-13.1 to `PrivacyPast.tsx`, and 2026-11-12.2 to
 * `PrivacyBygone.tsx`, a slot added the same way. `*Earlier.tsx` keeps 2026-11-02.1. The Terms slots run Previous,
 * Older, Former, Prior, Past, Earlier, and the Privacy slots Previous, Older, Former, Prior, Past, Bygone, Earlier, newest
 * first. None of these is routed but the previous pages. Same digests as before the move: each kept page is the same
 * bytes.
 *
 * Advance email: Terms section 11 and the Privacy Policy's "Changes to this policy" promise account holders an email
 * before a material change takes effect. The owner chose to publish at once (owner, 2026-11-23: "yes, update both");
 * no email is sent by code.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again: every Terms and Privacy version that counted before still counts
 *   (`EARLIER_TERMS_VERSIONS_STILL_COUNTING`, `EARLIER_PRIVACY_VERSIONS_STILL_COUNTING`), so accounts keep what they
 *   had and `companyMaySeeJobs` stays true for every deployment company that could see jobs. A company's name reaches a
 *   site only under the answer line it gave its answer under (`company-response-2026-11-23`), not under the Terms, the
 *   same rule as for a company's reason (`company-response-2026-11-12`): an answer given under an earlier line stays
 *   under an alias.
 * - A job's listing does not read these versions: it rests on the recording statement (2026-11-12.v4 or later,
 *   `server/utils/jobSharedListing.ts`), whose words do not change. No job is hidden and no site is asked to accept
 *   anything again.
 * - A site starting a job from this release accepts Terms and Privacy 2026-11-23.2 under the start form's line; a form
 *   opened before the release records the pair it showed (Terms 2026-11-21.1 with Privacy 2026-11-23.1, or an earlier
 *   pair; `PAIRS_A_PAGE_SHOWED`), and a job started earlier keeps its recorded version (and, before 2026-11-17.1, its
 *   blurring).
 * - Footage: 2026-11-23.2 promises no blurring, as every version from 2026-11-17.1 does. The Pipeline needs no change: it
 *   compares the recorded version with 2026-11-17.1 (`FIRST_NO_FACE_BLUR_PRIVACY_VERSION`, `is_no_face_blur_version` in
 *   BlueprintCapturePipeline `atlas_privacy_screen.py`, which also refuses a version dated after tomorrow UTC), so a job
 *   under 2026-11-23.2 is not blurred.
 */
/*
 * 2026-11-23, later again the same day (owner, 2026-11-23: "yes build it this way"). A deployment company that applies
 * to a job may now give, with its answer, how it charges (a one-time purchase, a monthly subscription, per hour, or per
 * task or item) and, if it wants, an estimate range in US dollars. Terms 2026-11-23.3 add two sentences about that
 * estimate and change nothing else:
 * - Terms section 3, for sites, after the sentences on how a company's answer reaches the site: "An estimate a
 *   deployment company gives with its answer is its own, given before a site visit. It is not a quote, and Blueprint
 *   does not check or guarantee it.";
 * - Terms section 4, for deployment companies, after the sentence on what a site sees of an answer
 *   (`COMPANY_APPLICATION_SENTENCE`, which stays word for word and the same constant as the Privacy Policy's): "If you
 *   give an estimate with your answer, the site sees it as an estimate before a site visit, not a quote."
 * Blueprint states no price of its own: the estimate is the company's, shown only on the site's job page (never in an
 * email or on a public page), labelled "Estimate before a site visit. Not a quote." The money sentence "Blueprint
 * charges no fee for and takes no percentage of any pilot or deployment." stays word for word. It takes effect at once,
 * as 2026-11-23.2 did (the owner's choice).
 *
 * The Privacy Policy does not change: it keeps 2026-11-23.2 (as the Terms kept 2026-11-21.1 when only the Privacy Policy
 * changed to 2026-11-23.1).
 *
 * The Terms texts are frozen as before, and the Terms chain moves one place: 2026-11-23.2 is frozen at
 * `TermsPrevious.tsx` (/terms/previous); 2026-11-21.1 moves to `TermsOlder.tsx`, 2026-11-19.1 to `TermsFormer.tsx`,
 * 2026-11-17.1 to `TermsPrior.tsx`, 2026-11-12.2 to `TermsPast.tsx`, and 2026-11-12.1 to `TermsBygone.tsx`, a slot added
 * the way `TermsPast.tsx` was, and named as `PrivacyBygone.tsx` is, because `*Earlier.tsx` already holds 2026-11-02.1.
 * The Terms slots now run, like the Privacy slots, Previous, Older, Former, Prior, Past, Bygone, Earlier, newest first.
 * The Privacy slots do not move. None of these is routed but the previous pages. Same digests as before the move: each
 * kept page is the same bytes.
 *
 * Advance email: Terms section 11 promises account holders an email before a material change takes effect. The owner
 * chose to publish at once, as for 2026-11-23.2; no email is sent by code.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again: every Terms version that counted before still counts
 *   (`EARLIER_TERMS_VERSIONS_STILL_COUNTING`), so accounts keep what they had and `companyMaySeeJobs` stays true for
 *   every deployment company that could see jobs. An estimate reaches a site only under the answer line it was given
 *   under (`company-response-2026-11-23.2`, which tells the company the site sees its estimate), not under the Terms, as
 *   a company's name (`company-response-2026-11-23`) and its reason (`company-response-2026-11-12`) already do: the site
 *   sees no estimate with an answer given under an earlier line.
 * - A job's listing does not read these versions: it rests on the recording statement (2026-11-12.v4 or later,
 *   `server/utils/jobSharedListing.ts`), whose words do not change. No job is hidden and no site is asked to accept
 *   anything again.
 * - A site starting a job from this release accepts Terms 2026-11-23.3 and Privacy 2026-11-23.2 under the start form's
 *   line; a form opened before the release records the pair it showed (Terms and Privacy 2026-11-23.2, or an earlier
 *   pair; `PAIRS_A_PAGE_SHOWED`), and a job started earlier keeps its recorded versions.
 * - Footage: unaffected. The Pipeline decides blurring by the Privacy version recorded on the job, and the Privacy
 *   version does not change, so a job started under Privacy 2026-11-23.2 is not blurred.
 */
/*
 * 2026-11-23, a fourth time the same day (owner, 2026-11-23: approved adding exactly this one sentence). The Pipeline is
 * starting to put 3D models from public libraries (Google Scanned Objects, NVIDIA SimReady) into the simulation a
 * deployment company downloads. Those models are under CC BY 4.0, which forbids adding terms that restrict a
 * recipient's use (section 2(a)(5)(B)), and Blueprint does not own them; the Terms say Blueprint owns the simulations
 * and their files, and that a company may use a job only to decide whether it can do it. Terms 2026-11-23.4 add one
 * sentence (`LIBRARY_MODEL_SENTENCE`) and change nothing else: in section 6 (Ownership), right after "Blueprint owns the
 * Service, our software, and the simulations, their files and the reports we create, subject to the rights these Terms
 * give you, including a site's right to withdraw its job.", in the same paragraph, so that it covers everyone, the
 * section for deployment companies included: "A model in a simulation that comes from a public library stays under that
 * library's license, named in the simulation's README: Blueprint does not own it, and these Terms do not restrict it."
 * It states no price, amount or currency. It takes effect at once, as 2026-11-23.3 did.
 *
 * The Privacy Policy does not change: it keeps 2026-11-23.2, and no Privacy page moves.
 *
 * The Terms texts are frozen as before, and the Terms chain moves one place: 2026-11-23.3 is frozen at
 * `TermsPrevious.tsx` (/terms/previous); 2026-11-23.2 moves to `TermsOlder.tsx`, 2026-11-21.1 to `TermsFormer.tsx`,
 * 2026-11-19.1 to `TermsPrior.tsx`, 2026-11-17.1 to `TermsPast.tsx`, 2026-11-12.2 to `TermsBygone.tsx`, and 2026-11-12.1
 * to `TermsLapsed.tsx`, a slot added the way `TermsBygone.tsx` was, because `*Earlier.tsx` already holds 2026-11-02.1.
 * The Terms slots now run Previous, Older, Former, Prior, Past, Bygone, Lapsed, Earlier, newest first, one place further
 * down than the Privacy slots. None of these is routed but the previous pages. Same digests as before the move: each
 * kept page is the same bytes.
 *
 * Advance email: Terms section 11 promises account holders an email before a material change takes effect. This version
 * only loosens: it says Blueprint does not own those models and lifts the Terms' restrictions from them, and asks
 * nothing new of anyone. No email is sent by code.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again: it only loosens restrictions, so every Terms version that counted before still counts
 *   (`EARLIER_TERMS_VERSIONS_STILL_COUNTING`), accounts keep what they had and `companyMaySeeJobs` stays true for every
 *   deployment company that could see jobs. It is not in `LEGAL_VERSIONS_THAT_ASK_AGAIN`: it changes what a company may do
 *   with a job only by restricting less, so an earlier acceptance binds no company to anything it did not agree to.
 * - A job's listing does not read these versions: it rests on the recording statement (2026-11-12.v4 or later,
 *   `server/utils/jobSharedListing.ts`), whose words do not change. No job is hidden and no site is asked to accept
 *   anything again.
 * - A site starting a job from this release accepts Terms 2026-11-23.4 and Privacy 2026-11-23.2 under the start form's
 *   line; a form opened before the release records the pair it showed (Terms 2026-11-23.3 with Privacy 2026-11-23.2, or
 *   an earlier pair; `PAIRS_A_PAGE_SHOWED`), and a job started earlier keeps its recorded versions.
 * - Footage: unaffected. The Pipeline decides blurring by the Privacy version recorded on the job, and the Privacy
 *   version does not change, so a job started under Privacy 2026-11-23.2 is not blurred.
 */
/**
 * The id of the 2026-11-17 Terms and Privacy Policy, the first versions that do not promise face blurring, and the one
 * place it is written in code and tests.
 */
export const NO_FACE_BLUR_VERSION = "2026-11-17.1";
/**
 * The id of the 2026-11-19 Terms and Privacy Policy (no early trial), and the one place it is written in code and
 * tests.
 */
export const NO_EARLY_TRIAL_VERSION = "2026-11-19.1";
/**
 * The id of the 2026-11-21 Terms and Privacy Policy (the launch-copy corrections), and the one place it is written in
 * code and tests: if the release slips past midnight UTC, change it here (and the date the pinned test expects the
 * pages to print).
 */
export const LAUNCH_COPY_VERSION = "2026-11-21.1";
/**
 * The id of the 2026-11-23 Privacy Policy (a company sees the city, state and country of a job), and the one place it
 * is written in code and tests.
 */
export const CITY_STATE_PRIVACY_VERSION = "2026-11-23.1";
/**
 * The id of the second 2026-11-23 Terms and Privacy Policy (a company applies; a site sees its name and website and
 * accepts it), and the one place it is written in code and tests: if the release slips past midnight UTC, change it
 * here (and the date the pinned tests expect the pages to print).
 */
export const COMPANY_APPLICATION_VERSION = "2026-11-23.2";
/**
 * The id of the third 2026-11-23 Terms (a deployment company's estimate is its own, not a quote; the Privacy Policy keeps
 * 2026-11-23.2), and the one place it is written in code and tests: if the release slips past midnight UTC, change it
 * here (and the date the pinned tests expect the page to print).
 */
export const COMPANY_ESTIMATE_TERMS_VERSION = "2026-11-23.3";
/**
 * The id of the fourth 2026-11-23 Terms (a model in a simulation from a public library stays under its own license;
 * Blueprint does not own it and the Terms do not restrict it; the Privacy Policy keeps 2026-11-23.2), and the one place it
 * is written in code and tests: if the release slips past midnight UTC, change it here (and the date the pinned tests
 * expect the page to print, and, since the previous Terms would then not be replaced the same day, `replacedSameDay` on
 * the previous Terms in `client/src/components/site/LegalVersionNotes.tsx` and the list its test expects).
 */
export const LIBRARY_MODEL_TERMS_VERSION = "2026-11-23.4";
export const TERMS_VERSION = LIBRARY_MODEL_TERMS_VERSION;
export const PRIVACY_VERSION = COMPANY_APPLICATION_VERSION;
/**
 * Published ahead on 2026-11-11 for November 25 and replaced before it took effect. Acceptances recorded under it keep
 * it; its text is frozen at `client/src/pages/TermsAnnounced.tsx` and `PrivacyAnnounced.tsx` (not routed). It no
 * longer counts as current.
 */
export const ANNOUNCED_SUPERSEDED_VERSION = "2026-11-25.1";

/**
 * The versions in force until TERMS_VERSION / PRIVACY_VERSION take effect.
 *
 * 2026-11-11 revision (owner: Blueprint filming visits retired): the visit
 * offer leaves the Terms and the Privacy Policy. Following the 2026-10-15
 * convention it is published ahead with a future effective date, so the
 * notice Terms section 12 promises can be given before it takes effect. The
 * date is a placeholder for the owner to confirm; no notice is sent by code.
 */
/** The Terms in force before 2026-11-23.4 are 2026-11-23.3. */
export const PREVIOUS_TERMS_VERSION = COMPANY_ESTIMATE_TERMS_VERSION;
/** The Privacy Policy in force before 2026-11-23.2 is 2026-11-23.1. */
export const PREVIOUS_PRIVACY_VERSION = CITY_STATE_PRIVACY_VERSION;
/** The Terms that were "previous" until 2026-11-23.4: kept byte for byte at `client/src/pages/TermsOlder.tsx`, not
 * routed. */
export const OLDER_TERMS_VERSION = COMPANY_APPLICATION_VERSION;
/** The Privacy Policy that was "previous" until 2026-11-23.2: kept byte for byte at `client/src/pages/PrivacyOlder.tsx`,
 * not routed. */
export const OLDER_PRIVACY_VERSION = LAUNCH_COPY_VERSION;
/** The Terms that were "older" until 2026-11-23.4 ("previous" until 2026-11-23.3): kept byte for byte at
 * `client/src/pages/TermsFormer.tsx`, not routed. */
export const FORMER_TERMS_VERSION = LAUNCH_COPY_VERSION;
/** The Privacy Policy that was "older" until 2026-11-23.2 ("previous" until 2026-11-23.1): kept byte for byte at
 * `client/src/pages/PrivacyFormer.tsx`, not routed. */
export const FORMER_PRIVACY_VERSION = NO_EARLY_TRIAL_VERSION;
/** The Terms that were "former" until 2026-11-23.4 ("previous" until 2026-11-23.2): kept byte for byte at
 * `client/src/pages/TermsPrior.tsx`, not routed. The `*Prior.tsx` slot sits between `*Former.tsx` and `*Past.tsx`. */
export const PRIOR_TERMS_VERSION = NO_EARLY_TRIAL_VERSION;
/** The Privacy Policy that was "former" until 2026-11-23.2 ("previous" until 2026-11-21.1): kept byte for byte at
 * `client/src/pages/PrivacyPrior.tsx`, not routed. */
export const PRIOR_PRIVACY_VERSION = NO_FACE_BLUR_VERSION;
/** The Terms that were "prior" until 2026-11-23.4 ("previous" until 2026-11-21.1): kept byte for byte at
 * `client/src/pages/TermsPast.tsx`, not routed. The `*Past.tsx` slot sits between `*Prior.tsx` and `*Bygone.tsx`. */
export const PAST_TERMS_VERSION = NO_FACE_BLUR_VERSION;
/** The Privacy Policy that was "prior" until 2026-11-23.2 ("previous" until 2026-11-17.1): kept byte for byte at
 * `client/src/pages/PrivacyPast.tsx`, not routed. */
export const PAST_PRIVACY_VERSION = "2026-11-13.1";
/** The Terms that were "past" until 2026-11-23.4 ("previous" until 2026-11-19.1): kept byte for byte at
 * `client/src/pages/TermsBygone.tsx`, not routed. The `TermsBygone.tsx` slot sits between `TermsPast.tsx` and
 * `TermsLapsed.tsx`. */
export const BYGONE_TERMS_VERSION = "2026-11-12.2";
/** The Terms that were "bygone" until 2026-11-23.4 ("previous" until 2026-11-17.1): kept byte for byte at
 * `client/src/pages/TermsLapsed.tsx`, not routed. The `TermsLapsed.tsx` slot sits between `TermsBygone.tsx` and
 * `TermsEarlier.tsx`. */
export const LAPSED_TERMS_VERSION = "2026-11-12.1";
/** The Privacy Policy that was "past" until 2026-11-23.2 ("previous" until 2026-11-13.1; the same words as
 * 2026-11-12.1): kept byte for byte at `client/src/pages/PrivacyBygone.tsx`, not routed. The `PrivacyBygone.tsx` slot
 * sits between `PrivacyPast.tsx` and `PrivacyEarlier.tsx`. */
export const BYGONE_PRIVACY_VERSION = "2026-11-12.2";
/** The Privacy Policy that was "previous" until 2026-11-13.1: kept byte for byte at `client/src/pages/PrivacyEarlier.tsx`, not routed. */
export const EARLIER_PRIVACY_VERSION = "2026-11-02.1";
/** The Terms that were "previous" until 2026-11-12.2: kept byte for byte at `client/src/pages/TermsEarlier.tsx`, not routed. */
export const EARLIER_TERMS_VERSION = "2026-11-02.1";

/**
 * SHA-256 of each legal page's source file, pinned to the version above it. A change to a page's text needs a new
 * version approved by the owner; `client/tests/legalPages.pinned.test.ts` fails on any byte change until both the
 * version and this digest are updated together.
 */
export const LEGAL_PAGE_DIGESTS = {
  "client/src/pages/Terms.tsx": { version: TERMS_VERSION, sha256: "1628d846f2e100486af08a537be52760b9f91980f56e4aa6a9a812151a0eff71" },
  "client/src/pages/Privacy.tsx": { version: PRIVACY_VERSION, sha256: "b15096f220f555ca9ca107d8389ffd1f0f48d1254b74613005f170346999bbb5" },
  "client/src/pages/TermsAnnounced.tsx": { version: ANNOUNCED_SUPERSEDED_VERSION, sha256: "2a56699800d45d0ce2d63598021799a7abbc3027612b1cdfaaf9c0c98cf2cd97" },
  "client/src/pages/PrivacyAnnounced.tsx": { version: ANNOUNCED_SUPERSEDED_VERSION, sha256: "ae47ecfdb9bbf404ac0d070c02816d2a99f7d4460616e8b06435fbbcb3f115f9" },
  "client/src/pages/TermsPrevious.tsx": { version: PREVIOUS_TERMS_VERSION, sha256: "a95e0acdbc1904fa35ccf991a432a3202e854a374050d183fb1ba7f43628c1d1" },
  "client/src/pages/TermsOlder.tsx": { version: OLDER_TERMS_VERSION, sha256: "546909384564aa1bc1a0aee7a56abc63fa347f1a7fc2ed00b2e7e7cd0a870b4b" },
  "client/src/pages/TermsFormer.tsx": { version: FORMER_TERMS_VERSION, sha256: "c34a330db07e8bebb525d5459a3eb86fb01b49e90a0af65b64e4f5b403bfe4dd" },
  "client/src/pages/TermsPrior.tsx": { version: PRIOR_TERMS_VERSION, sha256: "9febe464cf76b6e77b03c72c6f48464c1611dcfb35203d54e600b09d42ad1771" },
  "client/src/pages/TermsPast.tsx": { version: PAST_TERMS_VERSION, sha256: "cb7276aa54fa2044a391900ce89ac1a23c64a0a088bbc7b2de4104390d6135c9" },
  "client/src/pages/TermsBygone.tsx": { version: BYGONE_TERMS_VERSION, sha256: "6370c9c16803d758afa2348c619f300747ee20e66fb420ff5cd88fd29256b231" },
  "client/src/pages/TermsLapsed.tsx": { version: LAPSED_TERMS_VERSION, sha256: "ccb2fb154ddab8e8c052c5870ca13084e461d4f2815c2eb8c7f5454ffbc12f27" },
  "client/src/pages/TermsEarlier.tsx": { version: EARLIER_TERMS_VERSION, sha256: "37a4885464a275f5236ed3dd0edee9b148bbeea9bdc80b6ab7f7b9a4dfb8d7bb" },
  "client/src/pages/PrivacyPrevious.tsx": { version: PREVIOUS_PRIVACY_VERSION, sha256: "8ee31f21a7e98349814556e889de7f610114df60b3c06cbffa128cc274b784b4" },
  "client/src/pages/PrivacyOlder.tsx": { version: OLDER_PRIVACY_VERSION, sha256: "ffda6e2de60e1a97f79321a688482a477bc4c01ff2c3c0923698b350e7917e93" },
  "client/src/pages/PrivacyFormer.tsx": { version: FORMER_PRIVACY_VERSION, sha256: "4bea76fcde690b85752bd60bf7396a270d369921e698dab056b683d561922ccf" },
  "client/src/pages/PrivacyPrior.tsx": { version: PRIOR_PRIVACY_VERSION, sha256: "dd1cf7021b9bcd521dd82d75051649d6a1ec176580d74f22b3870cb9de8db229" },
  "client/src/pages/PrivacyPast.tsx": { version: PAST_PRIVACY_VERSION, sha256: "cc64b063dc906beb69ba2e7ddcdd02cadaf2e27e86c0b59157478cc038eb8099" },
  "client/src/pages/PrivacyBygone.tsx": { version: BYGONE_PRIVACY_VERSION, sha256: "c2a859cb17b3b54629e4b88545a3c950e842f85c4a52d0a2652943fe749e895f" },
  "client/src/pages/PrivacyEarlier.tsx": { version: EARLIER_PRIVACY_VERSION, sha256: "cad7fcac5cc1ec468ab74471a13a5e61a208b697deafd97b4039f01ab38eab3c" },
} as const;
/** The versions the digests above were recorded against; a version bump without a new digest fails the same test. */
export const LEGAL_PAGE_DIGEST_VERSIONS = {
  terms: LIBRARY_MODEL_TERMS_VERSION, privacy: COMPANY_APPLICATION_VERSION, previousTerms: "2026-11-23.3", previousPrivacy: "2026-11-23.1",
  olderTerms: "2026-11-23.2", olderPrivacy: "2026-11-21.1", formerTerms: "2026-11-21.1", formerPrivacy: "2026-11-19.1",
  priorTerms: "2026-11-19.1", priorPrivacy: "2026-11-17.1", pastTerms: "2026-11-17.1", pastPrivacy: "2026-11-13.1",
  bygoneTerms: "2026-11-12.2", bygonePrivacy: "2026-11-12.2", lapsedTerms: "2026-11-12.1", announced: "2026-11-25.1",
  earlierTerms: "2026-11-02.1", earlierPrivacy: "2026-11-02.1",
} as const;

/**
 * The date printed from a version. The pages print their effective date
 * from the same constant acceptance records, so the date a visitor reads is
 * always the version they accept.
 */
export function legalEffectiveDate(version: string): string {
  return new Date(legalEffectiveAtMs(version)).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

/**
 * When a version takes effect: 08:00 UTC on its date, which is midnight Pacific
 * standard time, so the switch is never early anywhere in the continental US.
 */
export function legalEffectiveAtMs(version: string): number {
  const [year, month, day] = version.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 8);
}

/** True while the published Terms or Privacy Policy are announced but not yet in force. */
export function legalUpdatePending(nowMs = Date.now()): boolean {
  return nowMs < Math.max(legalEffectiveAtMs(TERMS_VERSION), legalEffectiveAtMs(PRIVACY_VERSION));
}

export const TERMS_URL = "/terms";
export const PRIVACY_URL = "/privacy";
export const PREVIOUS_TERMS_URL = "/terms/previous";
export const PREVIOUS_PRIVACY_URL = "/privacy/previous";

export interface LegalAcceptanceRecord<TAcceptedAt = unknown> {
  accepted_terms: boolean;
  terms_version: string;
  privacy_version: string;
  terms_url: string;
  privacy_url: string;
  accepted_at: TAcceptedAt;
  accepted_from_ip_hash: string | null;
}

/**
 * Whether an accepted Terms/Privacy pair still counts. New acceptances record
 * the published versions (the signer has seen their date). While an update is
 * announced but not yet in force, an acceptance of the versions in force also
 * counts, so nobody is asked to accept documents early.
 */
/**
 * For a Privacy Policy version, the earlier versions whose acceptance, recorded beside the current Terms, still
 * counts. An earlier version may be listed ONLY when the newer version changes nothing for existing accounts: its
 * changes concern only jobs started and requests sent from then on, so nobody needs to agree again (2026-11-13.1
 * replaced 2026-11-12.2 that way). Keyed by the version that decided it. A new PRIVACY_VERSION with no entry here keeps
 * counting what counted for PREVIOUS_PRIVACY_VERSION (audit G-13), unless it is listed in `LEGAL_VERSIONS_THAT_ASK_AGAIN`;
 * `client/tests/legalAcceptance.privacy-current.test.ts` pins the result.
 */
const EARLIER_PRIVACY_VERSIONS_STILL_COUNTING: Readonly<Record<string, readonly string[]>> = {
  "2026-11-13.1": ["2026-11-12.2"],
  // 2026-11-17.1 changes only what happens to jobs started under it (no face blurring); every version that counted
  // beside the current Terms before it still counts (owner, 2026-11-17: earlier acceptances keep counting).
  [NO_FACE_BLUR_VERSION]: ["2026-11-13.1", "2026-11-12.2"],
  // 2026-11-19.1 only narrows (no early trial: one use and one shared item fewer); every version that counted beside
  // the current Terms before it still counts, and nobody is asked again.
  [NO_EARLY_TRIAL_VERSION]: [NO_FACE_BLUR_VERSION, "2026-11-13.1", "2026-11-12.2"],
  // 2026-11-21.1 corrects the policy to what the Service already does and asks nothing new (owner, 2026-11-21); every
  // version that counted beside the current Terms before it still counts, and nobody is asked again.
  [LAUNCH_COPY_VERSION]: [NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, "2026-11-13.1", "2026-11-12.2"],
  // 2026-11-23.1 changes one sentence, about what a company sees of a job started under it (owner, 2026-11-23); every
  // version that counted beside the current Terms before it still counts, and nobody is asked again.
  [CITY_STATE_PRIVACY_VERSION]: [LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, "2026-11-13.1", "2026-11-12.2"],
  // 2026-11-23.2 says what a site sees of an answer given under the answer line `company-response-2026-11-23` (a
  // company's name and website) and that a site accepts a company (owner, 2026-11-23); the line, not the policy, lets the
  // name reach a site, so every version that counted beside the current Terms before it still counts, and nobody is
  // asked again.
  [COMPANY_APPLICATION_VERSION]: [CITY_STATE_PRIVACY_VERSION, LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION,
    "2026-11-13.1", "2026-11-12.2"],
};

/**
 * Terms or Privacy versions that ask everyone again (audit G-13, owner decision pending): an earlier acceptance does not
 * count for them. A version that changes what a deployment company may do with a job MUST be listed here, or its
 * acceptance would bind companies that never agreed to it. Any other new version keeps counting earlier acceptances.
 */
export const LEGAL_VERSIONS_THAT_ASK_AGAIN: ReadonlySet<string> = new Set<string>([]);

/**
 * The versions that count beside `version`: its own entry when one is written; else, unless it asks again, the
 * previous version and what counted for that one; else only itself.
 */
export function versionsStillCounting(version: string, previous: string,
  earlier: Readonly<Record<string, readonly string[]>>, asksAgain: ReadonlySet<string> = LEGAL_VERSIONS_THAT_ASK_AGAIN): Set<string> {
  const decided = earlier[version];
  if (decided) return new Set([version, ...decided]);
  if (asksAgain.has(version) || previous === version) return new Set([version]);
  return new Set([version, previous, ...(earlier[previous] ?? [])]);
}

export const PRIVACY_VERSIONS_CURRENT_WITH_TERMS: ReadonlySet<string> =
  versionsStillCounting(PRIVACY_VERSION, PREVIOUS_PRIVACY_VERSION, EARLIER_PRIVACY_VERSIONS_STILL_COUNTING);

/**
 * For a Terms version, the earlier Terms versions whose acceptance still counts. Until 2026-11-17.1 every Terms change
 * asked everyone again; an earlier version may be listed ONLY when the newer Terms change nothing for existing accounts
 * and deployment companies: their changes concern only jobs started from then on. Keyed by the version that decided it.
 * A new TERMS_VERSION with no entry here keeps counting what counted for PREVIOUS_TERMS_VERSION (audit G-13), unless it
 * is listed in `LEGAL_VERSIONS_THAT_ASK_AGAIN` (then everyone, deployment companies included, is asked again;
 * `server/utils/companyTerms.ts`); `client/tests/legalAcceptance.terms-current.test.ts` pins the result.
 */
const EARLIER_TERMS_VERSIONS_STILL_COUNTING: Readonly<Record<string, readonly string[]>> = {
  // 2026-11-17.1 changes only what happens to jobs started under it (no face blurring), so an account or a deployment
  // company that accepted 2026-11-12.2 keeps everything it had (owner, 2026-11-17: nobody is asked to accept again, and
  // no deployment company loses access). 2026-11-12.1 and older were already asked again and stay so.
  [NO_FACE_BLUR_VERSION]: ["2026-11-12.2"],
  // 2026-11-19.1 only narrows (no early trial), so every Terms version that counted before it still counts: no account
  // or deployment company is asked again, and none loses access.
  [NO_EARLY_TRIAL_VERSION]: [NO_FACE_BLUR_VERSION, "2026-11-12.2"],
  // 2026-11-21.1 corrects the Terms to what the Service already does and asks nothing new of an account or a deployment
  // company (owner, 2026-11-21), so every Terms version that counted before it still counts: nobody is asked again, and
  // no deployment company loses access.
  [LAUNCH_COPY_VERSION]: [NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, "2026-11-12.2"],
  // 2026-11-23.2 says what a site sees of an answer given under the answer line `company-response-2026-11-23` and that a
  // site accepts a company (owner, 2026-11-23). It asks nothing new of an account or a deployment company: a company's
  // name reaches a site only under the line it answered under, not under the Terms. So every Terms version that counted
  // before it still counts: nobody is asked again, and no deployment company loses access.
  [COMPANY_APPLICATION_VERSION]: [LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, "2026-11-12.2"],
  // 2026-11-23.3 says that an estimate a deployment company gives with its answer is its own, given before a site
  // visit, and not a quote (owner, 2026-11-23: "yes build it this way"). It asks nothing new of an account or a
  // deployment company: an estimate reaches a site only under the answer line it was given under
  // (`company-response-2026-11-23.2`), not under the Terms, as a company's name and reason already do. So every Terms
  // version that counted before it still counts: nobody is asked again, and no deployment company loses access.
  [COMPANY_ESTIMATE_TERMS_VERSION]: [COMPANY_APPLICATION_VERSION, LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION,
    "2026-11-12.2"],
  // 2026-11-23.4 says that a model in a simulation that comes from a public library stays under that library's license,
  // and that Blueprint does not own it and the Terms do not restrict it (owner, 2026-11-23). It only loosens: it asks
  // nothing new of an account or a deployment company and binds nobody to more than they agreed to. So every Terms
  // version that counted before it still counts: nobody is asked again, and no deployment company loses access.
  [LIBRARY_MODEL_TERMS_VERSION]: [COMPANY_ESTIMATE_TERMS_VERSION, COMPANY_APPLICATION_VERSION, LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION,
    NO_FACE_BLUR_VERSION, "2026-11-12.2"],
};
export const TERMS_VERSIONS_CURRENT: ReadonlySet<string> =
  versionsStillCounting(TERMS_VERSION, PREVIOUS_TERMS_VERSION, EARLIER_TERMS_VERSIONS_STILL_COUNTING);

export function acceptedVersionsAreCurrent(terms: unknown, privacy: unknown, nowMs = Date.now()): boolean {
  // Each document on its own: the current version counts; while a document's update is announced but not yet in
  // force, its previous version counts too, so nobody is asked to accept a document early.
  const termsCurrent = (typeof terms === "string" && TERMS_VERSIONS_CURRENT.has(terms))
    || (nowMs < legalEffectiveAtMs(TERMS_VERSION) && terms === PREVIOUS_TERMS_VERSION);
  const privacyCurrent = (typeof privacy === "string" && PRIVACY_VERSIONS_CURRENT_WITH_TERMS.has(privacy))
    || (nowMs < legalEffectiveAtMs(PRIVACY_VERSION) && privacy === PREVIOUS_PRIVACY_VERSION);
  if (termsCurrent && privacyCurrent) return true;
  // The same corrected text, published earlier on 2026-11-02 under the announced
  // November 15 date. The earlier November 15 pairs said people were removed
  // from footage, so they no longer count.
  // They counted as 2026-11-02.1, which is now the previous version.
  // Only while a Terms update is announced: it was a Terms-and-Privacy pair.
  if (nowMs >= legalEffectiveAtMs(TERMS_VERSION)) return false;
  return terms === "2026-11-15.4" && privacy === "2026-11-15.5";
}

/** The Terms and Privacy versions a form showed when the person accepted. */
export type ShownLegalVersions = { terms_version: string; privacy_version: string };

/**
 * What a form that sends the versions it showed may record: those versions, exactly, when they still count as
 * current (`acceptedVersionsAreCurrent`); otherwise null, and the route refuses as it always has. A recorded version
 * is never rewritten to the current one: a page opened before a Privacy change records the Privacy version it showed.
 */
export function shownVersionsCount(terms: unknown, privacy: unknown, nowMs = Date.now()): ShownLegalVersions | null {
  return typeof terms === "string" && typeof privacy === "string" && pageShowedPair(terms, privacy)
    && acceptedVersionsAreCurrent(terms, privacy, nowMs) ? { terms_version: terms, privacy_version: privacy } : null;
}

/**
 * The Terms/Privacy pairs a page has shown together, most recent first: the current pair, and the pairs forms showed
 * before it that still count. A form records only one of these, so a hand-made request cannot record a pair no page
 * showed (for example Terms 2026-11-12.2, which promises the face blur, beside Privacy 2026-11-17.1, which ends it for
 * the job). A new version adds the pair forms showed until then.
 */
export const PAIRS_A_PAGE_SHOWED: readonly ShownLegalVersions[] = [
  { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
  // Forms from Terms 2026-11-23.3 until Terms 2026-11-23.4.
  { terms_version: COMPANY_ESTIMATE_TERMS_VERSION, privacy_version: COMPANY_APPLICATION_VERSION },
  // Forms from 2026-11-23.2 until Terms 2026-11-23.3.
  { terms_version: COMPANY_APPLICATION_VERSION, privacy_version: COMPANY_APPLICATION_VERSION },
  // Forms from Privacy 2026-11-23.1 until 2026-11-23.2.
  { terms_version: LAUNCH_COPY_VERSION, privacy_version: CITY_STATE_PRIVACY_VERSION },
  // Forms from 2026-11-21.1 until Privacy 2026-11-23.1.
  { terms_version: LAUNCH_COPY_VERSION, privacy_version: LAUNCH_COPY_VERSION },
  // Forms from 2026-11-19.1 until 2026-11-21.1.
  { terms_version: NO_EARLY_TRIAL_VERSION, privacy_version: NO_EARLY_TRIAL_VERSION },
  // Forms from 2026-11-17.1 until 2026-11-19.1.
  { terms_version: NO_FACE_BLUR_VERSION, privacy_version: NO_FACE_BLUR_VERSION },
  // Forms from Privacy 2026-11-13.1 until 2026-11-17.1.
  { terms_version: "2026-11-12.2", privacy_version: "2026-11-13.1" },
  // Forms from 2026-11-12.2 until Privacy 2026-11-13.1 (and every start form that sends no versions).
  { terms_version: "2026-11-12.2", privacy_version: "2026-11-12.2" },
];
function pageShowedPair(terms: string, privacy: string) {
  return PAIRS_A_PAGE_SHOWED.some(pair => pair.terms_version === terms && pair.privacy_version === privacy);
}

/**
 * The versions every site start form showed before forms sent the versions they show (before Privacy 2026-11-13.1).
 * A start form that sends none was opened before this release, so this is what its line showed.
 */
export const START_FORM_VERSIONS_BEFORE_SENT: ShownLegalVersions = { terms_version: "2026-11-12.2", privacy_version: "2026-11-12.2" };

/** Recognize a prior server-recorded acceptance of the current documents. */
export function isCurrentLegalAcceptance(value: unknown): value is LegalAcceptanceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.accepted_terms === true &&
    acceptedVersionsAreCurrent(record.terms_version, record.privacy_version) &&
    record.terms_url === TERMS_URL &&
    record.privacy_url === PRIVACY_URL &&
    record.accepted_at != null;
}

/**
 * Build the persisted acceptance record. The Terms/Privacy versions and the
 * document URLs are sourced from the server-side constants above (not from the
 * client payload), and `acceptedAt` is provided by the caller (a Firestore
 * server timestamp on the real write path, an ISO string on the dev fallback).
 */
export function buildLegalAcceptanceRecord<TAcceptedAt>(params: {
  acceptedAt: TAcceptedAt;
  acceptedFromIpHash?: string | null;
  /** The versions the person was shown, when the route knows them and `shownVersionsCount` accepted them. */
  shown?: ShownLegalVersions | null;
}): LegalAcceptanceRecord<TAcceptedAt> {
  return {
    accepted_terms: true,
    terms_version: params.shown?.terms_version ?? TERMS_VERSION,
    privacy_version: params.shown?.privacy_version ?? PRIVACY_VERSION,
    terms_url: TERMS_URL,
    privacy_url: PRIVACY_URL,
    accepted_at: params.acceptedAt,
    accepted_from_ip_hash: params.acceptedFromIpHash ?? null,
  };
}
