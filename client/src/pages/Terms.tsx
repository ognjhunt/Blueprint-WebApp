import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { entryPrice, minTopupUsd } from "@/lib/evaluationPricing";
import { TERMS_VERSION, legalEffectiveDate } from "@/lib/legalAcceptance";

type Section = { title: string; paragraphs?: readonly string[]; items?: readonly string[] };

export const termsSections: readonly Section[] = [
  {
    title: "1. The Service",
    paragraphs: [
      "Blueprint helps sites and robot teams assess whether a robot fits a real task and prepare a provider-backed pilot offer. A site can submit a task, film its work area, review a short task brief, and choose whether robot teams can see a card for the task. We may rebuild the work area as a simulated scene and run robot teams' policies against it where useful. Robot teams invited to evaluate a qualified site task pay no evaluation entry fee within the invitation's stated scope, whether or not the site later buys a pilot. Separately, robot teams can buy self-directed evaluation runs against listed tasks on the website or through our API.",
      "The Service is in beta. Features may change, be limited, or be withdrawn, and we may pause or stop an evaluation, for example to protect a site's privacy or the integrity of a result.",
      "An evaluation result is a measurement in a simulated scene. It is not a physical test, a safety assessment, or a guarantee of how a robot will perform at a real site. Any pilot or deployment requires a provider-backed offer, separate agreement, and site approval. The provider or integrator remains responsible for installation and operation; the site and responsible delivery parties approve the safety plan. Blueprint may record agreed pilot outcomes under the parties' permissions.",
    ],
  },
  {
    title: "2. Accounts and API keys",
    items: [
      "Give accurate information and keep it current. You must be at least 18 and able to enter a contract.",
      "Keep your password and API keys secure. You are responsible for activity under your account and keys, including runs an agent buys within the spending limits you set.",
      "Tell us promptly at " + COMPANY.emails.support + " if you think your account or a key has been misused. You can revoke keys at any time in your account settings.",
    ],
  },
  {
    title: "3. For sites: your authority and your footage",
    items: [
      "When you submit a task you confirm that you are authorized to record the site and to let Blueprint use the recording as these Terms describe.",
      "Task footage may show people, including hands or arms performing the task. You confirm that you have authority to record and submit the footage and have given any required notice and obtained any required permissions from people shown. Blueprint and the providers listed in our Privacy Policy may process the recording and derived frames to build and operate the scene and evaluation. People are not automatically removed from footage or derived scenes. Do not submit footage if you cannot authorize those uses.",
      "Avoid recording screens, documents and restricted areas where you can. We may blur or remove those details when practical.",
      "You grant Blueprint a non-exclusive license to use your footage, photos and task details to provide the Service for your task: to review them, build a simulated scene, run the evaluations your listing allows, and show you the results. We never give your recording to a robot team, and we do not license it to anyone for training without your written agreement.",
      "Robot teams see only the task card you approve. You can hide it at any time; hiding it stops new runs. Results already produced remain in our records. Any introduction that reveals a site or team identity for a provider-specific proposal requires both parties' approval.",
      "Submitting a task and receiving initial fit screening cost the site nothing. The task submitter's capture consent and answers about budget or pilot interest do not agree to a Blueprint fee. Before Blueprint invites robot teams to evaluate a site task for free, an authorized buyer for the site must separately agree in writing to the fee for that task. Without that agreement, Blueprint may stop after initial screening. Evaluation results are not withheld for payment.",
      "Under that task-specific agreement, if the site purchases a physical pilot from a provider Blueprint introduces for the agreed task, the site pays Blueprint 5% of the provider's approved physical-pilot charges, capped at $5,000. The fee applies even if the site and provider contract or communicate directly. No pilot purchase means no Blueprint fee. It does not apply to unrelated tasks, previously identified provider relationships excluded in the task agreement, or later deployments unless separately agreed. The agreement states its time limit and how cancellations, refunds, and taxes affect the fee. A site may post a proposed pilot price and conditions or a target budget; neither binds a provider or authorizes a purchase. The site and provider agree on final terms. The provider contracts for physical work and handles installation and operation. Blueprint's fee is shown separately before a pilot purchase.",
    ],
  },
  {
    title: "4. Optional self-directed runs: prices, balance and refunds",
    items: [
      `The prices in this section apply only to self-directed evaluation runs outside a free, bounded invitation to a qualified site task. Invited teams pay no evaluation entry fee or supplier commission for work within the invitation's stated scope. Each optional self-directed entry has a flat quoted price, shown before you buy (currently $${entryPrice}). One entry is one policy, running on one embodiment, against one task at one site. A paid entry retains its no-later-supplier-commission promise. Blueprint sets the length of every run, so every entry on a task is measured the same way.`,
      `You pay from a prepaid balance. Top-ups are charged by Stripe at face value; the smallest is $${minTopupUsd}. Your balance does not expire while your account is open.`,
      "Confirming a run places a hold for its quoted price. You are charged only for the episodes that actually run, pro-rated against the quote; anything that does not run returns to your balance. A robot failing the task is a result and is charged. A failure on our side, such as a scene that will not launch, is not.",
      `You can ask for a refund of unused balance at any time by writing to ${COMPANY.emails.hello} from your account email. We refund it to the original payment method, less amounts held for runs in progress.`,
      "Prices do not include taxes unless we say so. You are responsible for taxes that apply to your purchases, other than taxes on our income.",
      "You are responsible for the policies, endpoints and container images you submit: you must have the right to submit them, and they must not contain malware or other people's confidential data. We run them only to perform the evaluations you buy. Sites see an alias for your team and your results, not your identity or your policy.",
    ],
  },
  {
    title: "5. Acceptable use",
    items: [
      "Do not record a site or submit data you are not authorized to share.",
      "Do not break the law, infringe others' rights, or misuse other people's personal information.",
      "Do not attack, probe, overload or reverse engineer the Service, or access it by automated means other than our published API.",
      "Do not present a simulation result as a physical test result or a safety certification.",
    ],
  },
  {
    title: "6. Ownership",
    paragraphs: [
      "You keep ownership of the content you give us. Blueprint owns the Service, our software, and the scenes, simulation assets and reports we create, subject to the rights these Terms give you and to the site's control over its footage. If you send us feedback, we may use it without obligation to you.",
    ],
  },
  {
    title: "7. Third-party services",
    paragraphs: [
      "Payments are processed by Stripe, and other providers help us run the Service; our Privacy Policy lists them. Their own terms apply to the services they provide.",
    ],
  },
  {
    title: "8. Disclaimers",
    paragraphs: [
      "The Service is provided “as is” and “as available”, as a beta. To the fullest extent the law allows, Blueprint disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, accuracy and non-infringement. We do not warrant that the Service will be uninterrupted or error-free, or that a result will predict how a robot performs at a real site.",
    ],
  },
  {
    title: "9. Limitation of liability",
    paragraphs: [
      "To the fullest extent the law allows, Blueprint is not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, data or goodwill, arising from or related to the Service. Blueprint's total liability for all claims related to the Service is limited to the greater of the amounts you paid Blueprint in the 12 months before the claim arose and $100.",
      "Some places do not allow these limits, so they may not all apply to you.",
    ],
  },
  {
    title: "10. Indemnity",
    paragraphs: [
      "You will defend and indemnify Blueprint against third-party claims arising from content you submit, including recordings you were not authorized to make and policies you were not entitled to submit, or from your breach of these Terms or of the law.",
    ],
  },
  {
    title: "11. Suspension and termination",
    paragraphs: [
      "You can stop using the Service and close your account at any time. We may suspend or end your access if you breach these Terms, if your use creates a security or legal risk, or if we stop offering the Service. If we end the Service for a reason other than your breach, we refund your unused balance. Sections 3 (license for completed work), 6, 8, 9, 10 and 13 survive termination.",
    ],
  },
  {
    title: "12. Changes to these Terms",
    paragraphs: [
      "We may update these Terms. We will post the new version here with its effective date, and tell account holders about material changes by email before they take effect. Continuing to use the Service after that means you accept the updated Terms.",
    ],
  },
  {
    title: "13. Governing law and general terms",
    paragraphs: [
      "These Terms are governed by the laws of the State of North Carolina, without regard to conflict-of-law rules, and disputes will be heard in the state or federal courts located in North Carolina. These Terms, together with any order form or written agreement you sign with us, are the entire agreement about the Service; a signed agreement controls where it differs. If a provision is unenforceable, the rest remains in effect. You may not assign these Terms without our consent. We may send notices to your account email.",
    ],
  },
];

export default function Terms() {
  return <>
    <SEO title="Terms of Service | Blueprint" description={`The terms for using Blueprint, from ${COMPANY.legalName}.`} canonical="/terms" />
    <article className="ms-legal ms-container">
      <h1>Terms of Service</h1>
      <p>Effective {legalEffectiveDate(TERMS_VERSION)}</p>
      <p>
        These Terms are an agreement between you and {COMPANY.legalName} (&ldquo;Blueprint&rdquo;, &ldquo;we&rdquo;),{" "}
        {COMPANY.mailingAddress}. They apply to tryblueprint.io, the private task links we send, Blueprint accounts
        and our API (the &ldquo;Service&rdquo;). If you use the Service for a company, you accept these Terms on its
        behalf and confirm you are authorized to. If you do not agree, do not use the Service.
      </p>
      {termsSections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>
      ))}
      <section>
        <h2>Contact</h2>
        <p>
          Questions about these Terms: <a href={`mailto:${COMPANY.emails.legal}`}>{COMPANY.emails.legal}</a>.
          By post: {COMPANY.legalName}, {COMPANY.mailingAddress}.
        </p>
      </section>
    </article>
  </>;
}
