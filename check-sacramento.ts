import { dbAdmin as db } from "./client/src/lib/firebaseAdmin.ts";
import { decryptInboundRequestForAdmin } from "./server/utils/field-encryption.ts";
import { normalizeDemandCity } from "./client/src/lib/cityDemandMessaging.ts";
import { slugifyCityName } from "./server/utils/cityLaunchProfiles.ts";

function normalizeToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textMatchesCity(citySlug: string, value: string | null | undefined) {
  const normalized = normalizeToken(value);
  const cityLabel = normalizeToken(citySlug.replace(/-/g, " "));
  const shortLabel = cityLabel.replace(/\s+[a-z]{2}$/, "");
  return normalized.includes(cityLabel)
    || normalized.includes(shortLabel)
    || (citySlug.includes("san-francisco")
      && (normalized.includes("bay area") || normalized.includes("sf")));
}

function extractProofPathTimestamp(proofPath: Record<string, unknown> | undefined, key: string) {
  const value = proofPath?.[key];
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

function requestMatchesCity(citySlug: string, request: { context?: { demandCity?: string | null }; request?: { siteLocation?: string | null } }) {
  const demandCity = normalizeDemandCity(request.context?.demandCity || null);
  if (
    (citySlug === "austin-tx" && demandCity === "austin")
    || (citySlug === "san-francisco-ca" && demandCity === "san-francisco")
  ) {
    return true;
  }
  return textMatchesCity(citySlug, request.request?.siteLocation || null);
}

async function decryptInboundRequests() {
  if (!db) {
    return [] as any[];
  }
  const snapshot = await db.collection("inboundRequests").limit(1500).get();
  const records = await Promise.all(
    snapshot.docs.map(async (doc) => {
      try {
        const decrypted = (await decryptInboundRequestForAdmin(
          doc.data() as any,
        )) as any;
        return {
          ...decrypted,
          requestId: doc.id,
        };
      } catch {
        return null;
      }
    }),
  );
  return records.filter((record): record is any => Boolean(record));
}

async function main() {
  const city = "sacramento-ca";
  const citySlug = slugifyCityName(city);
  console.log(`Checking for Sacramento (slug: ${citySlug})`);

  const inboundRequests = await decryptInboundRequests();
  console.log(`Total inbound requests: ${inboundRequests.length}`);

  const cityRobotTeamRequests = inboundRequests.filter(
    (request) => request.request?.buyerType === "robot_team" && requestMatchesCity(citySlug, request),
  );
  console.log(`Robot team requests for Sacramento: ${cityRobotTeamRequests.length}`);

  const proofPacksDelivered = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "proof_pack_delivered_at"));
  }).length;
  console.log(`Proof packs delivered: ${proofPacksDelivered}`);

  const hostedReviewsStarted = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "hosted_review_started_at"));
  }).length;
  console.log(`Hosted reviews started: ${hostedReviewsStarted}`);

  const hostedFollowUps = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "hosted_review_follow_up_at"));
  }).length;
  console.log(`Hosted review follow-ups sent: ${hostedFollowUps}`);

  if (proofPacksDelivered > 0 && hostedReviewsStarted > 0 && hostedFollowUps > 0) {
    console.log("CONDITION MET: All three stamps are present.");
  } else {
    console.log("CONDITION NOT MET: Missing one or more stamps.");
  }
}

main().catch(console.error);
