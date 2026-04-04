import type { Issue } from "@paperclipai/plugin-sdk";
import type { SlackWebhookTargets } from "./slack-notify.js";
import { cleanIssueTitle } from "./slack-copy.js";

export type FounderBusinessLane =
  | "Executive"
  | "Ops"
  | "Growth"
  | "Buyer"
  | "Capturer"
  | "Experiment"
  | "Risk";

export type FounderVisibilityState = {
  alerts: Record<
    string,
    {
      sentAt: string;
      payloadHash: string;
      evidenceKey?: string | null;
    }
  >;
};

export type FounderExceptionDigest = {
  fingerprint: string;
  category: string;
  lane: FounderBusinessLane;
  title: string;
  sections: Array<{ heading: string; items: string[] }>;
  evidenceKey?: string | null;
  requireEvidence?: boolean;
};

function digestPayloadHash(sections: FounderExceptionDigest["sections"]) {
  return JSON.stringify(sections);
}

export function buildFounderIssueExceptionDigest(
  issue: Pick<Issue, "id" | "priority" | "status" | "title">,
  owner: string,
  lane: FounderBusinessLane,
): FounderExceptionDigest | null {
  const priority = issue.priority;
  const highPriority = priority === "critical" || priority === "high";
  const normalizedTitle = issue.title.toLowerCase();

  if (issue.status === "blocked" && highPriority) {
    const rightsLike = normalizedTitle.includes("rights")
      || normalizedTitle.includes("privacy")
      || normalizedTitle.includes("provenance");
    const buyerLike = lane === "Buyer";
    const category = rightsLike
      ? "Rights / Privacy / Provenance"
      : buyerLike
        ? "Buyer Deal Risk"
        : "P1 Blocker";
    return {
      fingerprint: `founder-exception:issue:${category}:${issue.id}`,
      category,
      lane: rightsLike ? "Risk" : lane,
      title: `Founder Exception | ${category} | ${rightsLike ? "Risk" : lane}`,
      sections: [
        { heading: "What Changed", items: [`A ${priority} issue moved into blocked state: ${cleanIssueTitle(issue.title)}.`] },
        { heading: "Why It Matters Now", items: [buyerLike ? "An active buyer-facing thread is at risk of slipping." : rightsLike ? "A rights, privacy, or provenance gate is blocking forward motion." : "A high-priority lane is blocked and needs active follow-through."] },
        { heading: "Owner + Next Checkpoint", items: [`${owner} owns the next move. Checkpoint is the next meaningful unblock step on this issue.`] },
        { heading: "Founder Decision Needed", items: [rightsLike ? "Be ready to decide whether to pause, narrow scope, or accept the restriction if the owner cannot clear it quickly." : buyerLike ? "Step in only if the owner cannot recover the buyer path by the next checkpoint." : "Reprioritize or step in only if the blocker remains unresolved after the next checkpoint."] },
      ],
    };
  }

  return null;
}

export async function maybePostFounderException(
  digest: FounderExceptionDigest,
  deps: {
    readState: () => Promise<FounderVisibilityState | null>;
    writeState: (state: FounderVisibilityState) => Promise<void>;
    resolveSlackTargets: () => Promise<SlackWebhookTargets>;
    postSlackDigest: (
      targets: SlackWebhookTargets,
      digest: {
        channel: string;
        title: string;
        sections: FounderExceptionDigest["sections"];
      },
    ) => Promise<unknown>;
    now?: Date;
  },
) {
  const state = await deps.readState() ?? { alerts: {} };
  const existing = state.alerts[digest.fingerprint];
  const now = deps.now ?? new Date();
  const payloadHash = digestPayloadHash(digest.sections);
  const cooldownMs = 6 * 60 * 60 * 1000;

  if (digest.requireEvidence && !digest.evidenceKey) {
    return false;
  }

  if (digest.evidenceKey && existing?.evidenceKey === digest.evidenceKey) {
    return false;
  }

  if (!digest.evidenceKey && existing) {
    const sentAt = new Date(existing.sentAt).getTime();
    if (Number.isFinite(sentAt) && now.getTime() - sentAt < cooldownMs && existing.payloadHash === payloadHash) {
      return false;
    }
  }

  const slackTargets = await deps.resolveSlackTargets();
  if (!(slackTargets.exec || slackTargets.manager || slackTargets.default)) {
    return false;
  }

  await deps.postSlackDigest(slackTargets, {
    channel: "#paperclip-exec",
    title: digest.title,
    sections: digest.sections,
  });

  state.alerts[digest.fingerprint] = {
    sentAt: now.toISOString(),
    payloadHash,
    evidenceKey: digest.evidenceKey ?? null,
  };
  await deps.writeState(state);
  return true;
}
