import { communicationsFixture, syntheticQualification } from "./communications";
import { communicationsDigest, type CommunicationsOutput } from "../../agents/communications-contract";

/** Invented operators, people, *.example sources and evidence only. These are
 * representative expected outputs, not results from a live model or Gmail. */
export function founderOutreachFixture(kind: "named" | "inbox" | "dated" | "future" = "named") {
  const f = communicationsFixture(), inbox = kind === "inbox", dated = kind === "dated";
  f.brief.boundedJob = "CNC machine tending";
  f.brief.facilityName = "Synthetic Crosby shop";
  f.brief.contact.recipient = inbox ? { kind: "inbox", addressee: "machining team", person: null }
    : { kind: "named_person", name: "Riley Morgan", role: "Operations manager", sourceUrl: "https://machine-shop.example/contact" };
  const sourceClaim = dated ? "The operator's 2020 announcement describes a machining line."
    : "The operator's equipment page lists CNC mills and lathes at its Crosby shop.";
  const openingClaim = dated ? "Your 2020 announcement mentioned a machining line."
    : "I saw the CNC mills and lathes listed on your equipment page.";
  f.brief.facts = [{ id: "equipment-fact", claim: sourceClaim, sourceUrl: "https://machine-shop.example/equipment",
    sourceCheckedAt: "2026-09-30T20:00:00Z", publishedAt: dated ? "2020-03-01" : null, eventAt: null,
    evidenceClass: "operator_stated", assertionScope: dated ? "as_of_background" : "current_operational", consequential: false }];
  f.brief.outreachContext.observations = [{ claim: sourceClaim, source: f.brief.facts[0].sourceUrl }];
  f.brief.unknowns = ["Manual work, existing automation, robot fit, pain, savings and buying intent are unknown."];
  f.brief.qualification = syntheticQualification(f.brief.boundedJob, f.brief.facilityName);
  const senderIdentity = "I'm building Blueprint to help businesses figure out where robots might fit.";
  const question = kind === "future"
    ? "Would exploring the options for machine tending be useful, even if it is just to prepare for later?"
    : "Would exploring robotics for machine tending at your Crosby shop be useful?";
  const body = [inbox ? "Hi machining team," : "Hi Riley,", `${openingClaim} ${senderIdentity}`,
    question, "Thanks,\nNijel Hunt\nBlueprint"].join("\n\n");
  const output: CommunicationsOutput = { disposition: "draft", subject: "CNC machine tending in Crosby", body,
    reason: `${sourceClaim} Source checked ${f.brief.facts[0].sourceCheckedAt}; scope ${f.brief.facts[0].assertionScope}. ${f.brief.unknowns[0]}`,
    usedFactIds: ["equipment-fact"], refreshFactIds: [], requiresHumanReview: true,
    outreachContract: { version: "blueprint.outreach.v4", senderIdentity,
      opening: { kind: "cold", noVerifiedConnectionReason: "No verified connection is recorded.",
        publicDetail: { claim: openingClaim, sourceClaim, source: f.brief.facts[0].sourceUrl }, relevance: question },
      questions: [{ question, checks: ["interest"] }], recipientChoice: question },
  };
  f.job.briefDigest = communicationsDigest(f.brief); f.handoff.briefDigest = f.job.briefDigest;
  return { ...f, output };
}
