import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  createGrowthCampaignDraft,
  queueGrowthCampaignSend,
} from "./growth-ops";
import { getConfiguredEnvValue } from "../config/env";

interface FirehoseSignal {
  id: string;
  topic: string;
  title: string;
  summary: string;
  url?: string | null;
  source?: string | null;
  publishedAt?: string | null;
}

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

function firehoseConfig() {
  const apiToken = getConfiguredEnvValue("FIREHOSE_API_TOKEN");
  const baseUrl = getConfiguredEnvValue("FIREHOSE_BASE_URL");
  return {
    configured: Boolean(apiToken && baseUrl),
    apiToken,
    baseUrl: (baseUrl || "").replace(/\/+$/, ""),
  };
}

export async function fetchFirehoseSignals(topic: string) {
  const config = firehoseConfig();
  if (!config.configured) {
    throw new Error("Firehose is not configured");
  }

  const response = await fetch(`${config.baseUrl}/signals/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: topic,
      topics: [topic],
      limit: 6,
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });

  const payload = (await response.json()) as {
    items?: Array<Record<string, unknown>>;
    signals?: Array<Record<string, unknown>>;
  };

  if (!response.ok) {
    throw new Error(`Firehose ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  const rawSignals = payload.items || payload.signals || [];
  return rawSignals
    .map((item): FirehoseSignal | null => {
      const id = normalizeString(item.id || item.externalId);
      const title = normalizeString(item.title);
      const summary = normalizeString(item.summary || item.snippet);
      if (!id || !title || !summary) {
        return null;
      }
      return {
        id,
        topic: normalizeString(item.topic) || topic,
        title,
        summary,
        url: normalizeString(item.url) || null,
        source: normalizeString(item.source) || null,
        publishedAt: normalizeString(item.publishedAt) || null,
      };
    })
    .filter((item): item is FirehoseSignal => Boolean(item));
}

export function buildAutonomousOutboundDraft(params: {
  topic: string;
  signals: FirehoseSignal[];
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
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const config = firehoseConfig();
  if (!config.configured) {
    throw new Error("Firehose is not configured");
  }

  const channel = "sendgrid";
  const recipients = outboundRecipientsFromEnv();
  const operatorEmail = params?.operatorEmail || "autonomous-growth@tryblueprint.io";
  const today = startOfUtcDay();
  const topics = params?.topics?.length ? params.topics : autonomousResearchTopics();
  const results: Array<Record<string, unknown>> = [];

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

    const signals = await fetchFirehoseSignals(topic);
    if (signals.length === 0) {
      await runRef.set(
        {
          topic,
          status: "no_signals",
          signals: [],
          created_at_iso: new Date().toISOString(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      results.push({ topic, status: "no_signals", runId });
      continue;
    }

    const draft = buildAutonomousOutboundDraft({ topic, signals });
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
