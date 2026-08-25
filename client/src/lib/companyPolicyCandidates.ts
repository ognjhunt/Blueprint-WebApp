import type {User} from "firebase/auth";

import {withCsrfHeader} from "@/lib/csrf";
import {withFirebaseAuthHeaders} from "@/lib/firebaseAuthHeaders";

const digest = /^sha256:[0-9a-f]{64}$/;
const repository = /^[a-z0-9][a-z0-9._/:-]*$/;

export const COMPANY_POLICY_CONTRACT_TEMPLATE = {
  schema_version: "company_policy_container_contract.v2",
  policy_id: "",
  company_id: "",
  display_name: "",
  checkpoint_identity: {
    repository: "",
    revision: "",
    inventory_digest: "",
  },
  claim_ceiling: "development_only",
  rights: {
    license: "",
    rights_provenance: "",
    rights_evidence_uri: "",
    rights_evidence_digest: "",
    provider_use_status: "",
    redistribution_status: "weights_remain_in_company_container",
    rights_ready: true,
  },
  container: {
    image: "",
    visibility: "private",
    serve_command: ["python", "-m", "your_policy.serve", "--port", "8600"],
    port: 8600,
    handshake: {
      kind: "http_json_v1",
      protocol_version: "1.0",
      action_route: "/v1/actions",
    },
    run_as_uid: 65532,
    run_as_gid: 65532,
    gpu_required: true,
    resources: {
      cpus: 8,
      memory_mib: 32768,
      pids_limit: 512,
      tmpfs_mib: 2048,
      startup_timeout_seconds: 300,
      request_timeout_ms: 2500,
    },
  },
  robot: {
    embodiment_id: "franka_panda_robotiq_2f85_v1",
    definition_uri: "",
    definition_digest: "",
    joint_names: [
      "panda_joint1",
      "panda_joint2",
      "panda_joint3",
      "panda_joint4",
      "panda_joint5",
      "panda_joint6",
      "panda_joint7",
    ],
    joint_limits: [],
    gripper: {
      name: "gripper",
      command_interval: [0, 1],
      unit: "normalized_fraction",
      executed_semantics: "clip_then_map_to_parallel_jaw_width",
    },
  },
  observation_schema: {
    cameras: [],
    state_fields: [
      {name: "joint_position", shape: [7], dtype: "float32", unit: "radian"},
      {
        name: "gripper_position",
        shape: [1],
        dtype: "float32",
        unit: "normalized_fraction",
      },
    ],
    prompt: {mode: "text", required: true},
    control_frequency_hz: 15,
  },
  action_schema: {
    adapter_id: "absolute_joint_position_gripper_v1",
    chunk_rows: 15,
    channels: [],
    normalization: {
      observation: "none",
      action: "none",
      gripper: "raw_envelope_then_clip_to_command_interval",
    },
  },
};

export function buildCompanyPolicyContractSubmission(args: {
  contractText: string;
  companyId: string;
  imageRepository: string;
  imageDigest: string;
  visibility: "public" | "private";
}): Record<string, unknown> {
  let contract: Record<string, any>;
  try {
    contract = JSON.parse(args.contractText) as Record<string, any>;
  } catch {
    throw new Error("The policy contract is not valid JSON.");
  }
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    throw new Error("The policy contract must be a JSON object.");
  }
  const imageRepository = args.imageRepository.trim().toLowerCase();
  const imageDigest = args.imageDigest.trim().toLowerCase();
  if (!repository.test(imageRepository)) {
    throw new Error("Enter a valid lowercase OCI image repository.");
  }
  if (!digest.test(imageDigest)) {
    throw new Error("Enter the exact image digest as sha256 plus 64 lowercase hex characters.");
  }
  if (!args.companyId.trim()) {
    throw new Error("Your account does not have a company identity claim.");
  }
  contract.company_id = args.companyId.trim();
  contract.container = {
    ...(contract.container && typeof contract.container === "object" ? contract.container : {}),
    image: `${imageRepository}@${imageDigest}`,
    visibility: args.visibility,
  };
  delete contract.contract_digest;
  return contract;
}

async function responsePayload(response: Response): Promise<Record<string, any>> {
  return (await response.json().catch(() => ({}))) as Record<string, any>;
}

export async function submitCompanyPolicyCandidate(args: {
  user: User;
  runId: string;
  contract: Record<string, unknown>;
  idempotencyKey: string;
  registryCredential?: {
    username: string;
    secret: string;
    expiresInSeconds: number;
  };
}): Promise<Record<string, any>> {
  const candidateResponse = await fetch(
    `/api/task-evaluation-runs/${encodeURIComponent(args.runId)}/policy-candidates`,
    {
      method: "POST",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(
        args.user,
        await withCsrfHeader({"Content-Type": "application/json"}),
      ),
      body: JSON.stringify({contract: args.contract, idempotency_key: args.idempotencyKey}),
    },
  );
  const candidatePayload = await responsePayload(candidateResponse);
  if (!candidateResponse.ok) {
    throw new Error(
      String(candidatePayload.code || candidatePayload.error || `Candidate request failed (${candidateResponse.status})`),
    );
  }
  const candidate = candidatePayload.candidate as Record<string, any>;
  if (!args.registryCredential) return candidatePayload;
  const credentialResponse = await fetch(
    `/api/task-evaluation-runs/${encodeURIComponent(args.runId)}/policy-candidates/${encodeURIComponent(String(candidate.submission_id))}/registry-credential`,
    {
      method: "PUT",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(
        args.user,
        await withCsrfHeader({"Content-Type": "application/json"}),
      ),
      body: JSON.stringify({
        schema_version: "company_policy_registry_credential_lease.v1",
        submission_id: candidate.submission_id,
        contract_digest: candidate.contract_digest,
        image: candidate.image,
        registry_username: args.registryCredential.username,
        registry_secret: args.registryCredential.secret,
        expires_in_seconds: args.registryCredential.expiresInSeconds,
        idempotency_key: `${args.idempotencyKey}:registry-credential`,
      }),
    },
  );
  const credentialPayload = await responsePayload(credentialResponse);
  if (!credentialResponse.ok) {
    throw new Error(
      String(credentialPayload.code || credentialPayload.error || `Credential request failed (${credentialResponse.status})`),
    );
  }
  return {...candidatePayload, credential: credentialPayload};
}
