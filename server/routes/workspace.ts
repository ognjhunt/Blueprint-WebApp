import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import {
  buildLegalAcceptanceRecord,
  TERMS_VERSION,
  PRIVACY_VERSION,
} from "../../client/src/lib/legalAcceptance";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  decryptInboundRequestForAdmin,
  encryptFieldValue,
  decryptFieldValue,
} from "../utils/field-encryption";
import { submitInboundRequest } from "./inbound-request";
import { projectPilotOpportunityForRobotTeam } from "../utils/pilot-opportunity-projection";
import { sendCapturerCommunication } from "../utils/field-ops-automation";
import {
  object,
  text,
  iso,
  termsFor,
  projectWorkspaceTask,
  projectWorkspaceResult,
  teamAlias,
} from "../utils/workspace-projection";
import { getBrief } from "../utils/siteTaskBrief";
import { assessReadiness } from "../../client/src/lib/siteTaskReadiness";
import { projectTaskStatus, taskStatusInputFrom } from "../utils/taskStatusProjection";
import type {
  InboundRequestStored,
  InboundRequest,
} from "../types/inbound-request";
import type {
  RobotSetup,
  WorkspaceEvaluation,
  WorkspaceTask,
} from "../../client/src/types/workspace";

const router = Router();
const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const short = z.string().trim().min(1).max(160);
const prose = z.string().trim().max(3000);
const amount = z.number().finite().min(0).max(1e9).nullable();
const termsSchema = z
  .object({
    successRate: z.number().finite().min(0).max(100).nullable(),
    cycleTimeSeconds: z.number().finite().positive().max(86400).nullable(),
    pilotBudgetUsd: amount,
    deploymentBudgetUsd: amount,
    targetDate: z.string().datetime().nullable(),
    successDefinition: prose,
  })
  .strict();
const taskSchema = z
  .object({
    id,
    title: short,
    siteName: short,
    location: short,
    siteType: short,
    terms: termsSchema,
    visibility: z.enum(["private", "anonymized"]),
    notes: prose,
  })
  .strict();
const setupSchema = z
  .object({
    id,
    name: short,
    embodiment: short,
    policyName: short,
    version: short,
    delivery: z.enum(["checkpoint", "container", "endpoint"]),
    reference: z.string().trim().min(1).max(1000),
    notes: prose,
  })
  .strict()
  .superRefine((value, ctx) => {
    try {
      const url = new URL(value.reference);
      const protocols =
        value.delivery === "container"
          ? ["https:", "docker:", "oci:"]
          : ["https:"];
      if (
        !protocols.includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reference"],
        message:
          "Use a reference URL without credentials or query parameters. Keep secrets in the approved credential store.",
      });
    }
  });
const handle =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: error.issues.map((item) => item.message).join(" ") });
      const status = typeof error?.status === "number" ? error.status : 500;
      return res.status(status).json({
        error:
          status < 500
            ? error.message
            : "The workspace could not be updated. Please try again.",
        ...(status < 500 && typeof error?.code === "string"
          ? { code: error.code }
          : {}),
      });
    });
  };
function refuse(status: number, message: string, code?: string): never {
  throw Object.assign(new Error(message), { status, code });
}
function identity(res: Response) {
  return res.locals.workspaceIdentity as {
    uid: string;
    email: string;
    verified: boolean;
    role: "site_operator" | "robot_team";
    user: Record<string, any>;
  };
}
function requireRole(res: Response, role: "site_operator" | "robot_team") {
  if (identity(res).role !== role)
    refuse(
      403,
      `This action requires a ${role === "site_operator" ? "site" : "robot-team"} account.`,
    );
}

// Workspace setup is available to every authenticated account, including legacy
// operations/capture accounts. It only changes customer profile fields; existing
// roles, claims, rights, assignments and records are never inferred or replaced.
const accountSetupSchema = z
  .object({
    workspaceType: z.enum(["site_operator", "robot_team"]),
    name: short,
    organization: short,
    acceptedTerms: z.boolean().optional(),
  })
  .strict();
function currentTermsAccepted(user: Record<string, any>) {
  const accepted = object(user.termsAcceptance);
  return (
    (accepted.accepted_terms === true &&
      accepted.terms_version === TERMS_VERSION &&
      accepted.privacy_version === PRIVACY_VERSION) ||
    (user.acceptedTerms === true &&
      user.termsVersion === TERMS_VERSION &&
      user.privacyVersion === PRIVACY_VERSION)
  );
}
function accountProjection(
  user: Record<string, any>,
  auth: Record<string, any>,
) {
  const roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(auth.roles) ? auth.roles : []),
  ];
  return {
    workspaceType: ["site_operator", "robot_team"].includes(user.buyerType)
      ? user.buyerType
      : null,
    profile: {
      name: text(user.name || user.displayName || auth.name),
      organization: text(
        user.company || user.organizationName || user.organization,
      ),
      email: text(auth.email),
    },
    termsRequired: !currentTermsAccepted(user),
    access: {
      operations:
        auth.admin === true ||
        auth.ops === true ||
        user.admin === true ||
        user.ops === true ||
        ["admin", "ops"].includes(user.role) ||
        roles.some((role) => ["admin", "ops"].includes(role)),
      capture: user.role === "capturer" || roles.includes("capturer"),
    },
  };
}
router.use(
  handle(async (_req, res, next) => {
    const auth = object(res.locals.firebaseUser);
    if (!text(auth.uid)) refuse(401, "Sign in to continue.");
    if (!db) refuse(503, "Workspace storage is unavailable. Please try again.");
    const snapshot = await db!.collection("users").doc(auth.uid).get();
    res.locals.workspaceAccount = { auth, user: object(snapshot.data()) };
    next();
  }),
);
router.get(
  "/setup",
  handle(async (_req, res) => {
    const { user, auth } = res.locals.workspaceAccount;
    return res.json(accountProjection(user, auth));
  }),
);
router.post(
  "/setup",
  handle(async (req, res) => {
    const input = accountSetupSchema.parse(req.body);
    const { auth } = res.locals.workspaceAccount;
    const profileRef = db!.collection("users").doc(auth.uid);
    await db!.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef),
        user = object(snapshot.data());
      const needsTerms = !currentTermsAccepted(user);
      if (needsTerms && input.acceptedTerms !== true)
        refuse(
          400,
          "Accept the Terms and Privacy Policy to set up your workspace.",
          "workspace_terms_required",
        );
      const now = admin.firestore.FieldValue.serverTimestamp();
      const patch = {
        name: input.name,
        organizationName: input.organization,
        company: input.organization,
        buyerType: input.workspaceType,
        workspaceSetupCompletedAt: now,
        ...(!snapshot.exists
          ? { uid: auth.uid, email: text(auth.email), createdDate: now }
          : {}),
        ...(needsTerms
          ? {
              acceptedTerms: true,
              termsVersion: TERMS_VERSION,
              privacyVersion: PRIVACY_VERSION,
              termsAcceptance: buildLegalAcceptanceRecord({ acceptedAt: now }),
            }
          : {}),
      };
      if (snapshot.exists) transaction.update(profileRef, patch);
      else transaction.set(profileRef, patch);
    });
    return res.json({ ok: true, workspaceType: input.workspaceType });
  }),
);
router.use(
  handle(async (_req, res, next) => {
    const { user, auth } = res.locals.workspaceAccount;
    if (!["site_operator", "robot_team"].includes(user.buyerType))
      refuse(
        403,
        "Choose a workspace type to get started.",
        "workspace_setup_required",
      );
    res.locals.workspaceIdentity = {
      uid: auth.uid,
      email: text(auth.email).toLowerCase(),
      verified: auth.email_verified === true,
      role: user.buyerType,
      user,
    };
    next();
  }),
);

async function decodeWorkspaceRequest(value: InboundRequestStored) {
  const record = (await decryptInboundRequestForAdmin(
    value,
  )) as unknown as Record<string, any>;
  const workspace = object(record.workspace_task),
    pilot = object(workspace.pilot);
  if (pilot.notes)
    record.workspace_task = {
      ...workspace,
      pilot: { ...pilot, notes: await decryptFieldValue(pilot.notes) },
    };
  return record;
}
async function readRequest(requestId: string) {
  id.parse(requestId);
  const snap = await db!.collection("inboundRequests").doc(requestId).get();
  if (!snap.exists) refuse(404, "Task not found.");
  return {
    ref: snap.ref,
    revision: snap.updateTime
      ? `${snap.updateTime.seconds}:${snap.updateTime.nanoseconds}`
      : null,
    record: await decodeWorkspaceRequest(snap.data() as InboundRequestStored),
  };
}
async function ownedTask(requestId: string, res: Response) {
  requireRole(res, "site_operator");
  const item = await readRequest(requestId),
    caller = identity(res);
  const owner = text(item.record.account_owner_uid);
  const legacy =
    !owner &&
    caller.verified &&
    caller.user.structuredIntakeRequestId === requestId &&
    text(object(item.record.contact).email).toLowerCase() === caller.email;
  if (
    object(item.record.request).buyerType !== "site_operator" ||
    (owner !== caller.uid && !legacy)
  )
    refuse(404, "Task not found.");
  return item;
}
async function listOwnedRequests(res: Response) {
  const caller = identity(res);
  const snapshot = await db!
    .collection("inboundRequests")
    .where("account_owner_uid", "==", caller.uid)
    .limit(100)
    .get();
  const records = await Promise.all(
    snapshot.docs.map(async (doc) => ({
      id: doc.id,
      record: await decodeWorkspaceRequest(doc.data() as InboundRequestStored),
    })),
  );
  const legacyId = text(caller.user.structuredIntakeRequestId);
  if (
    caller.role === "site_operator" &&
    legacyId &&
    !records.some((item) => item.id === legacyId)
  ) {
    try {
      const item = await ownedTask(legacyId, res);
      records.push({ id: legacyId, record: item.record });
    } catch (error) {
      if ((error as any).status !== 404) throw error;
    }
  }
  return records.sort((a, b) =>
    (iso(b.record.createdAt) || "").localeCompare(
      iso(a.record.createdAt) || "",
    ),
  );
}
async function applicationResults(task: WorkspaceTask) {
  const applications = await db!
    .collection("inboundRequests")
    .where("workspace_evaluation.opportunityId", "==", task.id)
    .limit(100)
    .get();
  return Promise.all(
    applications.docs.map(async (doc) => {
      const application = object(doc.data());
      const runs = await db!
        .collection("robotEvalJobRequests")
        .where("site_submission_id", "==", doc.id)
        .limit(20)
        .get();
      const owned = runs.docs.filter(
        (run) =>
          text(run.data().buyer_user_id) ===
          text(application.account_owner_uid),
      );
      const latest = owned.sort((a, b) =>
        text(b.data().updated_at_iso).localeCompare(
          text(a.data().updated_at_iso),
        ),
      )[0];
      const snapshotTerms = object(
        object(application.workspace_evaluation).targetSnapshot,
      );
      const fixedTerms = {
        ...task.terms,
        successRate:
          typeof snapshotTerms.successRate === "number"
            ? snapshotTerms.successRate
            : null,
        cycleTimeSeconds:
          typeof snapshotTerms.cycleTimeSeconds === "number"
            ? snapshotTerms.cycleTimeSeconds
            : null,
      };
      const result = projectWorkspaceResult(
        doc.id,
        latest
          ? object(latest.data())
          : {
              status: "requested",
              buyer_user_id: application.account_owner_uid,
            },
        task.id,
        fixedTerms,
      );
      if (
        fixedTerms.successRate !== task.terms.successRate ||
        fixedTerms.cycleTimeSeconds !== task.terms.cycleTimeSeconds
      ) {
        result.targetsMet = null;
        result.status = "criteria_changed";
      }
      result.selected = task.pilot.selectedResultId === doc.id;
      return result;
    }),
  );
}
async function hydrateTask(requestId: string, record: Record<string, any>) {
  const task = projectWorkspaceTask(requestId, record);
  const jobs = await db!
    .collection("capture_jobs")
    .where("buyer_request_id", "==", requestId)
    .limit(20)
    .get();
  const job = jobs.docs.sort((a, b) =>
    (iso(b.data().updatedAt) || "").localeCompare(
      iso(a.data().updatedAt) || "",
    ),
  )[0];
  if (job) {
    const data = object(job.data()),
      assignment = object(object(data.field_ops).capturer_assignment),
      window = object(data.availability_window);
    task.capture = {
      id: job.id,
      status:
        object(object(data.field_ops).dispatch_review)
          .manual_confirmation_required === true && data.status !== "confirmed"
          ? "awaiting_confirmation"
          : text(data.status) || "requested",
      startsAt: iso(data.availabilityStartsAt || window.starts_at),
      endsAt: iso(window.ends_at),
      capturerName: text(assignment.name) || null,
      changeStatus:
        text(object(object(record.workspace_task).captureChange).status) ||
        null,
      canMessage: Boolean(assignment.creator_id),
    };
  }
  task.results = await applicationResults(task);
  if (
    task.results.some((result) => result.successRate !== null) &&
    !task.pilot.selectedResultId &&
    !task.archived
  )
    task.status = "Review results";

  // Where the task sits on the assessment ladder, from the same projection the
  // account-free capture page uses. Best-effort: a failure to read the brief is
  // a missing readiness line, not a failed task load.
  try {
    const brief = await getBrief(requestId);
    let stage: ReturnType<typeof assessReadiness>["stage"] | null = null;
    if (brief) {
      stage = assessReadiness({
        answers: (object(record.request).siteTaskGates as Record<string, string> | null) ?? {},
        captureMode: text(object(record.request).capture_mode) || null,
        briefDrafted: true,
        briefConfirmed: Boolean(record.site_task_brief_confirmed_at),
        evidence: {
          hasAny: true,
          hasVisual: Boolean(record.capture_coverage),
          explainsTask: true,
          coversScene: object(record.capture_coverage).covers_scene ?? false,
          missingCoverage: object(record.capture_coverage).missing_coverage ?? undefined,
        },
        reconstructed: false,
      }).stage;
    }
    task.readiness = projectTaskStatus(
      taskStatusInputFrom({
        site_task_brief_confirmed_at: record.site_task_brief_confirmed_at,
        capture_coverage: (record.capture_coverage as never) ?? null,
        site_task_next_update_iso: (record.site_task_next_update_iso as string | null) ?? null,
        briefDrafted: Boolean(brief),
        stage,
      }),
    );
  } catch {
    task.readiness = null;
  }

  return task;
}
async function listSetups(uid: string): Promise<RobotSetup[]> {
  const snapshot = await db!
    .collection("users")
    .doc(uid)
    .collection("robotSetups")
    .limit(50)
    .get();
  return Promise.all(
    snapshot.docs.map(async (doc) => ({
      ...JSON.parse(await decryptFieldValue(doc.data().payload)),
      id: doc.id,
    })),
  );
}
router.get(
  "/",
  handle(async (_req, res) => {
    const caller = identity(res),
      requests = await listOwnedRequests(res);
    const profile = {
      name: text(caller.user.name || caller.user.displayName),
      organization:
        text(
          caller.user.company ||
            caller.user.organizationName ||
            caller.user.organization,
        ) || text(caller.user.name),
      email: caller.email,
    };
    if (caller.role === "site_operator") {
      const tasks = await Promise.all(
        requests
          .filter(
            (item) => object(item.record.request).buyerType === "site_operator",
          )
          .map((item) => hydrateTask(item.id, item.record)),
      );
      return res.json({
        role: caller.role,
        profile,
        tasks,
        evaluations: [],
        setups: [],
      });
    }
    const runs = await db!
      .collection("robotEvalJobRequests")
      .where("buyer_user_id", "==", caller.uid)
      .limit(200)
      .get();
    const evaluations: WorkspaceEvaluation[] = [];
    for (const item of requests.filter(
      (item) => item.record.workspace_evaluation,
    )) {
      const application = object(item.record.workspace_evaluation);
      let task: WorkspaceTask | null = null;
      try {
        const source = await readRequest(text(application.opportunityId));
        task = projectWorkspaceTask(
          text(application.opportunityId),
          source.record,
        );
      } catch (error) {
        if ((error as any).status !== 404) throw error;
      }
      const matching = runs.docs
        .filter((run) => run.data().site_submission_id === item.id)
        .sort((a, b) =>
          text(b.data().updated_at_iso).localeCompare(
            text(a.data().updated_at_iso),
          ),
        );
      const run = matching[0];
      const snapshotTerms = object(application.targetSnapshot);
      const fixedTerms = {
        ...termsFor({}),
        successRate:
          typeof snapshotTerms.successRate === "number"
            ? snapshotTerms.successRate
            : null,
        cycleTimeSeconds:
          typeof snapshotTerms.cycleTimeSeconds === "number"
            ? snapshotTerms.cycleTimeSeconds
            : null,
      };
      const result = projectWorkspaceResult(
        item.id,
        run
          ? object(run.data())
          : { status: "requested", buyer_user_id: caller.uid },
        task?.id || item.id,
        fixedTerms,
      );
      const selected = task?.pilot.selectedResultId === item.id;
      const outcome = selected
        ? task?.pilot.state || "invited"
        : task?.pilot.selectedResultId
          ? "not_selected"
          : task?.archived
            ? "closed"
            : null;
      // Use the summary copied from the permissioned opportunity at submission,
      // never the source's confidential site identity or another applicant's data.
      evaluations.push({
        ...result,
        runId: run?.id || null,
        taskId: text(application.opportunityId),
        title: text(object(item.record.request).taskStatement),
        siteType: text(object(item.record.request).targetSiteType),
        location: null,
        setupName: text(application.setupName),
        terms: {
          successRate: fixedTerms.successRate,
          cycleTimeSeconds: fixedTerms.cycleTimeSeconds,
        },
        outcome,
        selected,
        archived: [
          "closed",
          "not_selected",
          "deployed",
          "pilot_complete",
        ].includes(outcome || ""),
        createdAt: iso(item.record.createdAt),
      });
    }
    for (const run of runs.docs.filter(
      (run) => !evaluations.some((item) => item.runId === run.id),
    )) {
      const data = object(run.data()),
        request = object(data.decision_request || data.jobRequest);
      evaluations.push({
        ...projectWorkspaceResult(run.id, data, run.id, termsFor({})),
        runId: run.id,
        taskId: null,
        title:
          text(request.decision_question) ||
          text(object(request.site_task).task_description) ||
          "Task evaluation",
        siteType: "",
        location: null,
        setupName: null,
        terms: { successRate: null, cycleTimeSeconds: null },
        outcome: null,
        archived: [
          "decision_available",
          "completed",
          "superseded",
          "decided",
          "abstained",
          "partially_decided",
          "cancelled",
          "failed",
        ].includes(text(data.status)),
        createdAt: iso(data.created_at_iso),
      });
    }
    return res.json({
      role: caller.role,
      profile,
      tasks: [],
      evaluations: evaluations.sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || ""),
      ),
      setups: await listSetups(caller.uid),
    });
  }),
);
router.get(
  "/tasks/:taskId",
  handle(async (req, res) => {
    const item = await ownedTask(req.params.taskId, res);
    return res.json(await hydrateTask(req.params.taskId, item.record));
  }),
);

function intakeIdentity(res: Response) {
  const caller = identity(res),
    fullName = text(caller.user.name || caller.user.displayName)
      .trim()
      .split(/\s+/);
  return {
    firstName: fullName[0] || "Account",
    lastName: fullName.slice(1).join(" ") || "Owner",
    company:
      text(
        caller.user.company ||
          caller.user.organizationName ||
          caller.user.organization,
      ) ||
      text(caller.user.name) ||
      "Account organization",
    email: caller.email,
    roleTitle: caller.role === "site_operator" ? "Site operator" : "Robot team",
    buyerType: caller.role,
    accountSignup: false,
    budgetBucket: "Undecided/Unsure",
    requestedLanes: [],
    context: { sourcePageUrl: "/app", utm: {} },
  };
}
router.post(
  "/tasks",
  handle(async (req, res) => {
    requireRole(res, "site_operator");
    const input = taskSchema.parse(req.body),
      caller = identity(res);
    if (!caller.verified)
      refuse(403, "Verify your email before requesting a task.");
    res.locals.workspaceIntake = {
      account_owner_uid: caller.uid,
      workspace_task: {
        terms: { ...input.terms, successDefinition: "" },
        archived: false,
        paused: false,
      },
    };
    req.body = {
      ...intakeIdentity(res),
      requestId: input.id,
      siteName: input.siteName,
      siteLocation: input.location,
      targetSiteType: input.siteType,
      taskStatement: input.title,
      taskDescription: input.terms.successDefinition,
      details: input.notes,
      operatingConstraints: `Success rate target: ${input.terms.successRate ?? "to be agreed"}%. Cycle time target: ${input.terms.cycleTimeSeconds ?? "to be agreed"} seconds. Pilot budget: ${input.terms.pilotBudgetUsd ?? "to be agreed"} USD. Deployment budget: ${input.terms.deploymentBudgetUsd ?? "to be agreed"} USD.`,
      pilotOpportunity: {
        requested: true,
        visibility: input.visibility,
        anonymizedSummary:
          input.visibility === "anonymized" ? input.title : null,
        dataUsePermissions: {
          evaluateExistingPolicy: "granted",
          siteSpecificAdaptation: "not_granted",
          retainImprovements: "not_granted",
          generalModelTraining: "not_granted",
        },
      },
    };
    return submitInboundRequest(req, res);
  }),
);
router.post(
  "/setups",
  handle(async (req, res) => {
    requireRole(res, "robot_team");
    const input = setupSchema.parse(req.body),
      caller = identity(res);
    const payload = { ...input, updatedAt: new Date().toISOString() };
    await db!
      .collection("users")
      .doc(caller.uid)
      .collection("robotSetups")
      .doc(input.id)
      .set({
        payload: await encryptFieldValue(JSON.stringify(payload)),
        updated_at: payload.updatedAt,
      });
    return res.json(payload);
  }),
);
router.delete(
  "/setups/:setupId",
  handle(async (req, res) => {
    requireRole(res, "robot_team");
    id.parse(req.params.setupId);
    await db!
      .collection("users")
      .doc(identity(res).uid)
      .collection("robotSetups")
      .doc(req.params.setupId)
      .delete();
    return res.json({ ok: true });
  }),
);
router.post(
  "/evaluations",
  handle(async (req, res) => {
    requireRole(res, "robot_team");
    const input = z
        .object({ id, opportunityId: id, setupId: id, notes: prose })
        .strict()
        .parse(req.body),
      caller = identity(res);
    if (!caller.verified)
      refuse(403, "Verify your email before requesting an evaluation.");
    const source = await readRequest(input.opportunityId);
    const opportunity = projectPilotOpportunityForRobotTeam(
      source.record as InboundRequest,
      caller.email,
    );
    if (
      !opportunity ||
      object(source.record.workspace_task).archived ||
      object(source.record.workspace_task).paused
    )
      refuse(404, "This opening is no longer accepting evaluations.");
    const setup = (await listSetups(caller.uid)).find(
      (item) => item.id === input.setupId,
    );
    if (!setup) refuse(400, "Choose a saved robot and policy.");
    res.locals.workspaceIntake = {
      account_owner_uid: caller.uid,
      workspace_evaluation: {
        opportunityId: input.opportunityId,
        setupId: input.setupId,
        targetSnapshot: {
          successRate: termsFor(source.record).successRate,
          cycleTimeSeconds: termsFor(source.record).cycleTimeSeconds,
        },
        setupName: `${setup.name} · ${setup.policyName} ${setup.version}`,
        submittedAt: new Date().toISOString(),
      },
    };
    req.body = {
      ...intakeIdentity(res),
      requestId: input.id,
      siteName: opportunity.site_name || "Private site",
      siteLocation: opportunity.site_location || "",
      targetSiteType: opportunity.site_type || "Site opening",
      taskStatement: opportunity.workflow,
      taskDescription: input.notes,
      proofPathPreference: "exact_site_required",
      existingStackReviewWorkflow: JSON.stringify(setup),
      details: `Evaluation request for opening ${input.opportunityId}. ${input.notes}`,
    };
    return submitInboundRequest(req, res);
  }),
);
router.patch(
  "/profile",
  handle(async (req, res) => {
    const input = z
      .object({ name: short, organization: short })
      .strict()
      .parse(req.body);
    await db!
      .collection("users")
      .doc(identity(res).uid)
      .update({ name: input.name, company: input.organization });
    return res.json({ ok: true });
  }),
);
router.post(
  "/tasks/:taskId/capture",
  handle(async (req, res) => {
    const item = await ownedTask(req.params.taskId, res);
    const input = z
      .object({
        action: z.enum(["request", "reschedule", "cancel", "message"]),
        startsAt: z.string().datetime().optional(),
        message: z.string().trim().min(1).max(2000),
      })
      .strict()
      .parse(req.body);
    if (
      input.action === "reschedule" &&
      (!input.startsAt || Date.parse(input.startsAt) <= Date.now())
    )
      refuse(400, "Choose a future date and time.");
    const task = await hydrateTask(req.params.taskId, item.record);
    if (task.archived) refuse(409, "This task is closed.");
    if (input.action === "message") {
      if (!task.capture?.canMessage)
        refuse(409, "A capturer has not been assigned yet.");
      const receipt = await sendCapturerCommunication({
        captureJobId: task.capture.id,
        communicationType: "custom",
        subject: `Site message: ${task.siteName}`,
        body: input.message,
        triggeredBy: identity(res).uid,
      });
      return res.json({
        ok: true,
        status: receipt.state,
        message:
          receipt.state === "sent"
            ? "Message sent."
            : "Message queued for capture coordination.",
      });
    }
    if (
      ["cancel", "reschedule"].includes(input.action) &&
      task.capture &&
      ["completed", "approved", "paid", "cancelled", "rejected"].includes(
        task.capture.status,
      )
    )
      refuse(409, "This visit has ended. Request another capture instead.");
    if (input.action !== "request" && !task.capture)
      refuse(409, "No capture visit is linked to this task.");
    await item.ref.update({
      "workspace_task.captureChange": {
        action: input.action,
        startsAt: input.startsAt || null,
        status: "pending_review",
        requestedBy: identity(res).uid,
        requestedAt: new Date().toISOString(),
      },
      "ops.next_step": `Site requested capture ${input.action}. Review the request notes.`,
    });
    await item.ref.collection("notes").add({
      content: await encryptFieldValue(
        `Capture ${input.action}: ${input.startsAt || ""}\n${input.message}`,
      ),
      authorUid: identity(res).uid,
      authorEmail: identity(res).email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      workspace_note: true,
    });
    return res.json({
      ok: true,
      status: "pending_review",
      message:
        input.action === "cancel"
          ? "Cancellation requested. Your visit remains scheduled until confirmed."
          : "Request saved. Capture coordination will confirm the visit details.",
    });
  }),
);
router.post(
  "/tasks/:taskId/pilot",
  handle(async (req, res) => {
    const item = await ownedTask(req.params.taskId, res);
    const input = z
      .object({
        action: z.enum(["invite", "start", "complete", "deploy", "close"]),
        resultId: id.nullable(),
        notes: z.string().trim().min(1).max(2000),
      })
      .strict()
      .parse(req.body);
    const task = await hydrateTask(req.params.taskId, item.record);
    const selected = task.results.find(
      (result) => result.id === input.resultId,
    );
    if (
      input.action === "invite" &&
      (!selected ||
        selected.targetsMet !== true ||
        selected.sampleCount === null ||
        selected.sampleCount <= 0)
    )
      refuse(
        409,
        "Choose a team whose recorded evaluation meets the current task targets before inviting a pilot.",
      );
    const transitions: Record<string, string> = {
      invite: "selected",
      start: "pilot",
      complete: "pilot_complete",
      deploy: "deployed",
      close: "closed",
    };
    const allowed: Record<string, string[]> = {
      invite: ["not_selected"],
      start: ["selected", "invited"],
      complete: ["pilot"],
      deploy: ["pilot_complete"],
      close: [
        "not_selected",
        "selected",
        "invited",
        "pilot",
        "pilot_complete",
        "deployed",
      ],
    };
    const encryptedNotes = await encryptFieldValue(input.notes);
    const auditNote = await encryptFieldValue(
      `Site decision: ${transitions[input.action]}. ${input.action === "invite" && selected ? `Application ${selected.id}; ${selected.teamAlias}; ${selected.successRate}% success; ${selected.cycleTimeSeconds ?? "unrecorded"} sec/cycle; ${selected.sampleCount} trials; ${selected.evidenceLabel}. ` : ""}${input.notes}`,
    );
    const noteRef = item.ref.collection("notes").doc();
    await db!.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(item.ref),
        data = object(snapshot.data()),
        state =
          text(object(object(data.workspace_task).pilot).state) ||
          "not_selected";
      if (
        !allowed[input.action].includes(state) ||
        object(data.workspace_task).archived ||
        (snapshot.updateTime
          ? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
          : null) !== item.revision
      )
        refuse(409, "This task changed. Refresh before making a decision.");
      const pilot = {
        state: transitions[input.action],
        selectedResultId:
          input.action === "invite"
            ? input.resultId
            : object(object(data.workspace_task).pilot).selectedResultId ||
              null,
        notes: encryptedNotes,
        recordedBy: identity(res).uid,
        recordedAt: new Date().toISOString(),
        source: "site_reported",
      };
      transaction.set(noteRef, {
        content: auditNote,
        authorUid: identity(res).uid,
        authorEmail: identity(res).email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        workspace_note: true,
      });
      transaction.update(item.ref, {
        "workspace_task.pilot": pilot,
        "workspace_task.archived": input.action === "close",
        "ops.next_step":
          input.action === "invite"
            ? "Site selected a pilot team. Coordinate the invitation and agree pilot terms."
            : `Site recorded ${pilot.state}. Review request notes.`,
      });
    });
    return res.json({
      ok: true,
      message:
        input.action === "invite"
          ? "Pilot team selected. Blueprint will coordinate the invitation and terms."
          : "Outcome recorded.",
    });
  }),
);
router.post(
  "/tasks/:taskId/edit-request",
  handle(async (req, res) => {
    const item = await ownedTask(req.params.taskId, res);
    const input = z
      .object({ message: z.string().trim().min(1).max(3000) })
      .strict()
      .parse(req.body);
    if (object(item.record.workspace_task).archived)
      refuse(409, "This task is closed.");
    await item.ref.collection("notes").add({
      content: await encryptFieldValue(`Task edit requested: ${input.message}`),
      authorUid: identity(res).uid,
      authorEmail: identity(res).email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      workspace_note: true,
    });
    await item.ref.update({
      "ops.next_step":
        "Site requested a task edit. Review request notes before changing the frozen task criteria.",
    });
    return res.json({
      ok: true,
      message:
        "Edit requested. Current task criteria remain in effect until the change is reviewed.",
    });
  }),
);
export default router;
