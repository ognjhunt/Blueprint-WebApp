import { Shield, SlidersHorizontal, SquareStack, Waypoints } from "lucide-react";
import { SEO } from "@/components/SEO";
import { openCookieSettings } from "@/components/CookieConsent";
import { PreviousLegalVersionNote } from "@/components/site/LegalVersionNotes";
import { COMPANY } from "@/data/company";
import { PREVIOUS_PRIVACY_URL, PREVIOUS_PRIVACY_VERSION, legalEffectiveDate } from "@/lib/legalAcceptance";

/**
 * FROZEN: the Privacy Policy of version 2026-11-23.1, in force from 2026-11-23 until version 2026-11-23.2 replaced it
 * the same day (owner, 2026-11-23: a deployment company applies to a job, and a site sees its name and website and
 * accepts the companies it wants to meet). Its sections are copied word for word from `Privacy.tsx` as it stood at
 * 2026-11-23.1. Do not edit the sections: they are the policy as it stood. Change Privacy.tsx instead.
 */
const SHARING_SENTENCE = "Starting a job means that, once it has its video, we share it with robot deployment companies we've approved, so they can decide without a visit whether they can do it. We share your description of the job, your video without its sound, the simulation we build from it, what counts as the job done, and our first look at which robots fit.";
const CONTACT_DETAILS_SENTENCE = "We do not share your name, your street address or your contact details with a deployment company unless you ask for an introduction to it.";
const COMPANY_USE_SENTENCE = "A deployment company may use your job only to decide whether it can do it. It may not pass it on, use it to train software, or keep it after we ask it to delete it.";
const WITHDRAWAL_SENTENCE = "You can withdraw your job at any time from its page. It then leaves every company's view at once, and we ask any company that saved a copy to delete it. We cannot take back a copy a company has already saved.";
const OLDER_JOB_SENTENCE = "A job started before November 12, 2026 is shared with companies only after you agree to share it on the job's page.";
const COMPANY_ALIAS_SENTENCE = "A site sees your answer and the reason you give, under an alias, with your company's name and contact details taken out. It sees your company's name and your contact details only when it asks for an introduction after you answered Interested or Tested it: can do.";

const privacyPolicySections = [
  {
    title: "What we collect",
    body:
      "What you give us: your name, work email, company, role and phone number; the site and job you describe; your answers to our questions about the job; account details; and messages you send us. After an introduction, we ask the site and the deployment company what happened, and keep their answers. If a site and a deployment company agree to share a physical pilot's outcomes with Blueprint, we may also receive its scope, milestones and operating measurements under those permissions. Deployment companies give us their company's name, a contact name, email and website, and their answers about jobs. Nothing is charged today; Stripe holds the records of payments made before the free beta. What we collect automatically: your IP address, browser and device type, pages you visit, and errors the website runs into.",
    icon: SquareStack,
  },
  {
    title: "Site footage",
    body:
      `When a site films its job, we receive the video and photos, when and where they were taken, and the phone's motion and depth data where available. A phone video can show people and can include sound, such as conversations nearby. We keep the original upload as received, including any sound, for the uses and retention periods in this policy. We remove the sound before any automated review of the footage, before sending it to an AI or 3D-processing provider, and before a deployment company sees it, and we do not analyze speech. We and our listed processing providers use the footage to draft and check the job description and to build the simulation. ${SHARING_SENTENCE} We do not remove people from job footage or blur them. Blueprint and the listed processing providers, World Labs included, receive the footage, with its sound removed, or frames from it as recorded, which can show people. For a job started under a version of this policy published before November 17, 2026, we still blur faces in the frames we send to World Labs to rebuild the work area. Companies see your video as you filmed it, without its sound. We ask sites to avoid screens and paperwork.`,
    icon: Waypoints,
  },
  {
    title: "How we use it",
    body:
      "To run the Service: to reply to you; to set up your job or account; to draft the job description and build the simulation; to share each job with the deployment companies we approve; to make the introductions a site asks for and ask both sides afterwards what happened; to record a physical pilot's outcomes only under the parties' agreed permissions; to send the emails you need, such as a job update or a company's answer; to keep the Service secure and prevent fraud; to see how the website is used so we can improve it; and to meet our legal obligations. We do not sell personal information, and we do not use your footage to train AI models without your written agreement. The only use that California law could treat as sharing for cross-context behavioral advertising is the optional marketing cookies described below, which are off unless you turn them on.",
    icon: Shield,
  },
  {
    title: "Your choices",
    body:
      `Depending on where you live, you can ask to access, correct, delete or get a copy of your personal information, object to or restrict how we use it, and withdraw consent you gave, including consent to use your footage. ${WITHDRAWAL_SENTENCE} You can also change your cookie choices at any time, and we treat a Global Privacy Control signal from your browser as a choice to keep analytics and marketing cookies off.`,
    icon: SlidersHorizontal,
  },
] as const;

const capturePrivacyAnnex = [
  // Sharing is the service (owner, 2026-11-12): the video goes, without its sound, to the deployment companies Blueprint
  // approves, only so they can decide whether they can do the job. Name, address and contacts go only through an introduction
  // the site asks for.
  ["Your video", `We and our listed providers use your recording to draft and check the job description and to build the simulation. It is shared, without its sound, only with the robot deployment companies we approve, and only so they can decide whether they can do the job. ${COMPANY_USE_SENTENCE}`],
  ["People in job footage", "We do not remove people from job footage or blur them. Blueprint and the listed processing providers, World Labs included, receive the footage, with its sound removed, or frames from it as recorded, which can show people. For a job started under a version of this policy published before November 17, 2026, we still blur faces in the frames we send to World Labs to rebuild the work area. Companies see your video as you filmed it, without its sound. You must have authority to submit the footage, tell people in the work area that you are recording and sharing the video with Blueprint and with the robot deployment companies we approve, and obtain any permission the law requires from people who can be seen or heard."],
  ["Sound", "Phone videos can record sound, including conversations; Blueprint's browser recorder films without it. We keep an uploaded original as received, remove the sound before any automated review, before sending footage to an AI or 3D-processing provider and before a deployment company sees it, and do not analyze speech. Avoid filming conversations, and turn sound off where your camera allows."],
  ["Screens and paperwork", "Avoid them when filming where practical: companies see your video as you filmed it."],
  ["Location", "Used to tie the job to the right site. A deployment company sees the city, state and country of the job, not the address you typed."],
  ["Deployment companies", `${SHARING_SENTENCE} ${CONTACT_DETAILS_SENTENCE} ${OLDER_JOB_SENTENCE}`],
  ["Withdrawal", WITHDRAWAL_SENTENCE],
  ["After an introduction", "We ask the site and the deployment company what happened, up to three times (14, 45 and 90 days after the introduction), and record their answers on the job. If the site and the company also agree to share a pilot's records with us, that agreement sets what we receive, who may see it and how it may be used."],
];

const rolePrivacyAnnex = [
  {
    title: "Deployment companies",
    body: `Your account holds your company's name, the contact details you give us and your answers about jobs. ${COMPANY_ALIAS_SENTENCE} When a site asks for an introduction, we give you the site's name, address and contact details.`,
  },
  {
    title: "Sites",
    body: "Your job holds your contact details, the site's address, the job description, your footage, the answers deployment companies gave, the introductions you asked for and what each side told us happened after.",
  },
];

/** What starts the retention clock for a job's records. */
const jobClosedDefinition =
  "A job closes on the earliest of: the site owner asking us to close or delete the job; the site owner withdrawing permission to use the recording (for the footage, from that moment); or 12 months passing with no activity on the job from the site, a deployment company or Blueprint.";

/**
 * The one retention schedule. It replaced a second, vaguer list that sat above
 * it and disagreed with it.
 *
 * Storage configuration describes implementation, not permission to extend
 * the earlier site-facing promise. A later account acceptance never changes
 * the terms of existing footage. The remaining notice/legal review and
 * scheduled-deletion gap are tracked in the counsel packet.
 */
const betaRetentionSchedule = [
  {
    record: "Site footage and capture data",
    defaultWindow: "Existing recordings keep their original retention terms; longer retention requires separate authorization",
    notes: "The video, photos, timestamps, motion and depth data, the frames and any blurred copies we make from them and store with them, and the record of the site's authority and privacy review. Recordings collected under the version of this policy effective October 13, 2026 keep its 180 days after the job closes schedule, subject to applicable legal holds. Publishing this update, reaching its effective date, or accepting it later does not extend that period for existing recordings. A proposed period of at least 7 years for newly collected recordings requires legal review and the notice and authorization applicable to those recordings before it can apply. Our storage does not currently delete originals automatically on a schedule; that configuration does not override the applicable retention terms. Withdrawal and verified deletion requests use our deletion process, after we confirm the request and check for any legal hold. When a site withdraws permission, we stop using the recording from that moment.",
  },
  {
    record: "Temporary processing files",
    defaultWindow: "14 days after they are created",
    notes: "Scratch files from processing footage that sit in our temporary processing storage, unless a legal hold applies. Frames and any blurred copies stored with the capture are kept like the capture.",
  },
  {
    record: "Simulations, company answers, introductions and reports",
    defaultWindow: "365 days after the job closes or the contract ends",
    notes: "The simulation, the answers deployment companies gave, introductions, what each side told us happened after, and reports. Physical pilot records are included only under a separate agreement, which may set a different retention period and permitted use.",
  },
  {
    record: "Account and contact details",
    defaultWindow: "While your account or job is open",
    notes: "Deleted or anonymized after you close your account, your job closes, or we complete a verified deletion request, unless a record below still needs them.",
  },
  {
    record: "Support and privacy requests",
    defaultWindow: "90 days after the request is closed",
    notes: "The messages and the record of what we did.",
  },
  {
    record: "Payment, tax, security and legal records",
    defaultWindow: "As long as the law requires",
    notes: "Includes records of payments made before the free beta. US tax records are typically kept for up to 7 years. Records under a legal hold, or needed to investigate fraud or a security incident, are kept until the matter is resolved.",
  },
] as const;

const privacyRightsRequestSteps = [
  `Email ${COMPANY.emails.privacy} from the address on your account, or include enough detail for us to find your records and confirm they are yours. Tell us what you would like us to do.`,
  "We acknowledge your request within 10 business days and complete it within 30 calendar days of confirming your identity. If we need longer, we tell you why.",
  "We may keep some information when the law requires it, or when it is needed for a payment record, a legal claim, fraud prevention or security. If so, we tell you what we kept and why.",
  "We do not charge for a request, and we do not treat you differently for making one. An authorized agent can make a request for you with your written permission.",
] as const;

/** California (CCPA as amended by the CPRA). */
const californiaPrivacyRows = [
  ["Selling", "We do not sell personal information, and we have not sold it in the past 12 months. We do not knowingly sell or share the personal information of anyone under 16."],
  ["Sharing for advertising", "If you turn on marketing cookies, Google Analytics may use them to measure whether our outreach and ads work. California law can treat that as sharing personal information for cross-context behavioral advertising. It happens only after you turn marketing cookies on, and you can turn them off at any time in cookie settings."],
  ["Global Privacy Control", "If your browser sends a Global Privacy Control signal, we treat it as your request to opt out of sale and sharing: analytics and marketing cookies stay off and are not pre-selected. You can still turn them on yourself in cookie settings."],
  ["Sensitive information", "We do not use sensitive personal information to infer characteristics about you, and we use it only as needed to provide the Service."],
  ["Your rights", "California residents can ask to know, access, correct or delete their personal information and to opt out of sale or sharing, as described above, without being treated differently for asking."],
] as const;

/** Every provider that can receive personal information, by what it does. */
const privacySubprocessorCategories = [
  {
    category: "Hosting and storage",
    providers: [
      ["Google Cloud and Firebase", "Accounts and sign-in, database, file storage, hosting"],
      ["Render", "Application and API hosting and background jobs"],
      ["Backblaze B2", "Storage for uploaded footage"],
      ["DigitalOcean", "Hosting for our internal operations tools, which can receive the company and job details from a request"],
    ],
  },
  {
    category: "Payment records",
    providers: [["Stripe", "Records, receipts and refunds of payments made before the free beta. No new charges are made during the beta."]],
  },
  {
    category: "Email and communication",
    providers: [
      ["Resend", "Sending the emails the Service sends you"],
      ["Google Workspace", "Our email and documents"],
      ["Slack", "Internal alerts to our team, which can include your name, email and job"],
      ["Notion", "Internal operations and support records"],
      ["Twilio", "Text messages that send a filming link to a phone number you give us"],
    ],
  },
  {
    category: "Analytics and error monitoring",
    providers: [
      ["Google Analytics", "Website analytics, with cookies only if you allow analytics or marketing cookies"],
      ["PostHog", "Product analytics, with cookies only if you allow analytics"],
      ["Sentry", "Error reports from the website, which can include your browser, IP address and the page you were on"],
    ],
  },
  {
    category: "Maps and content delivery",
    providers: [
      ["Google Maps Platform", "Address suggestions when you type a site's location"],
      ["Photon (Komoot)", "Address suggestions when Google's are unavailable"],
      ["Google Fonts and Cloudflare (cdnjs)", "Deliver fonts and open-source scripts to your browser, which receive your IP address"],
    ],
  },
  {
    category: "Abuse prevention",
    providers: [["Google reCAPTCHA Enterprise, through Firebase App Check", "Confirming that a job submission or footage upload comes from our website rather than an automated script"]],
  },
  {
    category: "AI, 3D processing and compute",
    providers: [
      ["OpenAI", "Reading what the site wrote about the job and frames from its video to draft the job description and prepare the simulation, drafting replies, and sorting incoming requests"],
      ["Google Gemini", "Watching site footage, with its sound removed, and frames from it, together with what the site wrote about the job, to draft and check the job description and to find what the simulation needs"],
      ["Meta", "Outlining objects and areas in site footage, with its sound removed, to prepare the simulation"],
      ["Anthropic", "May read what the site wrote about the job and frames from its video to draft the job description and prepare the simulation, draft replies, and sort incoming requests, for jobs started and requests sent under the version of this policy effective November 13, 2026, or a later one. For earlier jobs: only drafting the job description from video frames, when the site chose that option. Also drafting and sorting internal work where we configure it"],
      ["DeepSeek", "Drafting and sorting internal work, where we configure it"],
      ["World Labs", "Rebuilding a work area as a 3D scene from site footage, with its sound removed"],
      ["Vast.ai", "Cloud GPU servers that build and check simulations"],
    ],
  },
] as const;

const betaResidencyTransferRows = [
  {
    label: "Where we operate",
    detail:
      "Blueprint's beta serves sites and deployment companies in the United States, and our providers process data mainly in the United States.",
  },
  {
    label: "Outside the United States",
    detail:
      "If you contact us from outside the United States, your information is transferred to and processed in the United States. We work with a site or company outside the United States only under signed transfer terms, such as standard contractual clauses.",
  },
  {
    label: "Provider limits",
    detail:
      "Each provider receives only what it needs for the function listed above, under contract, and may not use it for its own purposes. We do not send site footage to any provider as general training data.",
  },
] as const;

export default function PrivacyPrevious() {
  return <>
    <SEO title="Privacy Policy, previous version | Blueprint" description={`The previous version of how ${COMPANY.legalName} collects, uses and protects information.`} canonical={PREVIOUS_PRIVACY_URL} noIndex />
    <article className="ms-legal ms-container">
      <h1>Privacy Policy</h1>
      <p>Previous version, effective {legalEffectiveDate(PREVIOUS_PRIVACY_VERSION)}</p>
      <PreviousLegalVersionNote document="privacy" />
      <p>
        This policy explains how {COMPANY.legalName} (&ldquo;Blueprint&rdquo;, &ldquo;we&rdquo;), {COMPANY.mailingAddress},
        handles personal information on tryblueprint.io, in the private job links we send and in Blueprint accounts.
        Blueprint is responsible for that information.
      </p>
      {privacyPolicySections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}

      <section>
        <h2>Site footage in detail</h2>
        <LegalRows rows={capturePrivacyAnnex} />
        {rolePrivacyAnnex.map((item) => <div key={item.title}><h3>{item.title}</h3><p>{item.body}</p></div>)}
      </section>

      <section>
        <h2>Cookies and similar technologies</h2>
        <p>
          Essential cookies and browser storage keep you signed in, protect forms from forgery, remember your cookie
          choices and keep an unsent job draft on your device. They are always on, because the website does not work without them.
        </p>
        <p>
          Analytics cookies, from Google Analytics and PostHog, tell us which pages are used so we can improve them.
          Marketing cookies let Google Analytics measure whether our outreach works. Google Analytics, PostHog and
          optional analytics events sent to our own servers stay off until you allow the corresponding category, and
          neither category is pre-selected. We do not record sessions. If your browser sends a Global Privacy Control
          signal, we keep both off unless you turn them on yourself.
        </p>
        <p>
          You can change your choice at any time:{" "}
          <button type="button" className="ms-inline-link" onClick={openCookieSettings}>open cookie settings</button>
          {" "}(also in the footer of every page).
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>
          We share personal information with the providers below, only for the function listed and under contract.
          We also share each job with the robot deployment companies we approve. They receive the site&rsquo;s
          description of the job, its video without its sound, the simulation, what counts as the job done and our first
          look, only to decide whether they can do the job. They are not our providers. A site&rsquo;s name, address and
          contact details go to a company only when the site asks for an introduction to it, and the site then receives
          the company&rsquo;s name and contact details.
          We may also disclose information when the law requires it, to protect people&rsquo;s safety or our rights, or
          as part of a merger or sale of the business, in which case this policy continues to apply to it.
        </p>
        {privacySubprocessorCategories.map((group) => (
          <div key={group.category}>
            <h3>{group.category}</h3>
            <LegalRows rows={group.providers} />
          </div>
        ))}
      </section>

      <section>
        <h2>AI in the Service</h2>
        <p>
          AI providers working for us read frames from a site&rsquo;s video, with what the site wrote about the job, to
          draft the job description. That is OpenAI, or Anthropic for jobs started and requests sent under the version of
          this policy effective November 13, 2026, or a later one, with Google Gemini checking the footage. For an earlier
          job, Anthropic receives frames only if the site chose that option. We also use the providers listed above to
          build simulations and sort incoming requests. Each provider gets only what its step needs and receives footage
          without its sound. No provider may use it for its own purposes, and none receives your footage as training data.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>{jobClosedDefinition}</p>
        <LegalRows rows={betaRetentionSchedule.map((item) => [item.record, `${item.defaultWindow}. ${item.notes}`])} />
      </section>

      <section>
        <h2>Your rights and how to use them</h2>
        <p>
          To delete your account and personal data, open <a href="/settings?privacy=1">account deletion in Settings</a>, where
          you can follow your request. Deletion is not immediate: we first check your jobs or company records, copies our
          providers hold and backups, then confirm what we deleted and anything we must keep. If you have no account or
          cannot sign in, email us.
        </p>
        {privacyRightsRequestSteps.map((step) => <p key={step}>{step}</p>)}
      </section>

      <section>
        <h2>California privacy rights</h2>
        <p>
          This section applies to California residents under the California Consumer Privacy Act, as amended by the
          California Privacy Rights Act.
        </p>
        <LegalRows rows={californiaPrivacyRows} />
      </section>

      <section><h2>Where your information is processed</h2><LegalRows rows={betaResidencyTransferRows.map((item) => [item.label, item.detail])} /></section>

      <section>
        <h2>Security</h2>
        <p>
          We encrypt information in transit and at rest, additionally encrypt contact details in our database, and limit
          access to the people who need it. No system is perfectly secure; if a breach affects your
          information, we will tell you as the law requires.
        </p>
        <p>
          When you submit a job or upload footage on our website, we use Firebase App Check with Google reCAPTCHA
          Enterprise to confirm the request comes from our site rather than an automated script. reCAPTCHA collects
          hardware and software information, such as device and browser data and your IP address, and sends it to Google,
          whose use of it is governed by Google&apos;s Privacy Policy and Terms of Service.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>The Service is for businesses and is not directed to anyone under 18. We do not knowingly collect information from children.</p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>We will post any update here with its effective date, and email account holders before a material change takes effect.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions and requests: <a href={`mailto:${COMPANY.emails.privacy}`}>{COMPANY.emails.privacy}</a>.
          By post: {COMPANY.legalName}, {COMPANY.mailingAddress}.
        </p>
      </section>
    </article>
  </>;
}

function LegalRows({ rows }: { rows: ReadonlyArray<ReadonlyArray<string>> }) {
  return <dl className="ms-legal-rows">{rows.map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl>;
}
