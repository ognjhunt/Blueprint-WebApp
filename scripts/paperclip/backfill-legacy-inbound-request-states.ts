import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

type LegacyRequestRecord = {
  growth_wedge?: string | null;
  priority?: string | null;
  qualification_state?: string | null;
  opportunity_state?: string | null;
  queue_key?: string | null;
  status?: string | null;
};

type BackfillRecord = {
  id: string;
  data: LegacyRequestRecord;
};

type BackfillPlanEntry = {
  id: string;
  priority: string;
  growthWedge: string | null;
  normalizedQualificationState: string;
  normalizedOpportunityState: string;
  normalizedQueueKey: string;
};

type CliOptions = {
  requestIds: string[];
  dryRun: boolean;
};

const LEGACY_NORMALIZED_STATUS = "submitted";
const LEGACY_NORMALIZED_OPPORTUNITY_STATE = "not_applicable";
const LEGACY_NORMALIZED_QUEUE_KEY = "inbound_request_review";

function normalizeArgList(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    requestIds: [],
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--request-ids":
        if (!next) {
          throw new Error("--request-ids requires a comma-separated value");
        }
        options.requestIds = normalizeArgList(next);
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function isLegacyMarker(value?: string | null) {
  if (value == null) {
    return true;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "" || normalized === "unknown";
}

function legacyStatusToQualificationState(status?: string | null): string {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "triaging":
      return "in_review";
    case "scheduled":
      return "capture_requested";
    case "qualified":
      return "qualified_ready";
    case "disqualified":
    case "closed":
      return "not_ready_yet";
    default:
      return LEGACY_NORMALIZED_STATUS;
  }
}

function normalizeOpportunityState(qualificationState: string): string {
  return qualificationState === "qualified_ready" || qualificationState === "qualified_risky"
    ? "handoff_ready"
    : LEGACY_NORMALIZED_OPPORTUNITY_STATE;
}

function normalizeQueueKey(qualificationState: string): string {
  return qualificationState === "qualified_ready" || qualificationState === "qualified_risky"
    ? "exact_site_hosted_review_queue"
    : LEGACY_NORMALIZED_QUEUE_KEY;
}

function needsLegacyBackfill(record: LegacyRequestRecord) {
  return isLegacyMarker(record.qualification_state) || isLegacyMarker(record.opportunity_state);
}

function planBackfillTargets(records: BackfillRecord[], requestIds: string[] = []) {
  const requestedIds = new Set(requestIds.map((id) => id.trim()).filter(Boolean));
  const missingIds = [...requestedIds].filter((id) => !records.some((record) => record.id === id));

  const matchingRecords = records.filter((record) => {
    if (requestedIds.size > 0 && !requestedIds.has(record.id)) {
      return false;
    }
    return needsLegacyBackfill(record.data);
  });

  const skippedIds = requestedIds.size > 0
    ? [...requestedIds].filter((id) => !matchingRecords.some((record) => record.id === id))
    : [];

  const targets: BackfillPlanEntry[] = matchingRecords.map((record) => {
    const qualificationState = legacyStatusToQualificationState(record.data.status);
    return {
      id: record.id,
      priority: String(record.data.priority || "normal").trim() || "normal",
      growthWedge: record.data.growth_wedge ? String(record.data.growth_wedge).trim() || null : null,
      normalizedQualificationState: qualificationState,
      normalizedOpportunityState: normalizeOpportunityState(qualificationState),
      normalizedQueueKey: normalizeQueueKey(qualificationState),
    };
  });

  return { targets, missingIds, skippedIds };
}

async function loadAllRecords() {
  if (!db) {
    throw new Error("Firebase Admin DB is not available");
  }

  const snapshot = await db.collection("inboundRequests").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as LegacyRequestRecord }));
}

async function loadRequestedRecords(requestIds: string[]) {
  if (!db) {
    throw new Error("Firebase Admin DB is not available");
  }

  const resolved = await Promise.all(
    requestIds.map(async (id) => {
      const snapshot = await db.collection("inboundRequests").doc(id).get();
      return snapshot.exists ? { id: snapshot.id, data: snapshot.data() as LegacyRequestRecord } : null;
    }),
  );

  return resolved.filter((entry): entry is BackfillRecord => Boolean(entry));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const records = options.requestIds.length > 0 ? await loadRequestedRecords(options.requestIds) : await loadAllRecords();
  const { targets, missingIds, skippedIds } = planBackfillTargets(records, options.requestIds);

  if (!db) {
    throw new Error("Firebase Admin DB is not available");
  }

  if (targets.length === 0) {
    console.log(
      JSON.stringify(
        {
          updated: 0,
          dryRun: options.dryRun,
          requestIds: options.requestIds,
          missingIds,
          skippedIds,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          updated: targets.length,
          dryRun: true,
          requestIds: options.requestIds,
          missingIds,
          skippedIds,
          targets,
        },
        null,
        2,
      ),
    );
    return;
  }

  const batch = db.batch();
  const statsRef = db.collection("stats").doc("inboundRequests");
  const statsIncrementPayload: Record<string, unknown> = {
    total: admin.firestore.FieldValue.increment(targets.length),
    [`byStatus.${LEGACY_NORMALIZED_STATUS}`]: admin.firestore.FieldValue.increment(targets.length),
    [`byQueue.${LEGACY_NORMALIZED_QUEUE_KEY}`]: admin.firestore.FieldValue.increment(targets.length),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const priorityIncrements = new Map<string, number>();
  const wedgeIncrements = new Map<string, number>();

  for (const target of targets) {
    const record = records.find((entry) => entry.id === target.id);
    if (!record) {
      continue;
    }

    priorityIncrements.set(target.priority, (priorityIncrements.get(target.priority) || 0) + 1);

    if (target.growthWedge) {
      wedgeIncrements.set(target.growthWedge, (wedgeIncrements.get(target.growthWedge) || 0) + 1);
    }

    batch.update(db.collection("inboundRequests").doc(target.id), {
      status: LEGACY_NORMALIZED_STATUS,
      qualification_state: target.normalizedQualificationState,
      opportunity_state: target.normalizedOpportunityState,
      queue_key: target.normalizedQueueKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  for (const [priority, count] of priorityIncrements.entries()) {
    statsIncrementPayload[`byPriority.${priority}`] = admin.firestore.FieldValue.increment(count);
  }
  for (const [wedge, count] of wedgeIncrements.entries()) {
    statsIncrementPayload[`byWedge.${wedge}`] = admin.firestore.FieldValue.increment(count);
  }

  batch.set(statsRef, statsIncrementPayload, { merge: true });

  await batch.commit();

  console.log(
    JSON.stringify(
      {
        updated: targets.length,
        dryRun: false,
        requestIds: options.requestIds,
        missingIds,
        skippedIds,
        legacyIds: targets.map((entry) => entry.id),
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}

export {
  legacyStatusToQualificationState,
  normalizeArgList,
  normalizeOpportunityState,
  normalizeQueueKey,
  needsLegacyBackfill,
  parseArgs,
  planBackfillTargets,
};
