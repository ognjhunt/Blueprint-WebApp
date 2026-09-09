import { BadgeDollarSign, Briefcase, Gavel, ShieldCheck } from "lucide-react";
import { SEO } from "@/components/SEO";
const sections = [
  {
    title: "Services",
    body:
      "Blueprint provides software and related services for capture intake, maintained Site-Task Testbeds, Task Evaluation Runs, hosted evidence review, and supporting buyer or operator workflows. Post-training is only a permitted use of qualifying run evidence, not a separate service promise. Specific deliverables, usage rights, and commercial terms may also be set in an order form, statement of work, listing-specific terms, or other written agreement.",
    icon: Briefcase,
  },
  {
    title: "Payments and plans",
    body:
      "Fees are set in the applicable checkout flow, order form, or agreement. Unless a written agreement says otherwise, fees are non-refundable once digital access is granted or work has started.",
    icon: BadgeDollarSign,
  },
  {
    title: "Rights and ownership",
    body:
      "Blueprint keeps its pre-existing software, tooling, workflows, and other intellectual property. Buyers and operators receive only the rights granted in the applicable listing, checkout flow, or written agreement. Capture provenance, privacy metadata, and consent metadata remain part of the product record.",
    icon: ShieldCheck,
  },
  {
    title: "Operator rules",
    body:
      "If you provide access to a facility, you represent that you have the authority to do so or that you have obtained the permissions required to allow capture, packaging, or commercialization. Site-specific restrictions on access, privacy, and downstream use continue to apply after capture.",
    icon: Gavel,
  },
] as const;

const roleTerms = [
  {
    title: "Buyer schedule",
    items: [
      "Historical package access and hosted sessions remain controlled by their listing, checkout, order form, or written agreement; current run exports follow the run's permitted-use record.",
      "A Task Evaluation Run is decision support scoped to its request, evidence, validation envelope, and artifacts.",
      "Buyer sharing, internal use, and downstream export rights must match the rights sheet or written terms.",
    ],
  },
  {
    title: "Operator schedule",
    items: [
      "Operators must have authority to approve capture, listing visibility, policy evaluation, buyer access, and commercialization.",
      "Restricted zones, capture windows, privacy instructions, and revocation or refresh requirements remain part of the site record.",
      "Private or employee-only spaces require explicit approval before capture or buyer-facing use.",
    ],
  },
  {
    title: "Capturer schedule",
    items: [
      "Capturers may submit only lawful public-facing routes unless Blueprint and the operator approve otherwise.",
      "Capturers must avoid restricted areas, payment terminals, sensitive screens, private records, and people when possible.",
      "Submission review, approval, payout eligibility, and downstream use are not automatic.",
    ],
  },
];

export default function Terms() {
  return <>
    <SEO title="Terms of Service | Blueprint" description="Terms for Blueprint Task Evaluation Runs, capture workflows, and related services." canonical="/terms" image="https://tryblueprint.io/images/site-led/workcell.webp" />
    <article className="ms-legal ms-container">
      <h1>Terms of Service</h1><p>Effective March 23, 2026</p><p>Agreement to use Blueprint services and site products.</p>
      {sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
      <section><h2>Disclaimer</h2><p>Blueprint does not promise that a site package or hosted session is a deployment guarantee. The product helps teams evaluate a real site earlier and make better decisions before travel or deployment work.</p></section>
      <section><h2>Governing law and contact</h2><p>These terms are governed by the laws of the State of North Carolina, without regard to conflict-of-law rules. Questions can be sent to Blueprint Legal.</p><p><a href="mailto:legal@tryblueprint.io">legal@tryblueprint.io</a></p></section>
      {roleTerms.map((role) => <section key={role.title}><h2>{role.title}</h2><ul>{role.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}
    </article>
  </>;
}
