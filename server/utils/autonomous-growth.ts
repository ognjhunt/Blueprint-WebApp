import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  createGrowthCampaignDraft,
  queueGrowthCampaignSend,
} from "./growth-ops";
import { getConfiguredEnvValue } from "../config/env";
import {
  resolveMarketSignalProvider,
  type MarketSignalProvider,
  type MarketSignalRecord,
} from "./marketSignalProviders";
import { writeMarketSignalCache } from "./marketSignalCache";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function startOfUtcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function outboundRecipientsFromEnv() {
  return (process.env.BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS || "")
    .split(/[,\n]+/)
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, items) => value.includes("@") && items.indexOf(value) === index);
}

function autonomousResearchTopics() {
  return (process.env.BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS || "warehouse robotics,field robotics deployment")
    .split(/[,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildAutonomousOutboundDraft(params: {
  topic: string;
  signals: MarketSignalRecord[];
}) {
  const evidence = params.signals.slice(0, 3);
  const subject = `Why ${params.topic} teams are narrowing the exact-site review question sooner`;
  const body = [
    "Hi,",
    "",
    `Blueprint's weekly demand scan found fresh signals around ${params.topic}.`,
    "",
    "What came up repeatedly:",
    ...evidence.map((signal, index) => `${index + 1}. ${signal.title}: ${signal.summary}${signal.url ? ` (${signal.url})` : ""}`),
    "",
    "Blueprint's wedge is still the same: one real facility, one workflow question, one capture-backed package, and one hosted review path tied to that exact site.",
    "",
    "If your team needs to answer the next deployment question before another site visit, the next step is to book the exact-site hosted review.",
    "",
    "Best,",
    "Blueprint",
  ].join("\n");

  return {
    name: `Autonomous outbound: ${params.topic}`,
    subject,
    body,
  };
}

export async function runAutonomousResearchOutboundLoop(params?: {
  topics?: string[];
  operatorEmail?: string;
  provider?: MarketSignalProvider;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const channel = "sendgrid";
  const recipients = outboundRecipientsFromEnv();
  const operatorEmail = params?.operatorEmail || "autonomous-growth@tryblueprint.io";
  const today = startOfUtcDay();
  const topics = params?.topics?.length ? params.topics : autonomousResearchTopics();
  const provider = params?.provider || resolveMarketSignalProvider();
  const results: Array<Record<string, unknown>> = [];
  const limit = Math.max(
    1,
    Number(getConfiguredEnvValue("BLUEPRINT_MARKET_SIGNAL_LIMIT") || "6"),
  );
  const since = new Date(
    Date.now() - Math.max(
      1,
      Number(getConfiguredEnvValue("BLUEPRINT_MARKET_SIGNAL_LOOKBACK_DAYS") || "7"),
    ) * 24 * 60 * 60 * 1000,
  ).toISOString();

  for (const topic of topics) {
    const runId = `${today}__${slugify(topic)}`;
    const runRef = db.collection("autonomous_growth_runs").doc(runId);
    const existing = await runRef.get();
    if (existing.exists) {
      results.push({
        topic,
        status: "skipped_existing",
        runId,
      });
      continue;
    }

    if (!provider) {
      await runRef.set(
        {
          topic,
          status: "provider_unavailable",
          signals: [],
          signal_provider_key: null,
          created_at_iso: new Date().toISOString(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      results.push({
        topic,
        status: "provider_unavailable",
        runId,
      });
      continue;
    }

    const signalResult = await provider.fetchSignals(topic, {
      limit,
      since,
    });
    const signals = signalResult.signals;
    if (signals.length === 0) {
      await runRef.set(
        {
          topic,
          status: "no_signals",
          signals: [],
          signal_provider_key: signalResult.providerKey,
          created_at_iso: new Date().toISOString(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      results.push({ topic, status: "no_signals", runId });
      continue;
    }

    const draft = buildAutonomousOutboundDraft({ topic, signals });
    await writeMarketSignalCache({
      runId,
      providerKey: signalResult.providerKey,
      topic,
      signals,
    });
    const campaign = await createGrowthCampaignDraft({
      name: draft.name,
      subject: draft.subject,
      body: draft.body,
      channel,
      recipientEmails: recipients,
      audienceQuery: `autonomous-topic:${topic}`,
    });

    let queueResult: Awaited<ReturnType<typeof queueGrowthCampaignSend>> | null = null;
    const sendReady = recipients.length > 0;
    if (sendReady) {
      queueResult = await queueGrowthCampaignSend({
        campaignId: campaign.id,
        operatorEmail,
      });
    }

    await runRef.set(
      {
        topic,
        status: sendReady ? "campaign_queued" : "draft_created",
        campaign_id: campaign.id,
        channel,
        recipients,
        signal_provider_key: signalResult.providerKey,
        queue_result_state:
          queueResult && typeof queueResult.state === "string" ? queueResult.state : null,
        signals,
        created_at_iso: new Date().toISOString(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    results.push({
      topic,
      status: sendReady ? "campaign_queued" : "draft_created",
      runId,
      campaignId: campaign.id,
    });
  }

  return {
    count: results.length,
    results,
  };
}
