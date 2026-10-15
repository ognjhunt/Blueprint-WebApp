import { SEO } from "@/components/SEO";
import { COMPANY } from "@/data/company";
import { PreviousLegalVersionNote } from "@/components/site/LegalVersionNotes";
import { PREVIOUS_TERMS_URL, PREVIOUS_TERMS_VERSION, legalEffectiveDate } from "@/lib/legalAcceptance";

/**
 * FROZEN: the Terms of Service that stay in force until the reissued Terms
 * (TERMS_VERSION) take effect. This is the text that was live before the
 * 2026-10-15 release, copied verbatim from commit 6e49314 (version
 * 2026-10-14.1). Do not edit the sections: they are the agreement as it
 * stood. Change Terms.tsx instead.
 */
const pilotReplacementPolicy =
  "If the recommended team withdraws or materially changes its confirmed scope before the pilot starts, we recommend a replacement whose evaluation on the same job passed, if one fits. Blueprint charges no fee during the beta, so there is no fee to refund.";

type Section = { title: string; paragraphs?: readonly string[]; items?: readonly string[] };

const previousTermsSections: readonly Section[] = [
  {
    title: "1. The Service",
    paragraphs: [
      "Blueprint helps a site find out whether a robot can do one of its recurring jobs, and recommends one pilot for that job. A site submits a job, films its work area or has Blueprint film it, and reviews a short job brief. We rebuild the work area as a simulated scene, invite robot teams to evaluate the job in that simulation, and recommend one robot team whose evaluation on the job passed. The site can book the recommended pilot in one step. Starting a job authorizes an anonymized opportunity listing for robot teams approved for beta, unless the job was previously marked private.",
      "The Service is in beta and is free during the beta. Features may change, be limited, or be withdrawn, and we may pause or stop an evaluation, for example to protect a site's privacy or the integrity of a result.",
      "An evaluation result is a bounded estimate from a simulated scene. It is not a physical test, a safety assessment, or a guarantee of how a robot will perform at a real site, and a passed evaluation does not certify physical performance or safety. The physical pilot is agreed between the site and the robot team. The robot team or its integrator remains responsible for installation and operation; the site and responsible delivery parties approve the safety plan. Blueprint may record agreed pilot outcomes under the parties' permissions.",
      "Other providers help us run the Service; our Privacy Policy lists them. Their own terms apply to the services they provide.",
    ],
  },
  {
    title: "2. Accounts and API keys",
    items: [
      "Give accurate information and keep it current. You must be at least 18 and able to enter a contract.",
      "Keep your password and API keys secure. You are responsible for activity under your account and keys, including actions an agent takes with a key you issued.",
      "Tell us promptly at " + COMPANY.emails.support + " if you think your account or a key has been misused. You can revoke keys at any time in your account settings.",
    ],
  },
  {
    title: "3. For sites: your authority, your footage and booking",
    items: [
      "When you submit a job description, you confirm that you are authorized to share it on behalf of the site. When you start a capture with footage, you confirm that you are authorized to record the site and to let Blueprint use the recording as these Terms describe.",
      "Task footage may show people, including hands or arms performing the task. You confirm that you have authority to record and submit the footage and have given any required notice and obtained any required permissions from people shown. Blueprint and the providers listed in our Privacy Policy may process the recording and derived frames to draft the job brief, build and operate the scene, and run the evaluation. We remove people from the frames used as input to reconstruction; the original recording may still contain them. Do not submit footage if you cannot authorize those uses.",
      "Avoid recording screens, documents and restricted areas where you can. We may blur or remove those details when practical.",
      "You grant Blueprint a non-exclusive license to use your footage, photos and job details to provide the Service for your job: to review them, build a simulated scene, run the evaluations your listing allows, and show you the results. We never give your recording to a robot team, and we do not license it to anyone for training without your written agreement.",
      "Starting a job authorizes Blueprint to create and publish an anonymized opportunity listing so robot teams approved for beta can discover the job, unless you previously chose private handling for that job. Footage, reconstruction, exact location, contacts and sensitive operating details remain restricted. Requirements not supplied or approved for sharing remain unknown.",
      "Robot teams see only the anonymized job card. You can hide it at any time; hiding it stops new evaluations. Results already produced remain in our records. When Blueprint recommends a pilot, your job page names the recommended robot team: the team agrees to this when it says it wants your pilot. Teams we do not recommend stay anonymous.",
      "During the beta, submitting a job, screening, evaluation, Blueprint's recommendation and booking the recommended pilot cost the site nothing. Blueprint recommends one robot team whose evaluation on your job passed and that wants to run your pilot; you do not have to compare teams. Booking is your one approval: the person booking confirms their authority to do so for the site. There is no Blueprint fee, invoice or payment step.",
      "Blueprint charges no fee for and takes no percentage of any pilot or deployment. After you book, the site and the robot team agree the physical pilot's dates, scope and any price directly, and the robot team or its integrator contracts for the physical work.",
      `${pilotReplacementPolicy} To ask for a replacement, contact ${COMPANY.emails.hello} with your job link.`,
    ],
  },
  {
    title: "4. In-person filming visits",
    items: [
      `Where we offer it (currently the ${COMPANY.visitServiceArea}), a site can ask Blueprint staff to film the job in person instead of filming it themselves. The site arranges access to the areas to be filmed and tells us before the visit about restricted areas, safety rules and required protective equipment.`,
      "Our staff follow the site's safety rules and instructions while on site, may decline or stop filming if conditions are unsafe, and film only the work area and job the site has agreed. The site remains responsible for the safety of its premises and for giving people at the site any notice or obtaining any permission the law or its own policies require before filming.",
      "Footage from a visit is handled exactly like footage the site films itself: the same license, sharing limits, privacy commitments and rights apply.",
      "Blueprint's liability for a visit is limited as described in section 9, except where the law does not allow it to be limited, such as for injury caused by our negligence.",
    ],
  },
  {
    title: "5. For robot teams: free invited evaluations",
    items: [
      "Robot teams join by invitation after we review their application. Invited teams pay nothing to evaluate a job within the invitation's stated scope, which identifies the policy, job and execution limits. Results are shared with the site under your team alias, and a passed evaluation is what makes a team eligible to be recommended.",
      "The beta has no paid private evaluations, balances, top-ups or checkout. Balances bought before the free beta, ledger records and historical results are preserved under their original sharing restrictions.",
      `You can ask for a refund of any unused balance bought before the free beta by writing to ${COMPANY.emails.hello} from your account email. Existing refund and settlement terms continue to apply to those prior purchases.`,
      "You must have the right to submit your policies, endpoints and container images. Sites do not receive your policy or original site recordings.",
    ],
  },
  {
    title: "6. Acceptable use",
    items: [
      "Do not record a site or submit data you are not authorized to share.",
      "Do not break the law, infringe others' rights, or misuse other people's personal information.",
      "Do not attack, probe, overload or reverse engineer the Service, or access it by automated means other than our published API.",
      "Do not present a simulation result as a physical test result or a safety certification.",
    ],
  },
  {
    title: "7. Ownership",
    paragraphs: [
      "You keep ownership of the content you give us. Blueprint owns the Service, our software, and the scenes, simulation assets and reports we create, subject to the rights these Terms give you and to the site's control over its footage. If you send us feedback, we may use it without obligation to you.",
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

export default function TermsPrevious() {
  return <>
    <SEO title="Terms of Service, previous version | Blueprint" description={`The previous version of the terms for using Blueprint, from ${COMPANY.legalName}.`} canonical={PREVIOUS_TERMS_URL} noIndex />
    <article className="ms-legal ms-container">
      <h1>Terms of Service</h1>
      <p>Previous version, effective {legalEffectiveDate(PREVIOUS_TERMS_VERSION)}</p>
      <PreviousLegalVersionNote document="terms" />
      <p>
        These Terms are an agreement between you and {COMPANY.legalName} (&ldquo;Blueprint&rdquo;, &ldquo;we&rdquo;),{" "}
        {COMPANY.mailingAddress}. They apply to tryblueprint.io, the private job links we send, Blueprint accounts
        and our API (the &ldquo;Service&rdquo;). If you use the Service for a company, you accept these Terms on its
        behalf and confirm you are authorized to. If you do not agree, do not use the Service.
      </p>
      {previousTermsSections.map((section) => (
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
