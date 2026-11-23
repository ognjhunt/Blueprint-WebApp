import { SEO } from "@/components/SEO";
import { CurrentLegalVersionNote } from "@/components/site/LegalVersionNotes";
import { COMPANY } from "@/data/company";
import { TERMS_VERSION, legalEffectiveDate } from "@/lib/legalAcceptance";

type Section = { title: string; paragraphs?: readonly string[]; items?: readonly string[] };

/** Sharing is the service (owner, 2026-11-12): the sentences every page and email say the same way. */
export const SHARING_SENTENCE = "Starting a job means that, once it has its video, we share it with robot deployment companies we've approved, so they can decide without a visit whether they can do it. We share your description of the job, your video without its sound, the simulation we build from it, what counts as the job done, and our first look at which robots fit.";
export const CONTACT_DETAILS_SENTENCE = "We do not share your name, your street address or your contact details with a deployment company unless you ask for an introduction to it.";
export const COMPANY_USE_SENTENCE = "A deployment company may use your job only to decide whether it can do it. It may not pass it on, use it to train software, or keep it after we ask it to delete it.";
export const WITHDRAWAL_SENTENCE = "You can withdraw your job at any time from its page. It then leaves every company's view at once, and we ask any company that saved a copy to delete it. We cannot take back a copy a company has already saved.";
export const OLDER_JOB_SENTENCE = "A job started before November 12, 2026 is shared with companies only after you agree to share it on the job's page.";
/**
 * What a site can do when a company it was introduced to drops out (owner, 2026-11-21). Written out here, not imported,
 * so this page's digest covers it; `pilotReplacementPolicy` in `client/src/lib/evaluationPricing.ts` says the same.
 */
export const REPLACEMENT_SENTENCE = "If a company you were introduced to drops out, you can accept another company that applied or answered Tested it: can do.";
export const COMPANY_APPLICATION_SENTENCE = "A site sees your company's name and website with each answer you give and the reason you give, with your contact details taken out. It gets your contact details only when it accepts your application, after you applied or answered Tested it: can do. Answers you gave before November 23, 2026 stay under an alias.";

export const termsSections: readonly Section[] = [
  {
    title: "1. The Service",
    paragraphs: [
      "Blueprint helps a site find a deployment company for one of its recurring jobs. A site gives an email and a video of the job, and can correct the job description we draft from the video. From the video we make a job packet: the site's description of the job, the video without its sound, our first look at which kinds of robot most likely fit, a simulation of the site with the job's object in it, and what counts as the job done. Blueprint does not test any robot in the simulation. Once the simulation can be downloaded, a deployment company may test its own robot in it, using its own tools.",
      `${SHARING_SENTENCE} An approved deployment company can answer Apply, Not a fit or Need more details. Once the simulation can be downloaded, it can also answer Tested it: can do or Tested it: cannot yet. The site sees each answer.`,
      "The Service is in beta. Features may change, be limited, or be withdrawn, and we may pause or stop work on a job, for example to protect a site's privacy or the integrity of a result.",
      "A simulation is a bounded estimate. It is not a physical test, a safety assessment, or a guarantee of how a robot will perform at a real site, and it does not certify physical performance or safety. Any physical pilot is agreed directly between the site and the deployment company. The deployment company is responsible for installation and operation, and the site and the others responsible for the work approve the safety plan. After an introduction, we ask both sides what happened, up to three times (14, 45 and 90 days later), and record their answers on the job.",
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
      "When you submit a job description, you confirm that you are authorized to share it on behalf of the site. When you send a video, you confirm that you are authorized to record the site and to let Blueprint use the recording as these Terms describe.",
      "Job footage may show people, including hands or arms doing the job, and a phone video can also record what people nearby say. Share only footage you are authorized to share. Before recording, tell the people in the work area that you are recording and that the video will be shared with Blueprint and with the robot deployment companies we approve. Get any permission the law or your own policies require from people who can be seen or heard. Some laws require everyone's consent before a conversation is recorded, so avoid recording conversations and turn sound off where your camera allows. Do not submit footage if you cannot meet these conditions.",
      "Blueprint keeps your original upload as received for the uses and retention periods in our Privacy Policy. We remove its sound before any automated review, before sending footage to an AI or 3D-processing provider, and before a deployment company sees it, and we do not analyze speech. Blueprint and the providers listed in our Privacy Policy may process the recording and derived frames to draft the job description and build the simulation. We do not remove people from the footage or from frames taken from it, and we do not blur them. For a job started under a version of our Privacy Policy published before November 17, 2026, we still blur faces in the frames we send to World Labs to rebuild the work area. Companies see your video as you filmed it, without its sound.",
      "Avoid recording screens, documents and restricted areas where you can.",
      "You grant Blueprint a non-exclusive license to use your footage, photos and job details to provide the Service for your job: to make the job packet and the simulation, show you companies' responses, and share your job with the deployment companies we approve as this section describes. We do not license your recording to anyone for training without your written agreement.",
      SHARING_SENTENCE,
      `${CONTACT_DETAILS_SENTENCE} A deployment company's answer reaches you with its name and website, with its contact details taken out. An answer given before November 23, 2026 reaches you under an alias. An estimate a deployment company gives with its answer is its own, given before a site visit. It is not a quote, and Blueprint does not check or guarantee it. When you accept a company that applied or answered Tested it: can do, we give it your name, your address and your contact details, and give you its name and contact details.`,
      COMPANY_USE_SENTENCE,
      WITHDRAWAL_SENTENCE,
      OLDER_JOB_SENTENCE,
      "Free for sites.",
      "Blueprint charges no fee for and takes no percentage of any pilot or deployment. If the site goes ahead, the site and the deployment company agree the physical pilot's dates, scope and any price directly, and the deployment company or its integrator contracts for the physical work.",
      REPLACEMENT_SENTENCE,
    ],
  },
  {
    title: "4. For deployment companies",
    items: [
      "A deployment company applies for an account, and Blueprint approves each company. An approved company signs in, sees the jobs sites have shared, and can answer each one: Apply, Not a fit or Need more details. Once a job's simulation can be downloaded, it can also answer Tested it: can do or Tested it: cannot yet.",
      `${COMPANY_APPLICATION_SENTENCE} If you give an estimate with your answer, the site sees it as an estimate before a site visit, not a quote.`,
      "You may use a job only to decide whether you can do it. You may not pass it on, use it to train software, or keep it after we ask you to delete it.",
      "Nothing is charged today.",
    ],
  },
  {
    title: "5. Acceptable use",
    items: [
      "Do not record a site or submit data you are not authorized to share.",
      "Do not break the law, infringe others' rights, or misuse other people's personal information.",
      "Do not attack, probe, overload or reverse engineer the Service, or access it by automated means.",
      "Do not present a simulation result as a physical test result or a safety certification.",
    ],
  },
  {
    title: "6. Ownership",
    paragraphs: [
      "You keep ownership of the content you give us. Blueprint owns the Service, our software, and the simulations, their files and the reports we create, subject to the rights these Terms give you, including a site's right to withdraw its job. If you send us feedback, we may use it without obligation to you.",
    ],
  },
  {
    title: "7. Disclaimers",
    paragraphs: [
      "The Service is provided “as is” and “as available”, as a beta. To the fullest extent the law allows, Blueprint disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, accuracy and non-infringement. We do not warrant that the Service will be uninterrupted or error-free, or that a result will predict how a robot performs at a real site.",
    ],
  },
  {
    title: "8. Limitation of liability",
    paragraphs: [
      "To the fullest extent the law allows, Blueprint is not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, data or goodwill, arising from or related to the Service. Blueprint's total liability for all claims related to the Service is limited to the greater of the amounts you paid Blueprint in the 12 months before the claim arose and $100.",
      "Some places do not allow these limits, so they may not all apply to you.",
    ],
  },
  {
    title: "9. Indemnity",
    paragraphs: [
      "You will defend and indemnify Blueprint against third-party claims arising from content you submit, including recordings you were not authorized to make, or from your breach of these Terms or of the law.",
    ],
  },
  {
    title: "10. Suspension and termination",
    paragraphs: [
      "You can stop using the Service and close your account at any time. We may suspend or end your access if you breach these Terms, if your use creates a security or legal risk, or if we stop offering the Service. The license in section 3 for jobs you already sent, and sections 6, 7, 8, 9 and 12, survive termination.",
    ],
  },
  {
    title: "11. Changes to these Terms",
    paragraphs: [
      "We may update these Terms. We post each new version here with its effective date, and email account holders before a material change takes effect. A change that asks something new of you applies to you only once you agree to it.",
    ],
  },
  {
    title: "12. Governing law and general terms",
    paragraphs: [
      "These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-law rules, and disputes will be heard in the state or federal courts located in Delaware. These Terms, together with any written agreement you sign with us, are the entire agreement about the Service; a signed agreement controls where it differs. If a provision is unenforceable, the rest remains in effect. You may not assign these Terms without our consent. We may send notices to your account email.",
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
