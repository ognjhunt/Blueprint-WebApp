import crypto from "node:crypto";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { slugifyCityName } from "./cityLaunchProfiles";
import type { CityLaunchProspectRecord } from "./cityLaunchLedgers";

export type CityLaunchNotificationTrigger = "city_launch_targets_promoted";
export type CityLaunchNotificationChannel = "push" | "in_app";
export type CityLaunchNotificationStatus = "queued" | "sent" | "skipped" | "failed";

export type CityLaunchNotificationRecord = {
  id: string;
  city: string;
  citySlug: string;
  recipientCreatorId: string;
  triggerType: CityLaunchNotificationTrigger;
  candidateIds: string[];
  prospectIds: string[];
  title: string;
  body: string;
  channel: CityLaunchNotificationChannel;
  status: CityLaunchNotificationStatus;
  skipReason: string | null;
  failureReason: string | null;
  pushMessageId: string | null;
  createdAtIso: string;
  sentAtIso: string | null;
};

export type CityLaunchNotificationRecipient = {
  creatorId: string;
  profile: Record<string, unknown>;
};

export type CityLaunchPushTransport = {
  configured: () => boolean;
  send: (input: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }) => Promise<{ messageId: string | null }>;
};

export type CityLaunchNotificationDispatchResult = {
  generatedAt: string;
  dryRun: boolean;
  city: string;
  citySlug: string;
  triggerType: CityLaunchNotificationTrigger;
  prospectIds: string[];
  recipientCount: number;
  queuedCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  records: CityLaunchNotificationRecord[];
};

const COLLECTION = "cityLaunchNotifications";
const USABLE_PUSH_AUTHORIZATION_STATUSES = new Set([
  "authorized",
  "provisional",
  "ephemeral",
  "granted",
]);
const CAPTURE_SURFACE_PROSPECT_STATUSES = new Set(["approved", "onboarded", "capturing"]);
const memoryLedger = new Map<string, CityLaunchNotificationRecord>();

function nowIso() {
  return new Date().toISOString();
}

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function shouldUseMemoryLedger() {
  return !db || process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

function stableHash(values: string[]) {
  return crypto
    .createHash("sha256")
    .update(values.join("|"))
    .digest("hex")
    .slice(0, 16);
}

function normalizeToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCollection(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function notificationDevice(profile: Record<string, unknown>) {
  return asRecord(profile.notification_device || profile.notificationDevice);
}

function notificationPreferences(profile: Record<string, unknown>) {
  return asRecord(profile.notification_preferences || profile.notificationPreferences);
}

function nearbyJobsEnabled(profile: Record<string, unknown>) {
  const preferences = notificationPreferences(profile);
  return preferences.nearby_jobs !== false && preferences.nearbyJobs !== false;
}

function pushToken(profile: Record<string, unknown>) {
  const device = notificationDevice(profile);
  return asString(device.fcm_token || device.fcmToken || profile.fcm_token || profile.deviceToken);
}

function hasUsablePushDevice(profile: Record<string, unknown>) {
  const token = pushToken(profile);
  if (!token) return false;
  const device = notificationDevice(profile);
  const status = normalizeToken(device.authorization_status || device.authorizationStatus || "unknown")
    .replace(/\s+/g, "_");
  return USABLE_PUSH_AUTHORIZATION_STATUSES.has(status);
}

function profileMarketValues(profile: Record<string, unknown>) {
  return [
    ...normalizeCollection(profile.capturerMarket),
    ...normalizeCollection(profile.mostFrequentLocation),
    ...normalizeCollection(profile.market),
    ...normalizeCollection(profile.homeMarket),
    ...normalizeCollection(profile.home_city),
    ...normalizeCollection(profile.homeCity),
    ...normalizeCollection(profile.current_city),
    ...normalizeCollection(profile.currentCity),
    ...normalizeCollection(profile.city),
    ...normalizeCollection(profile.serviceAreas),
    ...normalizeCollection(profile.service_areas),
    ...normalizeCollection(profile.markets),
  ];
}

function profileMatchesCity(profile: Record<string, unknown>, city: string, citySlug: string) {
  const cityName = city.split(",")[0]?.trim() || city.trim();
  const cityToken = normalizeToken(cityName);
  const fullCityToken = normalizeToken(city);
  return profileMarketValues(profile).some((value) => {
    const slug = slugifyCityName(value);
    const token = normalizeToken(value);
    return slug === citySlug || token === cityToken || token === fullCityToken || token.includes(cityToken);
  });
}

function extractProfile(doc: FirebaseFirestore.QueryDocumentSnapshot): CityLaunchNotificationRecipient | null {
  const profile = doc.data() as Record<string, unknown>;
  const creatorId = asString(profile.creator_id || profile.creatorId || profile.uid) || doc.id;
  if (!creatorId) return null;
  return { creatorId, profile: { ...profile, creator_id: creatorId } };
}

async function listCollectionProfiles(collection: string) {
  if (!db) return [];
  const snapshot = await db.collection(collection).limit(1000).get();
  return snapshot.docs
    .map(extractProfile)
    .filter((entry): entry is CityLaunchNotificationRecipient => Boolean(entry));
}

export async function listCityLaunchNotificationRecipients(input: {
  city: string;
  citySlug?: string;
  recipientCreatorIds?: string[] | null;
}) {
  const citySlug = input.citySlug || slugifyCityName(input.city);
  const allowedIds = input.recipientCreatorIds?.length
    ? new Set(input.recipientCreatorIds.map((id) => id.trim()).filter(Boolean))
    : null;
  const byCreatorId = new Map<string, CityLaunchNotificationRecipient>();
  const creatorProfiles = await listCollectionProfiles("creatorProfiles");
  const userProfiles = await listCollectionProfiles("users");

  for (const recipient of [...creatorProfiles, ...userProfiles]) {
    const existing = byCreatorId.get(recipient.creatorId);
    byCreatorId.set(recipient.creatorId, {
      creatorId: recipient.creatorId,
      profile: existing ? { ...recipient.profile, ...existing.profile } : recipient.profile,
    });
  }

  return Array.from(byCreatorId.values()).filter((recipient) => {
    if (allowedIds && !allowedIds.has(recipient.creatorId)) return false;
    if (!nearbyJobsEnabled(recipient.profile)) return false;
    return profileMatchesCity(recipient.profile, input.city, citySlug);
  });
}

export function buildCityLaunchNotificationCopy(input: {
  city: string;
  prospects: CityLaunchProspectRecord[];
}) {
  const shortCity = input.city.split(",")[0]?.trim() || input.city;
  const count = input.prospects.length;
  const first = input.prospects[0];
  const title = `New Blueprint capture targets in ${shortCity}`;
  const body = count === 1 && first
    ? `A new indoor public-area target is ready near you: ${first.name}. Review zones before capturing.`
    : `${count} indoor public-area targets are ready to review. Open Blueprint Capture to see routes and guidance.`;
  return { title, body };
}

function notificationId(input: {
  citySlug: string;
  recipientCreatorId: string;
  prospectIds: string[];
}) {
  const hash = stableHash([...input.prospectIds].sort());
  return `city_launch_targets_promoted_${input.citySlug}_${input.recipientCreatorId}_${hash}`;
}

async function readExistingNotification(id: string) {
  if (shouldUseMemoryLedger()) {
    return memoryLedger.get(id) || null;
  }
  if (!db) return null;
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? doc.data() as CityLaunchNotificationRecord : null;
}

async function writeNotification(record: CityLaunchNotificationRecord) {
  if (shouldUseMemoryLedger()) {
    memoryLedger.set(record.id, record);
    return record;
  }
  if (!db) {
    throw new Error("Database not available");
  }
  await db.collection(COLLECTION).doc(record.id).set(
    {
      ...record,
      updated_at: serverTimestamp(),
      created_at: serverTimestamp(),
    },
    { merge: true },
  );
  return record;
}

function defaultPushTransport(): CityLaunchPushTransport {
  return {
    configured: () =>
      process.env.BLUEPRINT_CITY_LAUNCH_PUSH_NOTIFICATIONS_ENABLED === "1"
      && Boolean(admin.apps?.length),
    send: async (input) => {
      const messageId = await admin.messaging().send({
        token: input.token,
        notification: {
          title: input.title,
          body: input.body,
        },
        data: input.data,
      });
      return { messageId };
    },
  };
}

function eligibleProspects(prospects: CityLaunchProspectRecord[]) {
  return prospects.filter((prospect) =>
    CAPTURE_SURFACE_PROSPECT_STATUSES.has(prospect.status)
    && Boolean(prospect.researchProvenance?.sourceUrls?.length)
    && prospect.lat !== null
    && prospect.lng !== null,
  );
}

export async function dispatchCityLaunchTargetPromotionNotifications(input: {
  city: string;
  promotedProspects: CityLaunchProspectRecord[];
  dryRun?: boolean;
  recipients?: CityLaunchNotificationRecipient[] | null;
  recipientCreatorIds?: string[] | null;
  transport?: CityLaunchPushTransport | null;
}): Promise<CityLaunchNotificationDispatchResult> {
  const generatedAt = nowIso();
  const citySlug = slugifyCityName(input.city);
  const prospects = eligibleProspects(input.promotedProspects);
  const prospectIds = prospects.map((prospect) => prospect.id).sort();
  const { title, body } = buildCityLaunchNotificationCopy({ city: input.city, prospects });
  const transport = input.transport || defaultPushTransport();
  const records: CityLaunchNotificationRecord[] = [];

  if (!prospects.length) {
    return {
      generatedAt,
      dryRun: Boolean(input.dryRun),
      city: input.city,
      citySlug,
      triggerType: "city_launch_targets_promoted",
      prospectIds,
      recipientCount: 0,
      queuedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      records,
    };
  }

  const rawRecipients = input.recipients || await listCityLaunchNotificationRecipients({
    city: input.city,
    citySlug,
    recipientCreatorIds: input.recipientCreatorIds,
  });
  const recipientIdSet = input.recipientCreatorIds?.length
    ? new Set(input.recipientCreatorIds.map((id) => id.trim()).filter(Boolean))
    : null;
  const recipients = rawRecipients.filter((recipient) => {
    if (recipientIdSet && !recipientIdSet.has(recipient.creatorId)) return false;
    if (!nearbyJobsEnabled(recipient.profile)) return false;
    return profileMatchesCity(recipient.profile, input.city, citySlug);
  });

  for (const recipient of recipients) {
    const id = notificationId({
      citySlug,
      recipientCreatorId: recipient.creatorId,
      prospectIds,
    });
    const existing = await readExistingNotification(id);
    if (existing) {
      records.push({
        ...existing,
        status: "skipped",
        skipReason: "duplicate_notification",
      });
      continue;
    }

    const hasPush = hasUsablePushDevice(recipient.profile);
    const pushConfigured = transport.configured();
    const baseRecord: CityLaunchNotificationRecord = {
      id,
      city: input.city,
      citySlug,
      recipientCreatorId: recipient.creatorId,
      triggerType: "city_launch_targets_promoted",
      candidateIds: prospects
        .map((prospect) => prospect.researchProvenance?.sourceKey)
        .filter((value): value is string => Boolean(value)),
      prospectIds,
      title,
      body,
      channel: hasPush && pushConfigured ? "push" : "in_app",
      status: "queued",
      skipReason: hasPush
        ? pushConfigured ? null : "push_transport_not_configured"
        : "push_device_unavailable",
      failureReason: null,
      pushMessageId: null,
      createdAtIso: generatedAt,
      sentAtIso: null,
    };

    if (input.dryRun) {
      records.push(baseRecord);
      continue;
    }

    if (!hasPush || !pushConfigured) {
      records.push(await writeNotification(baseRecord));
      continue;
    }

    try {
      const sent = await transport.send({
        token: pushToken(recipient.profile),
        title,
        body,
        data: {
          trigger_type: "city_launch_targets_promoted",
          city: input.city,
          city_slug: citySlug,
          prospect_ids: prospectIds.join(","),
        },
      });
      records.push(await writeNotification({
        ...baseRecord,
        status: "sent",
        pushMessageId: sent.messageId,
        sentAtIso: nowIso(),
      }));
    } catch (error) {
      records.push(await writeNotification({
        ...baseRecord,
        status: "failed",
        failureReason: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return {
    generatedAt,
    dryRun: Boolean(input.dryRun),
    city: input.city,
    citySlug,
    triggerType: "city_launch_targets_promoted",
    prospectIds,
    recipientCount: recipients.length,
    queuedCount: records.filter((record) => record.status === "queued").length,
    sentCount: records.filter((record) => record.status === "sent").length,
    skippedCount: records.filter((record) => record.status === "skipped").length,
    failedCount: records.filter((record) => record.status === "failed").length,
    records,
  };
}

export function __resetCityLaunchNotificationMemoryForTests() {
  memoryLedger.clear();
}

export function __readCityLaunchNotificationMemoryForTests() {
  return Array.from(memoryLedger.values());
}
