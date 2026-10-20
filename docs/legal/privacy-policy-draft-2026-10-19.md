# Privacy Policy — review draft

Prepared October 19, 2026. **Draft for founder and counsel review; not adopted or
effective.** This draft does not replace the published policies, extend retention
for existing recordings, or authorize a new provider or use. Review the
[source-based service inventory](../security/third-party-data-inventory-2026-10-19.md)
and the [existing retention review](../launch-readiness/2026-10-16-retention-and-recording-counsel-review.md)
before adoption. The proposed wording below describes the consent and deletion
request changes in this worktree; those changes are not yet deployed.

## Who we are and how to contact us

Blueprint Robotics, Inc. (Blueprint, we, us) provides tryblueprint.io, Blueprint
accounts, private job links and our API. Our mailing address is 6801 Burnet Rd,
Austin, TX 78757. For privacy questions or requests, email
[privacy@tryblueprint.io](mailto:privacy@tryblueprint.io). For legal questions,
email [legal@tryblueprint.io](mailto:legal@tryblueprint.io).

We are responsible for personal information used to operate our service. Where
we process information solely on a business customer's instructions, a signed
data-processing agreement may govern that processing. You may still contact us
directly about information concerning you, including appearances in footage.

## Information we receive

- **Accounts and contacts:** name, email, company, role, phone number, sign-in
  provider, account identifier, preferences, invitations and support messages.
- **Jobs and sites:** address, location, work-area details, job descriptions,
  requirements, briefing answers, permissions, restricted areas, booking details
  and the contact details needed to coordinate a pilot.
- **Footage:** uploaded video and photos, timestamps, and available motion,
  depth and location metadata. Original uploads may include people, conversations,
  screens or documents. Our browser recorder records without sound. We keep
  uploaded originals as received, remove sound before automated review or
  disclosure to AI/3D-processing providers, and do not analyze speech. People
  are removed from reconstruction-input frames, not necessarily from originals.
- **Robot teams:** organization, robot and policy configuration, container or
  endpoint references, scoped access credentials, evaluation requests, logs,
  outputs and results. Do not place secrets in ordinary descriptions or messages.
- **Communication:** emails, filming-link text messages, support requests and,
  when you use an enabled voice service, the conversation and call metadata.
- **Technical information:** IP address, browser/device information, request
  timestamps, security and error logs. With your permission, analytics events
  describe page use and interactions. Optional analytics are not intended to
  collect recordings, access credentials or form contents.
- **Earlier purchases:** receipt, transaction, balance, billing and refund
  records. The free beta does not create new charges. Stripe handles card
  information in the payment services it provides; do not send us card numbers.
- **Business research:** company information and work contact details from
  public websites, search results, approved research sources or an authorized
  colleague. Ask us for the source of a record about you.

## Why we use it

We use information to operate accounts; respond to requests; prepare job briefs
and reconstructed scenes; invite and evaluate robot teams; explain results;
recommend and coordinate a pilot; send service messages; prevent abuse; resolve
support and privacy requests; and meet legal obligations. Physical-pilot data
is received and used only under the parties' agreed permissions. Simulation
results are estimates, not physical-performance or safety certifications.

Where EU or UK data protection law applies, the proposed bases are performance
of our agreement with an individual customer; our legitimate interests in
providing business services, communicating with business representatives and
protecting the service; legal obligations; and consent where required,
including optional browser tracking. Withdrawing consent does not invalidate
processing carried out before withdrawal. Business authorization to record a
site does not replace any notice or permission required for the people recorded.

Required contact, account and permission information is necessary to provide
the requested service. If you do not provide it, we may be unable to open an
account, process footage or coordinate a pilot. You can refuse optional analytics.
We do not sell personal information or license footage for training without a
separate written agreement. Our job recommendations concern business tasks and
robot evaluations; contact us to request human review or correction.

## Providers and other recipients

The table lists recipients supported by the audited application and its
connected processing workflow. **Conditional integrations receive information
only when the relevant feature is enabled and used; a name here does not mean
that every visitor's data is sent there.** Frozen research and marketing lanes
are not activated by this policy. Additional recipients or materially different
uses require review and any required notice or permission before activation.

| Service | Information and purpose |
| --- | --- |
| Google Firebase / Google Cloud | Account identity, sign-in data, database records, uploaded files, access metadata and service logs for authentication, storage and processing. |
| Render | Requests, IP/device metadata, application records processed by the API, operational logs and background jobs. |
| Backblaze B2 | Uploaded footage, file metadata and authorized storage/retrieval requests. |
| DigitalOcean | Internal operations hosting; job/company details and operational records routed there. |
| Redis hosting, if configured | Session, workflow, rate-limit and cache data. The actual hosting company must be identified before publication if it is a separate recipient. |
| Stripe | Historical customer, billing, transaction, balance, refund and payment-account records; no new beta charges. |
| Resend | Recipient email, message contents, service links and delivery/bounce metadata. |
| Google Workspace (Gmail, Drive, Sheets, Calendar) | Correspondence, company/contact and job records, documents, booking attendees, locations and scheduling details used by our team. |
| Slack and Notion | Internal support, company/job details, alerts, review and operational records. |
| Twilio | Phone numbers, text messages and filming links; when voice is enabled, call inputs and metadata. |
| ElevenLabs | Assistant reply text and enabled voice conversation content. |
| Calendly | A booking service opened when you follow a scheduling link; receives the details you provide there and associated browser metadata under its privacy notice. |
| Google Analytics | Consented page/event and browser/device information; analytics and marketing choices control its operation. |
| PostHog | Consented product events and browser/device information; session recording is disabled in the proposed implementation. |
| Sentry | Error details and diagnostic browser/device information; error monitoring is separate from optional analytics. |
| Google Maps Platform | Site address search text, place selections, browser metadata and any location you choose to provide. |
| Photon / Komoot | Address searches and requested coordinates when the fallback location feature is used. |
| Google Fonts and Cloudflare cdnjs | IP address and browser request metadata when delivering fonts or scripts. |
| Google reCAPTCHA Enterprise / Firebase App Check | IP address, device/software signals and request integrity data for abuse prevention. |
| OpenAI | Relevant job text and capture frames for job drafting/review; authorized email, document, conversation history and tool-result content for configured communications/research; public venue text for embeddings. |
| Google Gemini | Job text and authorized footage with sound removed for review, drafting and privacy checks; selected knowledge files, research context and creative-generation inputs in separately configured workflows. |
| Anthropic | Capture frames only when the site's explicit Anthropic option is chosen, plus prompts/documents for separately configured internal tasks. |
| DeepSeek and Z.ai | Task prompts, conversation context and tool results in configured internal agent workflows. |
| World Labs | Authorized footage with sound removed and scene-generation inputs to reconstruct the work area. |
| Vast.ai | Authorized footage/scene files, policies and evaluation inputs/outputs on rented GPU infrastructure in the connected pipeline. |
| OpenRouter and the selected upstream model provider | Prompt and image URL for optional video generation. The code default names ByteDance Seedance; actual upstream selection must be disclosed for an activated feature. |
| Luma | Authenticated image-generation inputs forwarded to its image API if that optional route is enabled. |
| Jina Reader | Requested public webpage URL for public-page retrieval. |
| Parallel and Brave Search | Business-research search text and requested public URLs in configured research tooling. |
| Meta Marketing | Authorized campaign, creative and audience configuration in optional operations tooling; the audit did not find a browser Meta tracking pixel. |

Additional HTTP research/enrichment endpoints, remote agent endpoints and
externally supplied media hosts also exist as
conditional capabilities. Their exact recipients must be identified from the
active configuration before use and reflected in this notice. FullEnrich and
Clay appear as imported research provenance, not confirmed direct WebApp APIs.
The internal inventory also covers developer tooling such as GitHub and
monitoring services, and distinguishes those from customer-facing processors.

Approved robot teams can see the anonymized job card the site authorized and
their own evaluation results. Scenes, rendered observations and result records
are shared only within the site's permissions. Raw walkthrough recordings are
never delivered to robot teams. Booking shares the relevant contact details
between the site and the recommended team. Information may also be disclosed
where law requires it, to address safety or security, or in a business transfer
subject to applicable protections.

## Cookies and browser choices

Necessary storage supports sign-in, request security, cookie preferences and
unsent drafts. Google Analytics, PostHog and optional first-party analytics
events stay off until you choose the corresponding analytics or marketing
permission. Declining consent still allows necessary service/security requests.
Session recording is disabled. Use **Cookie settings** in the footer to change
your choice. A Global Privacy Control signal keeps analytics and marketing off
unless you subsequently make an explicit choice as allowed by applicable law.

## Retention, account closure and deletion

Existing footage keeps the terms that applied when it was collected, including
the earlier schedule of 180 days after job closure where applicable. A later
policy acceptance does not extend it. A job closes on the earliest of a request
to close/delete it or 12 months with no site, team or Blueprint activity;
withdrawing recording permission stops use of the footage from that point.
Hiding a listing alone does not close a job.

Temporary processing storage has a 14-day policy window. Scene, evaluation and
report records have a 365-day-after-job-close or contract-end window, unless a
separate authorized agreement governs physical-pilot data. Account/contact
details are retained while the account or job is open, then deleted or
anonymized subject to documented exceptions. Support/privacy correspondence has
a 90-day-after-request-close policy window. Tax, payment, fraud/security and
legal-hold records may need longer retention as required or justified by law.
These are policy obligations; not all scheduled deletion is automated today.

Use **Settings → Account deletion** to submit an authenticated account and data
deletion request and view its reference/status. The request is recorded for
review; it does not mean every copy is instantly erased or the account has
already closed. Our team must resolve shared site/team ownership, stop or
withdraw authorized processing, remove or anonymize applicable records and
coordinate with providers. Legal holds and required financial/security records
may limit deletion. We explain retained categories and reasons. Backup handling
and downstream deletion must be checked as part of the request.

You can also email privacy@tryblueprint.io, including if you cannot sign in or
appear in footage without an account. We may request only what is reasonably
necessary to confirm your identity and authority. We acknowledge requests within
10 business days and aim to respond within 30 calendar days of receipt, subject
to applicable law. Any lawful identity-related pause or extension will be
explained; identity verification does not automatically restart the legal clock.

## Your rights, transfers and security

Depending on applicable law, you may access, correct, delete or receive a copy of
your information, restrict or object to processing, withdraw consent and opt out
of sale/sharing for advertising. Authorized agents may act with appropriate
authority. We do not discriminate for exercising these rights. You may object
to direct marketing at any time. EU/UK residents may complain to their local
supervisory authority or the UK Information Commissioner's Office at ico.org.uk.

The beta is directed to US businesses. Service providers may process information
in the US or other locations. Before accepting a site/team outside the US, we
require the applicable reviewed transfer arrangements. Ask us for information
about relevant safeguards; do not assume that a provider listing proves a
particular transfer agreement or storage region.

We use access controls, encrypted transport and provider storage protections.
Protection and retention vary by system; no system is perfectly secure. We will
notify affected people and authorities where required. The service is for adults
acting for businesses and is not directed to children.

We will publish material updates with an effective date and provide the notice
required by existing terms and law. An update does not retroactively expand
uses or retention for previously collected data.

## Adoption checks (remove this internal section only after review)

Confirm the legal entity, authority to receive mail at the address, and monitored
privacy/legal inboxes. Resolve exact live recipients, Redis/remote-agent
hosts, vendor contracts/regions/training settings, Sentry sanitization and
browser consent behavior. Confirm legal bases, any representative requirements,
California applicability and treatment of GPC. Review recording consent and
retention by collection cohort. Assign and exercise deletion operations,
provider/backup handling and response deadlines. Keep the proposed seven-year
recording extension out until separately approved. Resolve the prior banner-only
notice choice against existing email-notice promises; do not send notices without
the required recipient-specific authority.

Sources checked October 19, 2026: [ICO privacy-notice contents](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/),
[ICO consent controls](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/).
