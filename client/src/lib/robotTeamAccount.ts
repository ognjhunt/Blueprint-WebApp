/**
 * A robot team's Blueprint account: connecting the team, and its agent keys.
 *
 * Planning is open to anyone. Paying and running need the team bound to a
 * verified account, and the account is where the team's agent keys are issued
 * and revoked. These wrap the workspace routes that do both.
 */
import type { User } from "firebase/auth";
import { WorkspaceRequestError, workspaceRequest } from "@/lib/workspace";

export interface AgentAccessKey {
  keyId: string;
  label: string;
  createdAtIso: string;
  lastUsedAtIso: string | null;
}

export interface AgentAccessTeam {
  teamId: string;
  name: string;
  connectedAtIso: string | null;
  keys: AgentAccessKey[];
}

/**
 * Bind the team behind `agentKey` to this account, setting up a robot-team
 * workspace first when the account is new.
 */
export async function connectRobotTeam(
  user: User,
  agentKey: string,
  setup: { teamName: string; acceptedTerms: boolean },
): Promise<void> {
  try {
    await workspaceRequest(user, "/robot-team/connect", "POST", { agentKey });
  } catch (error) {
    if (error instanceof WorkspaceRequestError && error.code === "workspace_setup_required") {
      await workspaceRequest(user, "/setup", "POST", {
        name: user.email?.split("@")[0] || "Robot team",
        organization: setup.teamName || "Robot team",
        workspaceType: "robot_team",
        acceptedTerms: setup.acceptedTerms,
      });
      await workspaceRequest(user, "/robot-team/connect", "POST", { agentKey });
      return;
    }
    throw error;
  }
}

/** Record the workspace type and terms before verification, so the click is the last step. */
export async function setUpRobotTeamWorkspace(
  user: User,
  setup: { teamName: string; acceptedTerms: boolean },
): Promise<void> {
  const current = await workspaceRequest<{ workspaceType: string | null }>(user, "/setup");
  if (current.workspaceType) return;
  await workspaceRequest(user, "/setup", "POST", {
    name: user.email?.split("@")[0] || "Robot team",
    organization: setup.teamName || "Robot team",
    workspaceType: "robot_team",
    acceptedTerms: setup.acceptedTerms,
  });
}

/** Where a verification email returns a person mid-purchase. */
export function robotTeamVerificationUrl() {
  const url = new URL("/contact/robot-team", window.location.origin);
  url.searchParams.set("connect", "1");
  return url.toString();
}
