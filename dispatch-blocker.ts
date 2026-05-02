import { dispatchHumanBlocker } from "./server/utils/human-blocker-dispatch";

// We'll run this as a script
async function main() {
  const blockerId = `blocker-${Date.now()}`;
  const packet = {
    blockerId,
    title: "Awaiting buyer discussion thread and artifact target for Solutions Engineering Active Delivery Review",
    summary: "The Solutions Engineering Active Delivery Review is blocked waiting for the buyer to attach a live discussion thread and specify the artifact target needed to proceed.",
    decisionType: "buyer_context_provision",
    irreversibleActionClass: null,
    recommendedAnswer: "Attach the live discussion thread (e.g., Slack thread link) and specify the artifact location (e.g., document or ticket) so we can proceed with the review.",
    exactResponseNeeded: "Please reply with the discussion thread link and artifact location.",
    whyBlocked: "The Solutions Engineering Active Delivery Review requires buyer context in the form of a live discussion thread and an artifact target. Without these, we cannot proceed with the review.",
    alternatives: [
      "Wait for the buyer to provide the required information.",
      "Escalate to the buyer's point of contact via known channels."
    ],
    risk: "Delay in receiving buyer context will stall the Solutions Engineering Active Delivery Review, impacting downstream delivery timelines.",
    executionOwner: "webapp-codex",
    immediateNextAction: "Once the buyer provides the discussion thread and artifact target, resume the Solutions Engineering Active Delivery Review workflow.",
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    evidence: [
      "Blocker description from issue BLU-4146 (abcca582-556e-41b1-ad33-d82d2caf0c70)",
      "Human Blocker Packet Standard requires a decision-ready packet for true human gates."
    ],
    nonScope: "This blocker does not authorize any changes to the review process itself; it only seeks the missing buyer context.",
    repoContext: {
      repo: "Blueprint-WebApp",
      project: "blueprint-webapp",
      issueId: "abcca582-556e-41b1-ad33-d82d2caf0c70"
    },
    policyContext: {
      gateMode: "universal_founder_inbox",
      reasonCategory: "buyer_context_provision",
      autoExecutionEligible: false
    },
    resumeAction: {
      kind: "manual_followup",
      description: "Verify the buyer-provided discussion thread and artifact target, then wake the execution owner to continue the review."
    }
  };

  const result = await dispatchHumanBlocker({
    packet,
    blocker_kind: "technical",
    delivery_mode: "send_now",
    email_target: "ohstnhunt@gmail.com",
    mirror_to_slack: false, // Set to false for now, we can adjust if needed
    routing_owner: "blueprint-chief-of-staff",
    execution_owner: "webapp-codex",
    escalation_owner: "blueprint-cto",
    sender_owner: "webapp-codex",
    report_paths: ["./scripts/human-replies/send-test-blocker.ts"], // example
    paperclip_issue_id: "abcca582-556e-41b1-ad33-d82d2caf0c70",
    actor: {
      uid: process.env.PAPERCLIP_AGENT_ID || "unknown",
      email: "blueprint-chief-of-staff@local"
    }
  });

  console.log("Dispatch result:", JSON.stringify(result, null, 2));
  return result;
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});