/**
 * Register a policy checkpoint from the signed-in robot-team workspace.
 *
 * The agent-key API (`POST /api/agent-team/checkpoints`) stays the route for
 * agents. This is the same registration for a person: an approved robot-team
 * account picks one of its saved setups, and the checkpoint is registered
 * with exactly that setup's reference. Free-evaluation admission requires
 * `checkpoint.reference === setup.reference`, so taking the reference from the
 * stored setup, never from the request body, is what makes the two match.
 *
 * Registration authorizes nothing: no compute, no evaluation. Blueprint admits
 * each free evaluation by hand.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { resolveAccessContext } from "../utils/access-control";
import { accountHasAdmission } from "../utils/accountInvitations";
import { decryptFieldValue } from "../utils/field-encryption";
import { listCheckpoints, registerCheckpoint, type RobotCheckpoint } from "../utils/robotCheckpoints";
import { bindTeamToAccount, teamsForAccount } from "../utils/robotTeamAccounts";
import { registerSelfServeTeam } from "../utils/robotTeamRegistry";

const router = Router();

/**
 * Runtimes a saved setup reference can name. A model artifact needs the
 * server-owned upload record, and a skill trace is JSON rather than a URL, so
 * neither can match a setup reference and both stay on the agent API.
 */
export const WORKSPACE_CHECKPOINT_RUNTIMES = [
  "policy_endpoint", "customer_hosted", "container_image", "controller_adapter",
] as const;

const id = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const registrationSchema = z.object({
  teamId: z.string().trim().min(1).max(200).optional(),
  setupId: id,
  label: z.string().trim().min(1).max(120),
  runtime: z.enum(WORKSPACE_CHECKPOINT_RUNTIMES),
}).strict();

type Caller = { uid: string; email: string; verified: boolean; user: Record<string, any> };

/** Same gate as the robot-team workspace: a set-up, Blueprint-approved robot-team account. */
async function requireRobotTeamAccount(res: Response): Promise<Caller | null> {
  const auth = res.locals.firebaseUser as Record<string, any> | undefined;
  const uid = typeof auth?.uid === "string" ? auth.uid : "";
  if (!uid) { res.status(401).json({ error: "Sign in to continue." }); return null; }
  if (!db) { res.status(503).json({ error: "Workspace storage is unavailable. Please try again." }); return null; }
  const user = (await db.collection("users").doc(uid).get()).data() ?? {};
  if (user.buyerType !== "robot_team") {
    res.status(403).json({ error: "This action requires a robot-team account.", code: "robot_team_required" });
    return null;
  }
  const email = typeof auth?.email === "string" ? auth.email.trim().toLowerCase() : "";
  if (!(await resolveAccessContext(res)).isOps && !(await accountHasAdmission(email, "robot_team"))) {
    res.status(403).json({ error: "Robot-team access requires Blueprint approval.", code: "account_invitation_required" });
    return null;
  }
  return { uid, email, verified: auth?.email_verified === true, user };
}

function project(checkpoint: RobotCheckpoint) {
  return {
    checkpointId: checkpoint.checkpointId,
    teamId: checkpoint.teamId,
    label: checkpoint.label,
    runtime: checkpoint.runtime,
    reference: checkpoint.reference,
    status: checkpoint.status,
    unrunnableReason: checkpoint.unrunnableReason,
    createdAtIso: checkpoint.createdAtIso,
  };
}

async function readSetupReference(uid: string, setupId: string): Promise<{ reference: string; name: string } | null> {
  const stored = await db!.collection("users").doc(uid).collection("robotSetups").doc(setupId).get();
  if (!stored.exists || !stored.data()?.payload) return null;
  const payload = JSON.parse(await decryptFieldValue(stored.data()!.payload));
  const reference = typeof payload.reference === "string" ? payload.reference.trim() : "";
  return reference ? { reference, name: typeof payload.name === "string" ? payload.name : setupId } : null;
}

// One registration per team at a time on this instance, so a double submit
// finds the first one's checkpoint instead of writing a second.
const inFlight = new Map<string, Promise<unknown>>();
async function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = inFlight.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  inFlight.set(key, next);
  try { return await next; } finally { if (inFlight.get(key) === next) inFlight.delete(key); }
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const caller = await requireRobotTeamAccount(res);
    if (!caller) return;
    const teams = await teamsForAccount(caller.uid);
    const checkpoints = (await Promise.all(teams.map((team) => listCheckpoints(team.id)))).flat()
      .sort((a, b) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)));
    res.set("Cache-Control", "no-store");
    return res.json({
      teams: teams.map((team) => ({ teamId: team.id, name: team.name })),
      checkpoints: checkpoints.map(project),
      runtimes: WORKSPACE_CHECKPOINT_RUNTIMES,
    });
  } catch (error) {
    logger.error({ err: error }, "Workspace checkpoint list failed");
    return res.status(503).json({ error: "Checkpoints could not be loaded. Please try again." });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const caller = await requireRobotTeamAccount(res);
    if (!caller) return;
    if (!caller.verified) {
      return res.status(403).json({ error: "Verify your email before registering a checkpoint.", code: "account_email_unverified" });
    }
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Choose a saved setup, name the checkpoint, and pick how we run it.",
        code: "checkpoint_invalid", runtimes: WORKSPACE_CHECKPOINT_RUNTIMES });
    }
    const input = parsed.data;
    const setup = await readSetupReference(caller.uid, input.setupId);
    if (!setup) return res.status(404).json({ error: "That setup is not saved on this account.", code: "setup_not_found" });

    let teams = await teamsForAccount(caller.uid);
    let teamId = input.teamId ? teams.find((team) => team.id === input.teamId)?.id : teams[0]?.id;
    if (input.teamId && !teamId) {
      return res.status(404).json({ error: "That team is not connected to this account.", code: "team_not_found" });
    }
    return await serialized(`account:${caller.uid}`, async () => {
      if (!teamId) {
        // First registration for an approved account with no team yet: create
        // and bind one, as issuing an agent key from the account already does.
        teams = await teamsForAccount(caller.uid);
        teamId = teams[0]?.id;
        if (!teamId) {
          const created = await registerSelfServeTeam({
            name: String(caller.user.organizationName || caller.user.company || "").trim()
              || caller.email.split("@")[1] || "Robot team",
            contactEmail: caller.email,
          });
          if (!created) return res.status(503).json({ error: "The registry is unavailable, so no team was created.", code: "registry_unavailable" });
          await bindTeamToAccount(created.id, caller);
          teamId = created.id;
        }
      }
      const existing = (await listCheckpoints(teamId)).find((checkpoint) =>
        checkpoint.reference === setup.reference && checkpoint.runtime === input.runtime && checkpoint.status !== "retired");
      if (existing) {
        return res.status(200).json({ ok: true, created: false, checkpoint: project(existing),
          message: "This setup already has a checkpoint registered for that runtime." });
      }
      const result = await registerCheckpoint({ teamId, label: input.label, runtime: input.runtime, reference: setup.reference });
      if (!result.registered) {
        return res.status(result.refusal === "store_unavailable" ? 503 : 409).json({ error: result.detail, code: result.refusal });
      }
      return res.status(201).json({ ok: true, created: true, checkpoint: project(result.checkpoint),
        message: "Checkpoint registered. Registration does not start an evaluation; Blueprint admits free evaluations." });
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    if (status < 500) return res.status(status).json({ error: (error as Error).message, code: (error as { code?: string }).code });
    logger.error({ err: error }, "Workspace checkpoint registration failed");
    return res.status(503).json({ error: "The checkpoint was not registered. Please try again." });
  }
});

export default router;
