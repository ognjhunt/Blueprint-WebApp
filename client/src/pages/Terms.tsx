import { SEO } from "@/components/SEO";
import { CurrentLegalVersionNote } from "@/components/site/LegalVersionNotes";
import { COMPANY } from "@/data/company";
import { pilotReplacementPolicy } from "@/lib/evaluationPricing";
import { TERMS_VERSION, legalEffectiveDate } from "@/lib/legalAcceptance";

type Section = { title: string; paragraphs?: readonly string[]; items?: readonly string[] };

/** Sharing is the service (owner, 2026-11-12): the sentences every page and email say the same way. */
export const SHARING_SENTENCE = "Starting a job means we share it with robot deployment companies we've approved, so they can judge it without a visit. We share your description of the job, your video without its sound, the simulation we build from it, what counts as the job done, our first look at which robots fit, and the result of any early trial we run.";
export const CONTACT_DETAILS_SENTENCE = "We do not share your name, your street address or your contact details with a deployment company unless you ask for an introduction to it.";
export const COMPANY_USE_SENTENCE = "A deployment company may use your job only to decide whether it can do it. It may not pass it on, use it to train software, or keep it after we ask it to delete it.";
export const WITHDRAWAL_SENTENCE = "You can withdraw your job at any time. It then leaves every company's view at once, and we ask any company that saved a copy to delete it. We cannot take back a copy a company has already saved.";
export const OLDER_JOB_SENTENCE = "A job started before 12 November 2026 is not shown to companies unless you accept the current statement on its page.";
export const COMPANY_ALIAS_SENTENCE = "A site sees your answer under an alias. It sees your company's name and your contact details only when it asks for an introduction after you answered Interested or Tested it: can do.";

export const termsSections: readonly Section[] = [
  {
    title: "1. The Service",
    paragraphs: [
      "Blueprint helps a site find a deployment company for one of its recurring jobs. A site gives an email and a video of the job, and can correct the short job brief we draft from the video. From the video we make a job packet: the site's description of the job, the video without its sound, our first look at which kinds of robot most likely fit, a simulation of the site with the job's object in it, and what counts as the job done. We rebuild the work area as a simulated scene and, where we can, run openly available robot software in that simulation ourselves as an early trial. Deployment companies do not run their own software on a site's job in our simulation.",
      `${SHARING_SENTENCE} A deployment company we approved can answer: interested, not a fit, or would need something. The site sees each answer.`,
      "The Service is in beta. Features may change, be limited, or be withdrawn, and we may pause or stop work on a job, for example to protect a site's privacy or the integrity of a result.",
      "A simulation or early trial result is a bounded estimate from a simulated scene. It is not a physical test, a safety assessment, or a guarantee of how a robot will perform at a real site, and it does not certify physical performance or safety. Any physical pilot is agreed directly between the site and the deployment company. The deployment company remains responsible for installation and operation; the site and responsible delivery parties approve the safety plan. Blueprint may record agreed pilot outcomes under the parties' permissions.",
      "Other providers help us run the Service; our Privacy Policy lists them. Their own terms apply to the services they provide.",
    ],
  },
  {
    title: "2. Accounts",
    items: [
      "Give accurate information and keep it current. You must be at least 18 and able to enter a contract.",
      "Keep your password secure. You are responsible for activity under your account.",
      "Tell us promptly at " + COMPANY.emails.support + " if you think your account has been misused.",
    ],
  },
  {
    title: "3. For sites: your authority, your footage and who sees your job",
    items: [
      "When you submit a job description, you confirm that you are authorized to share it on behalf of the site. When you start a capture with footage, you confirm that you are authorized to record the site and to let Blueprint use the recording as these Terms describe.",
      "Task footage may show people, including hands or arms performing the task, and a phone video can also record what people nearby say. Share only footage you are authorized to share. Before recording, tell the people in the work area that you are recording and that the video will be shared with Blueprint and with the robot deployment companies we approve, and obtain any permission the law or your own policies require from people who can be seen or heard. Some laws require everyone's consent before a conversation is recorded, so avoid recording conversations and turn sound off where your camera allows. Do not submit footage if you cannot meet these conditions.",
      "Blueprint keeps your original upload as received for the uses and retention periods in our Privacy Policy. We remove its sound before any automated review, before sending footage to an AI or 3D-processing provider, and before a deployment company sees it, and we do not analyze speech. Blueprint and the providers listed in our Privacy Policy may process the recording and derived frames to draft the job brief, build the simulation and run our early trial. We do not remove people from the footage or from frames taken from it; we blur faces only in the frames we send to World Labs to rebuild the work area. Companies see your video as you filmed it, without its sound.",
      "Avoid recording screens, documents and restricted areas where you can.",
      "You grant Blueprint a non-exclusive license to use your footage, photos and job details to provide the Service for your job: to review them, build the simulation, run our early trial, show you the results, and share your job with the deployment companies we approve as this section describes. We do not license your recording to anyone for training without your written agreement.",
      SHARING_SENTENCE,
      `${CONTACT_DETAILS_SENTENCE} A deployment company's answer reaches you under an alias. When you ask for an introduction to a company that answered Interested, we give it your name and contact details and give you its name and contact details. You can ask for up to three introductions for each job.`,
      COMPANY_USE_SENTENCE,
      WITHDRAWAL_SENTENCE,
      OLDER_JOB_SENTENCE,
      "Submitting a job, building the simulation, our early trial and sharing your job with deployment companies cost the site nothing. There is no Blueprint fee, invoice or payment step for the site.",
      "Blueprint charges no fee for and takes no percentage of any pilot or deployment. If the site goes ahead, the site and the deployment company agree the physical pilot's dates, scope and any price directly, and the deployment company or its integrator contracts for the physical work.",
      `${pilotReplacementPolicy} To ask for a replacement, contact ${COMPANY.emails.hello} with your job link.`,
    ],
  },
  {
    title: "4. Earlier filming visits",
    paragraphs: [
      "Blueprint no longer films jobs in person. Video from an earlier Blueprint filming visit is handled exactly like video a site uploads itself: the same license, privacy commitments and rights apply, and the job is shared only as section 3 describes.",
    ],
  },
  {
    title: "5. For deployment companies",
    items: [
      "A deployment company applies for an account, and Blueprint approves each company. An approved company signs in, sees the jobs sites have shared, and can answer each one: interested, not a fit, or would need something.",
      COMPANY_ALIAS_SENTENCE,
      "You may use a job only to decide whether you can do it. You may not pass it on, use it to train software, or keep it after we ask you to delete it.",
      "Blueprint does not charge deployment companies today.",
      "The beta has no paid private evaluations, balances, top-ups or checkout. Balances bought before the free beta, ledger records and historical results are preserved under their original sharing restrictions.",
      `You can ask for a refund of any unused balance bought before the free beta by writing to ${COMPANY.emails.hello} from your account email. Existing refund and settlement terms continue to apply to those prior purchases.`,
    ],
  },
  {
    title: "6. Acceptable use",
    items: [
      "Do not record a site or submit data you are not authorized to share.",
      "Do not break the law, infringe others' rights, or misuse other people's personal information.",
      "Do not attack, probe, overload or reverse engineer the Service, or access it by automated means.",
      "Do not present a simulation result as a physical test result or a safety certification.",
    ],
  },
  {
    title: "7. Ownership",
    paragraphs: [
      "You keep ownership of the content you give us. Blueprint owns the Service, our software, and the scenes, simulation assets and reports we create, subject to the rights these Terms give you, including a site's right to withdraw its job. If you send us feedback, we may use it without obligation to you.",
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
      "You will defend and indemnify Blueprint against third-party claims arising from content you submit, including recordings you were not authorized to make, or from your breach of these Terms or of the law.",
    ],
  },
  {
    title: "11. Suspension and termination",
    paragraphs: [
      "You can stop using the Service and close your account at any time. We may suspend or end your access if you breach these Terms, if your use creates a security or legal risk, or if we stop offering the Service. If we end the Service for a reason other than your breach, we refund any unused balance bought before the free beta. Sections 3 (license for completed work), 7, 8, 9, 10 and 13 survive termination.",
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
      "These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-law rules, and disputes will be heard in the state or federal courts located in Delaware. These Terms, together with any order form or written agreement you sign with us, are the entire agreement about the Service; a signed agreement controls where it differs. If a provision is unenforceable, the rest remains in effect. You may not assign these Terms without our consent. We may send notices to your account email.",
    ],
  },
];

export default function Terms() {
  return <>
    <SEO title="Terms of Service | Blueprint" description={`The terms for using Blueprint, from ${COMPANY.legalName}.`} canonical="/terms" />
    <article className="ms-legal ms-container">
      <h1>Terms of Service</h1>
      <p>Effective {legalEffectiveDate(TERMS_VERSION)}</p>
      <CurrentLegalVersionNote document="terms" />
      <p>
        These Terms are an agreement between you and {COMPANY.legalName} (&ldquo;Blueprint&rdquo;, &ldquo;we&rdquo;),{" "}
        {COMPANY.mailingAddress}. They apply to tryblueprint.io, the private job links we send and Blueprint
        accounts (the &ldquo;Service&rdquo;). If you use the Service for a company, you accept these Terms on its
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
