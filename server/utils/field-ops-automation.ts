import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  CAPTURER_COMMS_POLICY,
  RESCHEDULE_POLICY,
  SITE_ACCESS_POLICY,
  type DraftOutput,
} from "../agents/action-policies";
import { executeAction } from "../agents/action-executor";
import { updateGoogleCalendarEvent } from "./google-calendar";

type CreatorUserRecord = {
  uid: string;
  name: string | null;
  email: string | null;
  phone_number?: string | null;
  capturerMarket?: string | null;
  capturerAvailability?: string | null;
  capturerEquipment?: string[] | null;
  stats?: Record<string, unknown>;
};

type CaptureJobRecord = Record<string, unknown> & {
  title?: string;
  address?: string;
  buyer_request_id?: string;
  availabilityStartsAt?: string | null;
  availability_window?: {
    starts_at?: string | null;
    ends_at?: string | null;
  } | null;
  field_ops?: Record<string, unknown>;
};

type BookingRecord = Record<string, unknown> & {
  blueprintId?: string;
  businessName?: string;
  address?: string;
  date?: string;
  time?: string;
  email?: string;
  contactName?: string;
  status?: string;
  reschedule_request?: Record<string, unknown>;
};

type InboundContactRecord = {
  email: string | null;
  name: string | null;
  company: string | null;
  roleTitle: string | null;
};

type FinanceQueueRecord = {
  id: string;
  status: string;
  creator_id: string | null;
  capture_id: string | null;
  stripe_payout_id: string | null;
  failure_reason: string | null;
  queue: string | null;
  ops_automation: Record<string, unknown>;
  finance_review: Record<string, unknown>;
  updated_at: string | null;
};

export type CapturerCandidate = {
  uid: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  market: string | null;
  availability: string | null;
  equipment: string[];
  totalCaptures: number;
  approvedCaptures: number;
  avgQuality: number;
  score: number;
  score_breakdown: {
    market: number;
    availability: number;
    equipment: number;
    quality: number;
    reliability: number;
  };
  travel_estimate_minutes: number | null;
  travel_estimate_source: "heuristic_market" | "heuristic_region" | "unknown";
};

export type SiteAccessContactSuggestion = {
  email: string;
  name: string | null;
  source:
    | "site_access"
    | "inbound_request_contact"
    | "booking_contact"
    | "blueprint_contact";
  company: string | null;
  roleTitle: string | null;
};

function getDb() {
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const maybeTimestamp = value as { toDate?: () => Date };
  return maybeTimestamp.toDate?.()?.toISOString?.() || null;
}

function buildCaptureWindowStart(job: CaptureJobRecord): string | null {
  if (typeof job.availabilityStartsAt === "string" && job.availabilityStartsAt.trim()) {
    return job.availabilityStartsAt.trim();
  }

  const availabilityWindow = asRecord(job.availability_window);
  return typeof availabilityWindow.starts_at === "string"
    ? availabilityWindow.starts_at
    : null;
}

function addHours(isoDateTime: string, hours: number) {
  const parsed = new Date(isoDateTime);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function loadCreatorUser(creatorId: string | null | undefined): Promise<CreatorUserRecord | null> {
  if (!creatorId) {
    return null;
  }

  const snapshot = await getDb().collection("users").doc(creatorId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;
  return {
    uid: creatorId,
    name: typeof data.name === "string" ? data.name : null,
    email: typeof data.email === "string" ? data.email : null,
    phone_number: typeof data.phone_number === "string" ? data.phone_number : null,
    capturerMarket:
      typeof data.capturerMarket === "string"
        ? data.capturerMarket
        : typeof data.mostFrequentLocation === "string"
          ? data.mostFrequentLocation
          : null,
    capturerAvailability:
      typeof data.capturerAvailability === "string" ? data.capturerAvailability : null,
    capturerEquipment: Array.isArray(data.capturerEquipment)
      ? data.capturerEquipment.filter((entry): entry is string => typeof entry === "string")
      : null,
    stats: asRecord(data.stats),
  };
}

async function loadInboundContact(requestId: string | null | undefined): Promise<InboundContactRecord | null> {
  if (!requestId) {
    return null;
  }

  const snapshot = await getDb().collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;
  const contact = asRecord(data.contact);
  const firstName = typeof contact.firstName === "string" ? contact.firstName.trim() : "";
  const lastName = typeof contact.lastName === "string" ? contact.lastName.trim() : "";
  return {
    email: typeof contact.email === "string" ? contact.email : null,
    name: [firstName, lastName].filter(Boolean).join(" ") || null,
    company: typeof contact.company === "string" ? contact.company : null,
    roleTitle: typeof contact.roleTitle === "string" ? contact.roleTitle : null,
  };
}

async function loadBookingsForEmail(email: string) {
  const snapshot = await getDb()
    .collection("bookings")
    .where("email", "==", email)
    .limit(20)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: (doc.data() || {}) as BookingRecord,
  }));
}

async function loadBlueprint(blueprintId: string | null | undefined) {
  if (!blueprintId) {
    return null;
  }

  const snapshot = await getDb().collection("blueprints").doc(blueprintId).get();
  if (!snapshot.exists) {
    return null;
  }

  return (snapshot.data() || {}) as Record<string, unknown>;
}

function normalizeTextToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildJobMarketLabel(job: CaptureJobRecord) {
  const address = normalizeTextToken(typeof job.address === "string" ? job.address : "");
  const region = normalizeTextToken(typeof job.region_id === "string" ? String(job.region_id) : "");
  return [address, region].filter(Boolean).join(" ");
}

function scoreCapturerCandidate(candidate: CreatorUserRecord, job: CaptureJobRecord): CapturerCandidate {
  const jobMarket = buildJobMarketLabel(job);
  const market = normalizeTextToken(candidate.capturerMarket || null);
  const equipment = candidate.capturerEquipment || [];
  const availability = candidate.capturerAvailability || null;
  const stats = candidate.stats || {};
  const approvedCaptures =
    typeof stats.approvedCaptures === "number" ? stats.approvedCaptures : 0;
  const totalCaptures =
    typeof stats.totalCaptures === "number" ? stats.totalCaptures : 0;
  const avgQuality = typeof stats.avgQuality === "number" ? stats.avgQuality : 0;

  const marketScore = market && jobMarket.includes(market) ? 30 : market ? 15 : 0;
  const availabilityScore =
    availability === "flexible"
      ? 20
      : availability === "weekdays" || availability === "evenings" || availability === "weekends"
        ? 14
        : 6;
  const normalizedEquipment = equipment.map((entry) => entry.toLowerCase());
  const equipmentScore =
    normalizedEquipment.some((entry) => entry.includes("iphone"))
      ? 25
      : normalizedEquipment.length > 0
        ? 12
        : 0;
  const qualityScore = Math.min(Math.max(avgQuality, 0), 25);
  const reliabilityScore = Math.min(approvedCaptures * 2 + totalCaptures, 20);
  const score = marketScore + availabilityScore + equipmentScore + qualityScore + reliabilityScore;
  const travelEstimateMinutes =
    marketScore >= 30 ? 15 : marketScore >= 15 ? 45 : market ? 90 : null;

  return {
    uid: candidate.uid,
    name: candidate.name || null,
    email: candidate.email || null,
    phone_number: candidate.phone_number || null,
    market: candidate.capturerMarket || null,
    availability,
    equipment,
    totalCaptures,
    approvedCaptures,
    avgQuality,
    score,
    score_breakdown: {
      market: marketScore,
      availability: availabilityScore,
      equipment: equipmentScore,
      quality: qualityScore,
      reliability: reliabilityScore,
    },
    travel_estimate_minutes: travelEstimateMinutes,
    travel_estimate_source:
      travelEstimateMinutes === 15
        ? "heuristic_market"
        : travelEstimateMinutes === 45
          ? "heuristic_region"
          : "unknown",
  };
}

async function lookupCalendarEventIdForBlueprint(blueprintId: string | null | undefined) {
  if (!blueprintId) {
    return null;
  }

  const snapshot = await getDb()
    .collection("action_ledger")
    .where("lane", "==", "post_signup")
    .where("action_type", "==", "create_calendar_event")
    .where("source_collection", "==", "blueprints")
    .where("source_doc_id", "==", blueprintId)
    .where("status", "==", "sent")
    .limit(10)
    .get();

  const match = snapshot.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .find((record) => typeof record.provider_reference === "string");

  return typeof match?.provider_reference === "string" ? match.provider_reference : null;
}

function createInternalRoutingDraft(
  recommendation: string,
  requiresHumanReview = false,
): DraftOutput {
  return {
    recommendation,
    confidence: requiresHumanReview ? 0.5 : 0.95,
    requires_human_review: requiresHumanReview,
    automation_status: requiresHumanReview ? "blocked" : "completed",
  };
}

function formatScheduleLabel(date?: string | null, time?: string | null) {
  return [date, time].filter(Boolean).join(" at ") || "the scheduled window";
}

function buildCapturerCommunication(params: {
  communicationType: string;
  contactName: string | null;
  siteName: string;
  address: string;
  scheduledFor: string | null;
  notes?: string | null;
}) {
  const greeting = params.contactName ? `Hi ${params.contactName},` : "Hi,";
  const siteLabel = params.siteName || "the scheduled site";
  const scheduledFor = params.scheduledFor || "the scheduled window";
  const notesBlock = params.notes ? `\n\nNotes: ${params.notes}` : "";

  switch (params.communicationType) {
    case "confirmation":
      return {
        subject: `Blueprint capture confirmed for ${siteLabel}`,
        body:
          `${greeting}\n\n` +
          `You are confirmed to capture ${siteLabel} at ${params.address} during ${scheduledFor}. ` +
          "Please arrive ready to capture the agreed areas, follow site restrictions, and reply to ops if anything looks off." +
          notesBlock,
      };
    case "reminder_48h":
      return {
        subject: `Reminder: Blueprint capture in 48 hours for ${siteLabel}`,
        body:
          `${greeting}\n\n` +
          `This is a reminder that your Blueprint capture for ${siteLabel} is coming up in 48 hours (${scheduledFor}). ` +
          "Please confirm you still have access, your capture device is ready, and no site restrictions have changed." +
          notesBlock,
      };
    case "reminder_24h":
      return {
        subject: `Reminder: Blueprint capture tomorrow for ${siteLabel}`,
        body:
          `${greeting}\n\n` +
          `Your Blueprint capture for ${siteLabel} is scheduled for ${scheduledFor}. ` +
          `If access, timing, or device readiness changed, tell ops before you travel.${notesBlock}`,
      };
    case "reschedule_notice":
      return {
        subject: `Blueprint capture timing update for ${siteLabel}`,
        body:
          `${greeting}\n\n` +
          `The capture schedule for ${siteLabel} has changed. ` +
          `Ops will confirm the updated timing separately before any travel.${notesBlock}`,
      };
    default:
      return {
        subject: `Blueprint update for ${siteLabel}`,
        body:
          `${greeting}\n\n` +
          `Ops has an update for ${siteLabel}. Please review the note below and reply if you need clarification.${notesBlock}`,
      };
  }
}

function buildSiteAccessEmail(params: {
  operatorName: string | null;
  siteName: string;
  address: string;
  notes?: string | null;
}) {
  const greeting = params.operatorName ? `Hi ${params.operatorName},` : "Hi,";
  const notesBlock = params.notes ? `\n\nNotes: ${params.notes}` : "";

  return {
    subject: `Blueprint access request for ${params.siteName}`,
    body:
      `${greeting}\n\n` +
      `Blueprint is coordinating a site capture for ${params.siteName} at ${params.address}. ` +
      "We are requesting permission to access the site for capture and to document any restrictions, privacy rules, or excluded zones before work begins. " +
      "Please reply with the correct access contact, allowed timing windows, and any site-specific rules we must follow." +
      notesBlock,
  };
}

function nextReminderState(communicationType: string, captureAt: string | null) {
  if (!captureAt) {
    return {
      status: "unscheduled",
      next_type: null,
      next_due_at: null,
    };
  }

  if (communicationType === "confirmation") {
    const due48h = addHours(captureAt, -48);
    const due24h = addHours(captureAt, -24);
    if (due48h && due48h > new Date().toISOString()) {
      return {
        status: "pending",
        next_type: "reminder_48h",
        next_due_at: due48h,
      };
    }
    if (due24h && due24h > new Date().toISOString()) {
      return {
        status: "pending",
        next_type: "reminder_24h",
        next_due_at: due24h,
      };
    }
  }

  if (communicationType === "reminder_48h") {
    return {
      status: "pending",
      next_type: "reminder_24h",
      next_due_at: addHours(captureAt, -24),
    };
  }

  return {
    status: "complete",
    next_type: null,
    next_due_at: null,
  };
}

export async function sendCapturerCommunication(params: {
  captureJobId: string;
  communicationType: "confirmation" | "reminder_48h" | "reminder_24h" | "reschedule_notice" | "custom";
  creatorId?: string | null;
  subject?: string | null;
  body?: string | null;
  notes?: string | null;
  triggeredBy?: string | null;
}) {
  const captureJobRef = getDb().collection("capture_jobs").doc(params.captureJobId);
  const captureJobDoc = await captureJobRef.get();
  if (!captureJobDoc.exists) {
    throw new Error("Capture job not found");
  }

  const captureJob = (captureJobDoc.data() || {}) as CaptureJobRecord;
  const fieldOps = asRecord(captureJob.field_ops);
  const existingAssignment = asRecord(fieldOps.capturer_assignment);
  const creatorId =
    params.creatorId
    || (typeof existingAssignment.creator_id === "string" ? existingAssignment.creator_id : null);
  const creator = await loadCreatorUser(creatorId);
  const contactName = creator?.name || null;
  const contactEmail = creator?.email || (typeof existingAssignment.email === "string" ? existingAssignment.email : null);

  const scheduledFor = buildCaptureWindowStart(captureJob);
  const communication = params.communicationType === "custom" && params.subject && params.body
    ? { subject: params.subject, body: params.body }
    : buildCapturerCommunication({
        communicationType: params.communicationType,
        contactName,
        siteName: typeof captureJob.title === "string" ? captureJob.title : "Blueprint capture",
        address: typeof captureJob.address === "string" ? captureJob.address : "the scheduled site",
        scheduledFor,
        notes: params.notes,
      });

  const requiresHumanReview =
    params.communicationType === "custom"
    || params.communicationType === "reschedule_notice"
    || !contactEmail;
  const draftOutput = createInternalRoutingDraft(params.communicationType, requiresHumanReview);

  const result = contactEmail
    ? await executeAction({
        sourceCollection: "capture_jobs",
        sourceDocId: params.captureJobId,
        actionType: "send_email",
        actionPayload: {
          type: "send_email",
          to: contactEmail,
          subject: communication.subject,
          body: communication.body,
        },
        safetyPolicy: CAPTURER_COMMS_POLICY,
        draftOutput,
        idempotencyKey: `capturer_comm:${params.captureJobId}:${params.communicationType}:${contactEmail}`,
      })
    : {
        state: "pending_approval" as const,
        tier: 3 as const,
        ledgerDocId: "",
        error: "Missing capturer email",
      };

  const reminderState = nextReminderState(params.communicationType, scheduledFor);

  await captureJobRef.set(
    {
      field_ops: {
        ...fieldOps,
        capturer_assignment: {
          ...existingAssignment,
          creator_id: creator?.uid || creatorId || null,
          name: contactName,
          email: contactEmail,
        },
        last_communication: {
          type: params.communicationType,
          state: result.state,
          ledger_doc_id: result.ledgerDocId || null,
          triggered_by: params.triggeredBy || null,
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        reminders: reminderState,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return result;
}

export async function runCapturerReminderLoop(params?: { limit?: number }) {
  const snapshot = await getDb()
    .collection("capture_jobs")
    .where("field_ops.reminders.status", "==", "pending")
    .limit(Math.max(1, Math.min(params?.limit ?? 10, 25)))
    .get();

  let processedCount = 0;
  let failedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as CaptureJobRecord;
    const reminders = asRecord(asRecord(data.field_ops).reminders);
    const nextType =
      typeof reminders.next_type === "string" ? reminders.next_type : null;
    const nextDueAt =
      typeof reminders.next_due_at === "string" ? reminders.next_due_at : null;

    if (!nextType || !nextDueAt || nextDueAt > new Date().toISOString()) {
      continue;
    }

    try {
      await sendCapturerCommunication({
        captureJobId: doc.id,
        communicationType: nextType as "reminder_48h" | "reminder_24h",
        triggeredBy: "system:auto",
      });
      processedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { ok: true, processedCount, failedCount };
}

export async function listFieldOpsCaptureJobs(params?: {
  limit?: number;
  status?: string | null;
}) {
  let query: FirebaseFirestore.Query = getDb().collection("capture_jobs");
  if (params?.status) {
    query = query.where("status", "==", params.status);
  }

  const snapshot = await query.limit(Math.max(1, Math.min(params?.limit ?? 25, 100))).get();

  return snapshot.docs.map((doc) => {
    const data = (doc.data() || {}) as CaptureJobRecord;
    return {
      id: doc.id,
      title: typeof data.title === "string" ? data.title : "",
      address: typeof data.address === "string" ? data.address : "",
      status: typeof data.status === "string" ? data.status : "",
      buyer_request_id:
        typeof data.buyer_request_id === "string" ? data.buyer_request_id : null,
      marketplace_state:
        typeof data.marketplace_state === "string" ? data.marketplace_state : null,
      rights_status: typeof data.rights_status === "string" ? data.rights_status : null,
      capture_policy_tier:
        typeof data.capture_policy_tier === "string" ? data.capture_policy_tier : null,
      field_ops: asRecord(data.field_ops),
      site_access: asRecord(data.site_access),
      updated_at: toIsoString((data as Record<string, unknown>).updatedAt || data.updated_at),
    };
  });
}

export async function listCapturerCandidates(captureJobId: string) {
  const captureJobDoc = await getDb().collection("capture_jobs").doc(captureJobId).get();
  if (!captureJobDoc.exists) {
    throw new Error("Capture job not found");
  }

  const captureJob = (captureJobDoc.data() || {}) as CaptureJobRecord;
  const snapshot = await getDb()
    .collection("users")
    .where("role", "==", "capturer")
    .limit(100)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = (doc.data() || {}) as Record<string, unknown>;
      return scoreCapturerCandidate(
        {
          uid: doc.id,
          name: typeof data.name === "string" ? data.name : null,
          email: typeof data.email === "string" ? data.email : null,
          phone_number: typeof data.phone_number === "string" ? data.phone_number : null,
          capturerMarket:
            typeof data.capturerMarket === "string"
              ? data.capturerMarket
              : typeof data.mostFrequentLocation === "string"
                ? data.mostFrequentLocation
                : null,
          capturerAvailability:
            typeof data.capturerAvailability === "string" ? data.capturerAvailability : null,
          capturerEquipment: Array.isArray(data.capturerEquipment)
            ? data.capturerEquipment.filter((entry): entry is string => typeof entry === "string")
            : [],
          stats: asRecord(data.stats),
        },
        captureJob,
      );
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}

export async function assignCapturerToCaptureJob(params: {
  captureJobId: string;
  creatorId: string;
  sendConfirmation?: boolean;
  notes?: string | null;
  assignedBy?: string | null;
}) {
  const [captureJobDoc, candidates] = await Promise.all([
    getDb().collection("capture_jobs").doc(params.captureJobId).get(),
    listCapturerCandidates(params.captureJobId),
  ]);

  if (!captureJobDoc.exists) {
    throw new Error("Capture job not found");
  }

  const match = candidates.find((candidate) => candidate.uid === params.creatorId);
  if (!match) {
    throw new Error("Capturer candidate not found");
  }

  const captureJob = (captureJobDoc.data() || {}) as CaptureJobRecord;
  const fieldOps = asRecord(captureJob.field_ops);

  await captureJobDoc.ref.set(
    {
      status: typeof captureJob.status === "string" && captureJob.status ? captureJob.status : "scheduled",
      field_ops: {
        ...fieldOps,
        capturer_assignment: {
          creator_id: match.uid,
          name: match.name,
          email: match.email,
          phone_number: match.phone_number,
          score: match.score,
          score_breakdown: match.score_breakdown,
          travel_estimate_minutes: match.travel_estimate_minutes,
          travel_estimate_source: match.travel_estimate_source,
          availability: match.availability,
          equipment: match.equipment,
          assigned_at: admin.firestore.FieldValue.serverTimestamp(),
          assigned_by: params.assignedBy || null,
          notes: params.notes || null,
        },
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (params.sendConfirmation) {
    await sendCapturerCommunication({
      captureJobId: params.captureJobId,
      communicationType: "confirmation",
      creatorId: params.creatorId,
      notes: params.notes,
      triggeredBy: params.assignedBy || null,
    });
  }

  return { ok: true, candidate: match };
}

export async function discoverSiteAccessContacts(captureJobId: string) {
  const captureJobDoc = await getDb().collection("capture_jobs").doc(captureJobId).get();
  if (!captureJobDoc.exists) {
    throw new Error("Capture job not found");
  }

  const captureJob = (captureJobDoc.data() || {}) as CaptureJobRecord;
  const suggestions: SiteAccessContactSuggestion[] = [];
  const seen = new Set<string>();

  const siteAccess = asRecord(captureJob.site_access);
  const operatorContact = asRecord(siteAccess.operator_contact);
  if (typeof operatorContact.email === "string" && operatorContact.email.trim()) {
    seen.add(operatorContact.email.toLowerCase());
    suggestions.push({
      email: operatorContact.email,
      name: typeof operatorContact.name === "string" ? operatorContact.name : null,
      source: "site_access",
      company: null,
      roleTitle: null,
    });
  }

  const inboundContact = await loadInboundContact(
    typeof captureJob.buyer_request_id === "string" ? captureJob.buyer_request_id : null,
  );
  if (inboundContact?.email && !seen.has(inboundContact.email.toLowerCase())) {
    seen.add(inboundContact.email.toLowerCase());
    suggestions.push({
      email: inboundContact.email,
      name: inboundContact.name,
      source: "inbound_request_contact",
      company: inboundContact.company,
      roleTitle: inboundContact.roleTitle,
    });
  }

  const bookings = inboundContact?.email ? await loadBookingsForEmail(inboundContact.email) : [];
  for (const booking of bookings) {
    const email = typeof booking.data.email === "string" ? booking.data.email : null;
    if (email && !seen.has(email.toLowerCase())) {
      seen.add(email.toLowerCase());
      suggestions.push({
        email,
        name: typeof booking.data.contactName === "string" ? booking.data.contactName : null,
        source: "booking_contact",
        company: typeof booking.data.businessName === "string" ? booking.data.businessName : null,
        roleTitle: null,
      });
    }

    const blueprint = await loadBlueprint(
      typeof booking.data.blueprintId === "string" ? booking.data.blueprintId : null,
    );
    const blueprintEmail = typeof blueprint?.email === "string" ? blueprint.email : null;
    if (blueprintEmail && !seen.has(blueprintEmail.toLowerCase())) {
      seen.add(blueprintEmail.toLowerCase());
      suggestions.push({
        email: blueprintEmail,
        name: typeof blueprint?.name === "string" ? blueprint.name : null,
        source: "blueprint_contact",
        company:
          typeof blueprint?.businessName === "string" ? blueprint.businessName : null,
        roleTitle: null,
      });
    }
  }

  return suggestions;
}

export async function listRescheduleQueue(params?: { limit?: number }) {
  const snapshot = await getDb()
    .collection("bookings")
    .limit(Math.max(1, Math.min(params?.limit ?? 50, 100)))
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = (doc.data() || {}) as BookingRecord;
      const rescheduleRequest = asRecord(data.reschedule_request);
      if (!Object.keys(rescheduleRequest).length) {
        return null;
      }
      return {
        id: doc.id,
        businessName: typeof data.businessName === "string" ? data.businessName : "",
        email: typeof data.email === "string" ? data.email : "",
        current_date: typeof data.date === "string" ? data.date : null,
        current_time: typeof data.time === "string" ? data.time : null,
        requested_date:
          typeof rescheduleRequest.requested_date === "string"
            ? rescheduleRequest.requested_date
            : null,
        requested_time:
          typeof rescheduleRequest.requested_time === "string"
            ? rescheduleRequest.requested_time
            : null,
        requested_by:
          typeof rescheduleRequest.requested_by === "string"
            ? rescheduleRequest.requested_by
            : null,
        status:
          typeof rescheduleRequest.status === "string"
            ? rescheduleRequest.status
            : "pending_approval",
        reason:
          typeof rescheduleRequest.reason === "string" ? rescheduleRequest.reason : null,
      };
    })
    .filter(Boolean);
}

export async function listFinanceQueue(params?: { limit?: number }) {
  const snapshot = await getDb()
    .collection("creatorPayouts")
    .limit(Math.max(1, Math.min(params?.limit ?? 50, 100)))
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = (doc.data() || {}) as Record<string, unknown>;
      const opsAutomation = asRecord(data.ops_automation);
      const financeReview = asRecord(data.finance_review);
      const status = typeof data.status === "string" ? data.status : "";
      if (
        !["review_required", "disbursement_failed", "canceled"].includes(status)
        && typeof opsAutomation.status !== "string"
      ) {
        return null;
      }
      const record: FinanceQueueRecord = {
        id: doc.id,
        status,
        creator_id: typeof data.creator_id === "string" ? data.creator_id : null,
        capture_id: typeof data.capture_id === "string" ? data.capture_id : null,
        stripe_payout_id:
          typeof data.stripe_payout_id === "string" ? data.stripe_payout_id : null,
        failure_reason:
          typeof data.failure_reason === "string" ? data.failure_reason : null,
        queue: typeof opsAutomation.queue === "string" ? opsAutomation.queue : null,
        ops_automation: opsAutomation,
        finance_review: financeReview,
        updated_at: toIsoString((data as Record<string, unknown>).updated_at || data.updatedAt),
      };
      return record;
    })
    .filter((item): item is FinanceQueueRecord => Boolean(item));
}

export async function updateFinanceReview(params: {
  payoutId: string;
  reviewStatus:
    | "pending_human_review"
    | "investigating"
    | "ready_for_manual_action"
    | "waiting_on_creator"
    | "resolved";
  nextAction: string;
  notes?: string | null;
  responseDraft?: string | null;
  updatedBy?: string | null;
}) {
  await getDb().collection("creatorPayouts").doc(params.payoutId).set(
    {
      finance_review: {
        review_status: params.reviewStatus,
        next_action: params.nextAction,
        notes: params.notes || null,
        response_draft: params.responseDraft || null,
        updated_by: params.updatedBy || null,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true };
}

export async function processSimpleReschedule(params: {
  bookingId: string;
  requestedDate: string;
  requestedTime: string;
  requestedBy?: "buyer" | "operator" | "capturer";
  reason?: string | null;
  triggeredBy?: string | null;
}) {
  const bookingRef = getDb().collection("bookings").doc(params.bookingId);
  const bookingDoc = await bookingRef.get();
  if (!bookingDoc.exists) {
    throw new Error("Booking not found");
  }

  const booking = (bookingDoc.data() || {}) as BookingRecord;
  const sameDay = booking.date === params.requestedDate && booking.time !== params.requestedTime;
  const requestedBy = params.requestedBy || "buyer";
  const blueprintId =
    typeof booking.blueprintId === "string" ? booking.blueprintId : null;
  const eventId = await lookupCalendarEventIdForBlueprint(blueprintId);
  const requiresHumanReview = !sameDay || requestedBy === "capturer" || !eventId;
  const recommendation = sameDay ? "same_day_time_change" : "date_change";
  const draftOutput = createInternalRoutingDraft(recommendation, requiresHumanReview);

  await bookingRef.set(
    {
      reschedule_request: {
        status: requiresHumanReview ? "pending_approval" : "executing",
        current_date: booking.date || null,
        current_time: booking.time || null,
        requested_date: params.requestedDate,
        requested_time: params.requestedTime,
        requested_by: requestedBy,
        reason: params.reason || null,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (requiresHumanReview || !eventId) {
    return {
      state: "pending_approval" as const,
      tier: 3 as const,
      ledgerDocId: "",
      error: !eventId ? "Missing calendar event reference" : "Manual review required",
    };
  }

  const calendarResult = await executeAction({
    sourceCollection: "bookings",
    sourceDocId: params.bookingId,
    actionType: "update_calendar_event",
    actionPayload: {
      type: "update_calendar_event",
      eventId,
      date: params.requestedDate,
      time: params.requestedTime,
      address: typeof booking.address === "string" ? booking.address : "",
      title: typeof booking.businessName === "string"
        ? `Blueprint mapping session for ${booking.businessName}`
        : "Blueprint mapping session",
      description:
        typeof booking.businessName === "string"
          ? `Updated mapping session for ${booking.businessName}.`
          : "Updated Blueprint mapping session.",
      contactEmail: typeof booking.email === "string" ? booking.email : null,
    },
    safetyPolicy: RESCHEDULE_POLICY,
    draftOutput,
    idempotencyKey: `reschedule:${params.bookingId}:${booking.date}:${booking.time}:${params.requestedDate}:${params.requestedTime}`,
  });

  if (calendarResult.state === "sent") {
    await bookingRef.set(
      {
        date: params.requestedDate,
        time: params.requestedTime,
        reschedule_request: {
          status: "sent",
          last_action_state: calendarResult.state,
          ledger_doc_id: calendarResult.ledgerDocId,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (booking.email) {
      await executeAction({
        sourceCollection: "bookings",
        sourceDocId: params.bookingId,
        actionType: "send_email",
        actionPayload: {
          type: "send_email",
          to: booking.email,
          subject: `Blueprint mapping rescheduled for ${booking.businessName || "your site"}`,
          body:
            `Hi ${booking.contactName || ""},\n\n` +
            `Your Blueprint mapping session has been moved to ${formatScheduleLabel(
              params.requestedDate,
              params.requestedTime,
            )}. If this no longer works, reply to ops before the appointment.`,
        },
        safetyPolicy: RESCHEDULE_POLICY,
        draftOutput,
        idempotencyKey: `reschedule_email:${params.bookingId}:${params.requestedDate}:${params.requestedTime}`,
      });
    }
  }

  return calendarResult;
}

export async function sendSiteAccessOutreach(params: {
  captureJobId: string;
  operatorEmail: string;
  operatorName?: string | null;
  notes?: string | null;
  triggeredBy?: string | null;
}) {
  const captureJobRef = getDb().collection("capture_jobs").doc(params.captureJobId);
  const captureJobDoc = await captureJobRef.get();
  if (!captureJobDoc.exists) {
    throw new Error("Capture job not found");
  }

  const captureJob = (captureJobDoc.data() || {}) as CaptureJobRecord;
  const communication = buildSiteAccessEmail({
    operatorName: params.operatorName || null,
    siteName: typeof captureJob.title === "string" ? captureJob.title : "the requested site",
    address: typeof captureJob.address === "string" ? captureJob.address : "the requested address",
    notes: params.notes,
  });

  const result = await executeAction({
    sourceCollection: "capture_jobs",
    sourceDocId: params.captureJobId,
    actionType: "send_email",
    actionPayload: {
      type: "send_email",
      to: params.operatorEmail,
      subject: communication.subject,
      body: communication.body,
    },
    safetyPolicy: SITE_ACCESS_POLICY,
    draftOutput: createInternalRoutingDraft("initial_outreach", false),
    idempotencyKey: `site_access:${params.captureJobId}:${params.operatorEmail}:initial_outreach`,
  });

  await captureJobRef.set(
    {
      site_access: {
        permission_state: result.state === "sent" ? "awaiting_response" : result.state,
        operator_contact: {
          name: params.operatorName || null,
          email: params.operatorEmail,
        },
        last_action_state: result.state,
        ledger_doc_id: result.ledgerDocId,
        last_outreach_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: params.triggeredBy || null,
        notes: params.notes || null,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return result;
}

export async function updateSiteAccessStatus(params: {
  captureJobId: string;
  status: "not_started" | "awaiting_response" | "granted" | "denied" | "conditional" | "review_required";
  notes?: string | null;
  operatorName?: string | null;
  operatorEmail?: string | null;
  updatedBy?: string | null;
}) {
  await getDb().collection("capture_jobs").doc(params.captureJobId).set(
    {
      site_access: {
        permission_state: params.status,
        operator_contact: {
          name: params.operatorName || null,
          email: params.operatorEmail || null,
        },
        notes: params.notes || null,
        updated_by: params.updatedBy || null,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true };
}

export { updateGoogleCalendarEvent };
