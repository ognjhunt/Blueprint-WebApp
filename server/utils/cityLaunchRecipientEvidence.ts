import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export async function resolveHistoricalRecipientEvidence(params: {
  targets: Array<string | null | undefined>;
}) {
  if (!db || process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    return new Map<string, { recipientEmail: string; source: string }>();
  }

  const targets = params.targets
    .map((target) => ({
      raw: String(target || "").trim(),
      key: normalizeComparableText(target),
    }))
    .filter(
      (entry): entry is { raw: string; key: string } =>
        Boolean(entry.raw && entry.key),
    );

  if (targets.length === 0) {
    return new Map<string, { recipientEmail: string; source: string }>();
  }

  const [campaignSnapshot, eventSnapshot] = await Promise.all([
    db.collection("growthCampaigns").orderBy("created_at", "desc").limit(200).get(),
    db.collection("growth_campaign_events").orderBy("received_at", "desc").limit(500).get(),
  ]);

  const campaignIdsWithEvidence = new Set(
    eventSnapshot.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .map((data) => {
        if (typeof data.local_campaign_id === "string" && data.local_campaign_id.trim()) {
          return data.local_campaign_id.trim();
        }
        if (
          typeof data.campaign_id === "string"
          && data.campaign_id.trim()
          && data.campaign_id !== "unknown"
        ) {
          return data.campaign_id.trim();
        }
        return "";
      })
      .filter(Boolean),
  );

  const matches = new Map<string, { recipientEmail: string; source: string }>();

  for (const doc of campaignSnapshot.docs) {
    if (!campaignIdsWithEvidence.has(doc.id)) {
      continue;
    }

    const data = doc.data() as Record<string, unknown>;
    const recipientEmails = Array.isArray(data.recipient_emails)
      ? data.recipient_emails.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        )
      : [];
    if (recipientEmails.length === 0) {
      continue;
    }

    const searchableText = normalizeComparableText(
      [
        typeof data.name === "string" ? data.name : "",
        typeof data.subject === "string" ? data.subject : "",
        typeof data.body === "string" ? data.body : "",
      ].join(" "),
    );

    for (const target of targets) {
      if (matches.has(target.key) || !searchableText.includes(target.key)) {
        continue;
      }
      matches.set(target.key, {
        recipientEmail: recipientEmails[0],
        source: `Recipient sourced from real growth campaign delivery evidence for ${target.raw}.`,
      });
    }
  }

  return matches;
}
