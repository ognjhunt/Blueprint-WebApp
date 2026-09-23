import { Shield, SlidersHorizontal, SquareStack, Waypoints } from "lucide-react";
import { SEO } from "@/components/SEO";
import { openCookieSettings } from "@/components/CookieConsent";
import { COMPANY } from "@/data/company";
import { PRIVACY_VERSION, legalEffectiveDate } from "@/lib/legalAcceptance";

export const privacyPolicySections = [
  {
    title: "What we collect",
    body:
      "What you give us: your name, work email, company, role and phone number; the site and task you describe; your answers to the task brief; account details; and messages you send us. Robot teams also give us details of their robots and policies, and the endpoints or container images we run. Payment card details go straight to Stripe; we receive only a record of the payment. What we collect automatically: your IP address, browser and device type, pages you visit, and errors the site runs into.",
    icon: SquareStack,
  },
  {
    title: "Site footage",
    body:
      "When a site films its task, we receive the video and photos, when and where they were taken, and the phone's motion and depth data where available. We use them to review the task, rebuild the work area as a simulated scene, and run the evaluations the site allows. Footage can show people, screens or paperwork, so we ask sites to avoid them and we blur or remove what we find.",
    icon: Waypoints,
  },
  {
    title: "How we use it",
    body:
      "To run the Service: to reply to you, set up your task or account, rebuild scenes and run evaluations, take payments, send the emails you need (such as a task update or a run result), keep the Service secure and prevent fraud, understand how the site is used so we can improve it, and meet our legal obligations. We do not sell personal information or share it for cross-context behavioral advertising, and we do not use your footage to train AI models without your written agreement.",
    icon: Shield,
  },
  {
    title: "Your choices",
    body:
      "Depending on where you live, you can ask to access, correct, delete or get a copy of your personal information, object to or restrict how we use it, and withdraw consent you gave, including consent to use your footage. You can also change your cookie choices at any time.",
    icon: SlidersHorizontal,
  },
] as const;

export const capturePrivacyAnnex = [
  // The pricing page states this as an absolute: "They never receive your
  // recording." This row used to make it conditional ("buyer visibility
  // depends on listing rights and privacy state"), which meant the document a
  // site reads before consenting disagreed with the document it reads before
  // buying. The absolute is the true one, so the conditional goes.
  ["Raw walkthrough media", "Your recording is used inside Blueprint to review the task and rebuild the work area. It is never delivered to a robot team or anyone else who pays us. No listing right, order form or other agreement gives access to the recording itself."],
  // Stated because "they never get the recording" is necessary and not
  // sufficient: a policy served through an endpoint has to be sent something to
  // look at, and what it is sent is derived from the site.
  ["What a robot team's policy is sent", "Images rendered from the reconstructed scene, never the walkthrough. Those images can still show layout, equipment and stock, so they are kept and shared on the same terms as the scene, and they are not licensed for training unless a written agreement says so."],
  ["Faces, screens and paperwork", "Avoided when filming where practical, and blurred or removed where we find them before anything is shown outside Blueprint."],
  ["Location", "Used to tie a result to the right site, and to keep restricted areas you mark out of the scene."],
  ["Buyer sharing", "Robot teams see the task card you approve and their own results. The scene, what their policy is sent and the results are shared only as your listing or a written agreement allows. The raw walkthrough is outside the scope of all of them."],
];

export const rolePrivacyAnnex = [
  {
    title: "Robot teams",
    body: "Your account holds your team's details, the robots and policies you register, the runs you buy, their results, your balance and your API keys. Sites see an alias for your team and its results, not your name or your policy.",
  },
  {
    title: "Sites",
    body: "Your task holds your contact details, the site's address, the task brief, your footage, the areas you mark as restricted, and whether robot teams can see a card for the task.",
  },
];

/**
 * The one retention schedule. It replaced a second, vaguer list that sat above
 * it and disagreed with it.
 */
export const betaRetentionSchedule = [
  {
    record: "Site footage and capture data",
    defaultWindow: "180 days after the task closes",
    notes: "The video, photos, timestamps, motion and depth data, and the record of the site's authority and privacy review.",
  },
  {
    record: "Temporary processing files",
    defaultWindow: "14 days after processing succeeds",
    notes: "Intermediate files from rebuilding a scene or blurring footage, unless we need one to investigate a failure or an incident.",
  },
  {
    record: "Scenes, evaluation results and reports",
    defaultWindow: "365 days after the task closes or the contract ends",
    notes: "The rebuilt scene, the images robot policies were sent, run results, reports, and the record of what each party was allowed to use.",
  },
  {
    record: "Account and contact details",
    defaultWindow: "While your account or task is open",
    notes: "Deleted or anonymized after you close your account, your task closes, or we complete a verified deletion request, unless a record below still needs them.",
  },
  {
    record: "Support and privacy requests",
    defaultWindow: "90 days after the request is closed",
    notes: "The messages and the record of what we did.",
  },
  {
    record: "Payment, tax, security and legal records",
    defaultWindow: "As long as the law requires",
    notes: "US tax records are typically kept for up to 7 years. Records under a legal hold, or needed to investigate fraud or a security incident, are kept until the matter is resolved.",
  },
] as const;

export const privacyRightsRequestSteps = [
  `Email ${COMPANY.emails.privacy} from the address on your account, or include enough detail for us to find your records and confirm they are yours. Tell us what you would like us to do.`,
  "We acknowledge your request within 10 business days and complete it within 30 calendar days of confirming your identity. If we need longer, we tell you why.",
  "We may keep some information when the law requires it, or when it is needed for a payment record, a legal claim, fraud prevention or security. If so, we tell you what we kept and why.",
  "We do not charge for a request, and we do not treat you differently for making one. An authorized agent can make a request for you with your written permission.",
] as const;

/** Every provider that can receive personal information, by what it does. */
export const privacySubprocessorCategories = [
  {
    category: "Hosting and storage",
    providers: [
      ["Google Cloud and Firebase", "Accounts and sign-in, database, file storage, hosting"],
      ["Render", "Application and API hosting, including managed Redis for caching and background jobs"],
      ["Backblaze B2", "Storage for uploaded footage"],
    ],
  },
  {
    category: "Payments",
    providers: [["Stripe", "Card payments, top-ups, receipts and refunds"]],
  },
  {
    category: "Email and communication",
    providers: [
      ["Resend", "Sending the emails the Service sends you"],
      ["Google Workspace", "Our email and documents"],
      ["Slack", "Internal alerts to our team, which can include your name, email and task"],
      ["Notion", "Internal operations and support records"],
    ],
  },
  {
    category: "Analytics and error monitoring",
    providers: [
      ["Google Analytics", "Website analytics, with cookies only if you allow analytics"],
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
    category: "AI and 3D processing",
    providers: [
      ["OpenAI", "Reading a task description to draft the task brief, drafting replies, and sorting incoming requests"],
      ["Google Gemini", "Watching site footage to check what it shows against the task brief"],
      ["World Labs", "Rebuilding a work area as a 3D scene from site footage"],
      ["DeepSeek and Anthropic", "Drafting and sorting internal work, where we configure them"],
    ],
  },
] as const;

export const betaResidencyTransferRows = [
  {
    label: "Where we operate",
    detail:
      "Blueprint's beta serves sites and robot teams in the United States, and our providers process data mainly in the United States.",
  },
  {
    label: "Outside the United States",
    detail:
      "If you contact us from outside the United States, your information is transferred to and processed in the United States. We work with a site or team outside the United States only under signed transfer terms, such as standard contractual clauses.",
  },
  {
    label: "Provider limits",
    detail:
      "Each provider receives only what it needs for the function listed above, under contract, and may not use it for its own purposes. We do not send site footage to any provider as general training data.",
  },
] as const;

export default function Privacy() {
  return <>
    <SEO title="Privacy Policy | Blueprint" description={`How ${COMPANY.legalName} collects, uses and protects information on tryblueprint.io and in the Blueprint service.`} canonical="/privacy" />
    <article className="ms-legal ms-container">
      <h1>Privacy Policy</h1>
      <p>Effective {legalEffectiveDate(PRIVACY_VERSION)}</p>
      <p>
        This policy explains how {COMPANY.legalName} (&ldquo;Blueprint&rdquo;, &ldquo;we&rdquo;), {COMPANY.mailingAddress},
        handles personal information on tryblueprint.io, in the private task links we send, in Blueprint accounts
        and through our API. Blueprint is responsible for that information.
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
          choices and keep a checkout in progress. They are always on, because the site does not work without them.
        </p>
        <p>
          Analytics cookies, from Google Analytics and PostHog, tell us which pages are used so we can improve them.
          Marketing cookies let Google Analytics measure whether our outreach works. Both are off until you allow them.
          Until you do, Google Analytics runs without cookies, and we count page views on our own servers without cookies.
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
          We share personal information with the providers below, only for the function listed and under contract. A
          site sees an alias for each robot team and its results; a robot team sees the task card a site approves.
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
          We use AI models from the providers listed above to draft task briefs, read site footage, rebuild scenes and
          sort incoming requests. We send each provider only what the step needs, and we do not give any of them your
          footage as training data.
        </p>
      </section>

      <section><h2>How long we keep it</h2><LegalRows rows={betaRetentionSchedule.map((item) => [item.record, `${item.defaultWindow}. ${item.notes}`])} /></section>

      <section><h2>Your rights and how to use them</h2>{privacyRightsRequestSteps.map((step) => <p key={step}>{step}</p>)}</section>

      <section><h2>Where your information is processed</h2><LegalRows rows={betaResidencyTransferRows.map((item) => [item.label, item.detail])} /></section>

      <section>
        <h2>Security</h2>
        <p>
          We encrypt information in transit and at rest, additionally encrypt contact details in our database, and limit
          access to the people who need it. No system is perfectly secure; if a breach affects your
          information, we will tell you as the law requires.
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
