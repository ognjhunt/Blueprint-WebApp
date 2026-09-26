import type { User as FirebaseUser } from "firebase/auth";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

export type TeamPolicyDelivery =
  | { mode: "authenticated_endpoint"; endpoint_url: string; auth_secret_ref: string; timeout_ms: number }
  | { mode: "container"; image_ref: string; protocol: "jsonl_observation_action_v1" }
  | { mode: "noncontainer_artifact"; artifact_uri: string; artifact_sha256: string;
      entrypoint: string; protocol: "jsonl_observation_action_v1" };

export type TeamPolicyDeliveryProfile = {
  profile_digest: string;
  label: string;
  embodiment_id: string;
  observation_schema_id: string;
  action_schema_id: string;
  delivery: TeamPolicyDelivery;
  status: "registered_for_runtime_review";
};

export async function fetchTeamPolicyDeliveries(currentUser: FirebaseUser): Promise<TeamPolicyDeliveryProfile[]> {
  const response = await fetch("/api/native-g1-team-campaigns/policy-deliveries", {
    credentials: "include",
    redirect: "error",
    headers: await withFirebaseAuthHeaders(currentUser),
  });
  if (!response.ok) throw new Error(`Policy deliveries unavailable (${response.status})`);
  const value = await response.json() as { schema_version?: string; profiles?: TeamPolicyDeliveryProfile[] };
  if (value.schema_version !== "team_policy_delivery_profile_list.v1" || !Array.isArray(value.profiles)) {
    throw new Error("Policy delivery list is invalid");
  }
  return value.profiles.filter((profile) => profile.status === "registered_for_runtime_review"
    && /^sha256:[0-9a-f]{64}$/.test(profile.profile_digest));
}

export async function registerTeamPolicyDelivery(params: {
  currentUser: FirebaseUser;
  setupDigest: string;
  robotPresetId: string;
  label: string;
  delivery: TeamPolicyDelivery;
}): Promise<string> {
  const response = await fetch("/api/native-g1-team-campaigns/policy-deliveries", {
    method: "POST",
    credentials: "include",
    redirect: "error",
    headers: await withFirebaseAuthHeaders(params.currentUser,
      await withCsrfHeader({ "Content-Type": "application/json" })),
    body: JSON.stringify({
      setup_digest: params.setupDigest,
      robot_preset_id: params.robotPresetId,
      label: params.label,
      delivery: params.delivery,
    }),
  });
  const value = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(value.error || `Policy delivery unavailable (${response.status})`));
  if (value.schema_version !== "team_policy_delivery_profile.v1"
    || value.status !== "registered_for_runtime_review"
    || value.claim_ceiling !== "planning_only"
    || value.provider_mutation_performed !== false
    || typeof value.profile_digest !== "string"
    || !/^sha256:[0-9a-f]{64}$/.test(value.profile_digest)) {
    throw new Error("Policy delivery receipt is invalid");
  }
  return value.profile_digest;
}
