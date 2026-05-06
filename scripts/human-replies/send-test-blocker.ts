import { dispatchHumanBlocker } from "../../server/utils/human-blocker-dispatch";

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim();
  }
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1]?.trim() || "";
  }
  return "";
}

async function main() {
  const suffix =
    argValue("--id")
    || new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
  const blockerId = `founder-inbox-production-smoke-${suffix}`;
  const replyPhrase = `APPROVE ${blockerId}`;

  const result = await dispatchHumanBlocker({
    blocker_kind: "technical",
    delivery_mode: "send_now",
    dispatch_id: `dispatch-${blockerId}`,
    email_target: "ohstnhunt@gmail.com",
    mirror_to_slack: false,
    routing_owner: "blueprint-chief-of-staff",
    execution_owner: "webapp-codex",
    escalation_owner: "blueprint-cto",
    sender_owner: "webapp-codex",
    report_paths: ["scripts/human-replies/send-test-blocker.ts"],
    packet: {
      blockerId,
      title: "Founder inbox production smoke",
      summary:
        "This is a controlled production smoke for Blueprint's durable founder inbox path.",
      decisionType: "founder_inbox_smoke",
      irreversibleActionClass: null,
      recommendedAnswer:
        "Reply with the exact approval phrase so the Gmail watcher can prove durable ingest and resume.",
      exactResponseNeeded: `Reply exactly: ${replyPhrase}`,
      whyBlocked:
        "The email send path can be tested by dispatch, but the durable reply-resume path is only proven after a tagged founder reply is ingested.",
      alternatives: [
        "Configure Gmail OAuth and reply with the exact phrase.",
        "Leave the thread blocked if Gmail OAuth is not configured yet.",
      ],
      risk:
        "If the reply watcher is not configured or points at the wrong mailbox, founder approvals can be visible in email but not resumable by the autonomous org.",
      executionOwner: "webapp-codex",
      immediateNextAction:
        "Run npm run human-replies:poll and verify humanReplyEvents, humanBlockerThreads, and Paperclip wake evidence.",
      deadline: "Same day",
      evidence: [
        "Founder inbox contract requires durable email reply correlation.",
        "Approved durable identity is ohstnhunt@gmail.com.",
        "Slack replies are durable only for configured DM or allowlisted thread events that correlate to this blocker id.",
      ],
      nonScope:
        "This smoke does not authorize commercial, legal, rights, pricing, or production customer commitments.",
      repoContext: {
        repo: "Blueprint-WebApp",
        project: "blueprint-webapp",
        sourceRef: "scripts/human-replies/send-test-blocker.ts",
      },
      policyContext: {
        gateMode: "universal_founder_inbox",
        reasonCategory: "founder_inbox_smoke",
        autoExecutionEligible: false,
      },
      resumeAction: {
        kind: "manual_followup",
        description:
          "Verify the tagged founder reply and wake the WebApp execution owner.",
        metadata: {
          blockerId,
          replyPhrase,
        },
      },
    },
    actor: {
      uid: "codex",
      email: "codex@local",
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: result.email_sent === true,
        replyPhrase,
        ...result,
        packet_text: undefined,
      },
      null,
      2,
    ),
  );

  if (result.email_sent !== true) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
