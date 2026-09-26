import type { User as FirebaseUser } from "firebase/auth";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import {
  parsePacketPlanningSetup,
  type PacketPlanningSetup,
  type PacketPolicyHandoff,
} from "@/lib/policyPacketPlanning";

export async function fetchG1TeamCampaignSetups(currentUser: FirebaseUser): Promise<PacketPlanningSetup[]> {
  const response = await fetch("/api/native-g1-team-campaigns/setups", {
    credentials: "include",
    headers: await withFirebaseAuthHeaders(currentUser),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`G1 task setups unavailable (${response.status})`);
  const catalog: unknown = await response.json();
  if (!catalog || typeof catalog !== "object"
    || (catalog as Record<string, unknown>).schema_version !== "native_g1_team_campaign_setup_catalog.v1"
    || !Array.isArray((catalog as Record<string, unknown>).setups)) {
    throw new Error("G1 task catalog is invalid");
  }
  return Promise.all(((catalog as { setups: unknown[] }).setups).map((setup) =>
    parsePacketPlanningSetup(JSON.stringify(setup))));
}

export async function submitG1TeamCampaign(params: {
  currentUser: FirebaseUser;
  runId: string;
  setup: PacketPlanningSetup;
  bookHandoff: PacketPolicyHandoff;
  movementHandoff: PacketPolicyHandoff;
  authorizationExpiresAtEpoch: number;
  maximumCostUsd: number;
}) {
  const response = await fetch("/api/native-g1-team-campaigns", {
    method: "POST",
    credentials: "include",
    redirect: "error",
    headers: await withFirebaseAuthHeaders(params.currentUser,
      await withCsrfHeader({ "Content-Type": "application/json" })),
    body: JSON.stringify({
      run_id: params.runId,
      setup_digest: params.setup.setup_digest,
      book_handoff: params.bookHandoff,
      movement_handoff: params.movementHandoff,
      authorization_expires_at_epoch: params.authorizationExpiresAtEpoch,
      authorize_maximum_cost_usd_12: true,
      maximum_cost_usd: params.maximumCostUsd,
    }),
  });
  const value = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(value.error || `G1 request unavailable (${response.status})`));
  if (value.schema_version !== "native_g1_team_campaign_intake_receipt.v1"
    || value.status !== "accepted_not_dispatched"
    || typeof value.intent_id !== "string"
    || value.provider_mutation_performed_inside_http_request !== false) {
    throw new Error("G1 intake receipt is invalid");
  }
  return value as { intent_id: string; status: "accepted_not_dispatched" };
}
