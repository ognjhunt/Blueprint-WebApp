import crypto from "node:crypto";
import { z } from "zod";

export const COMPANY_POLICY_CONTAINER_SCHEMA_VERSION =
  "company_policy_container_contract.v2" as const;
export const COMPANY_POLICY_CONTAINER_CLAIM_CEILING = "development_only" as const;
export const COMPANY_POLICY_ACTION_ROUTE = "/v1/actions" as const;

export const COMPANY_POLICY_SECURITY_PROFILE = Object.freeze({
  profile_id: "blueprint_company_policy_sandbox_v2",
  network_mode: "none_with_blueprint_proxy",
  egress_policy: "deny_all_measured_before_first_observation",
  dns_available: false,
  ipv6_available: false,
  host_network_available: false,
  scene_mounts_allowed: false,
  capture_mounts_allowed: false,
  evidence_mounts_allowed: false,
  output_mounts_allowed: false,
  docker_socket_mounted: false,
  registry_credential_mounted: false,
  runtime_credential_mounts_allowed: false,
  root_filesystem_read_only: true,
  capabilities_dropped: "all",
  no_new_privileges: true,
  raw_logs_after_scene_access: "quarantined_not_customer_visible",
  blueprint_owned_proxy_only: true,
  container_and_image_removal_required: true,
} as const);

const identifier = z.string().regex(/^[a-z0-9][a-z0-9_]{0,127}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const image = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._/:-]*@sha256:[0-9a-f]{64}$/);
const finite = z.number().finite();
const interval = z.tuple([finite, finite]);

const checkpointSchema = z
  .object({
    repository: z.string().trim().min(1),
    revision: z.string().trim().min(1),
    inventory_digest: digest,
  })
  .strict();

const rightsSchema = z
  .object({
    license: z.string().trim().min(1),
    rights_provenance: z.string().trim().min(1),
    rights_evidence_uri: z.string().trim().min(1),
    rights_evidence_digest: digest,
    provider_use_status: z.string().trim().min(1),
    redistribution_status: z.string().trim().min(1),
    rights_ready: z.literal(true),
  })
  .strict();

const resourcesSchema = z
  .object({
    cpus: finite.min(0.1).max(64),
    memory_mib: z.number().int().min(256).max(262_144),
    pids_limit: z.number().int().min(16).max(4096),
    tmpfs_mib: z.number().int().min(16).max(65_536),
    startup_timeout_seconds: z.number().int().min(1).max(900),
    request_timeout_ms: z.number().int().min(1).max(120_000),
  })
  .strict();

const containerSchema = z
  .object({
    image,
    visibility: z.enum(["public", "private"]),
    serve_command: z.array(z.string().min(1)).min(1),
    port: z.number().int().min(1024).max(65_535),
    handshake: z
      .object({
        kind: z.literal("http_json_v1"),
        protocol_version: z.literal("1.0"),
        action_route: z.literal(COMPANY_POLICY_ACTION_ROUTE),
      })
      .strict(),
    run_as_uid: z.number().int().min(1).max(2_147_483_647),
    run_as_gid: z.number().int().min(1).max(2_147_483_647),
    gpu_required: z.boolean(),
    resources: resourcesSchema,
  })
  .strict();

const jointLimitSchema = z
  .object({
    name: identifier,
    lower: finite,
    upper: finite,
    unit: z.string().trim().min(1),
  })
  .strict();

const robotSchema = z
  .object({
    embodiment_id: identifier,
    definition_uri: z.string().trim().min(1),
    definition_digest: digest,
    joint_names: z.array(identifier).min(1),
    joint_limits: z.array(jointLimitSchema).min(1),
    gripper: z
      .object({
        name: identifier,
        command_interval: interval,
        unit: z.string().trim().min(1),
        executed_semantics: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

const cameraSchema = z
  .object({
    name: identifier,
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
    color_space: z.literal("rgb"),
    dtype: z.literal("uint8"),
    layout: z.literal("hwc"),
    encoding: z.literal("lossless_png"),
    calibration_uri: z.string().trim().min(1),
    calibration_digest: digest,
  })
  .strict();

const stateFieldSchema = z
  .object({
    name: identifier,
    shape: z.array(z.number().int().min(1)).min(1),
    dtype: z.enum(["float32", "float64"]),
    unit: z.string().trim().min(1),
  })
  .strict();

const observationSchema = z
  .object({
    cameras: z.array(cameraSchema).min(1),
    state_fields: z.array(stateFieldSchema).min(1),
    prompt: z
      .object({mode: z.literal("text"), required: z.literal(true)})
      .strict(),
    control_frequency_hz: finite.min(0.1).max(240),
  })
  .strict();

const actionChannelSchema = z
  .object({
    name: identifier,
    kind: z.enum(["bounded_continuous", "threshold_scalar"]),
    command_interval: interval,
    raw_accepted_bounds: interval,
    unit: z.string().trim().min(1),
    executed_semantics: z.string().trim().min(1),
  })
  .strict();

const actionSchema = z
  .object({
    adapter_id: identifier,
    chunk_rows: z.number().int().min(1).max(1024),
    channels: z.array(actionChannelSchema).min(1),
    normalization: z
      .object({
        observation: z.string().trim().min(1),
        action: z.string().trim().min(1),
        gripper: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

const securityProfileSchema = z
  .object({
    profile_id: z.literal(COMPANY_POLICY_SECURITY_PROFILE.profile_id),
    network_mode: z.literal(COMPANY_POLICY_SECURITY_PROFILE.network_mode),
    egress_policy: z.literal(COMPANY_POLICY_SECURITY_PROFILE.egress_policy),
    dns_available: z.literal(false),
    ipv6_available: z.literal(false),
    host_network_available: z.literal(false),
    scene_mounts_allowed: z.literal(false),
    capture_mounts_allowed: z.literal(false),
    evidence_mounts_allowed: z.literal(false),
    output_mounts_allowed: z.literal(false),
    docker_socket_mounted: z.literal(false),
    registry_credential_mounted: z.literal(false),
    runtime_credential_mounts_allowed: z.literal(false),
    root_filesystem_read_only: z.literal(true),
    capabilities_dropped: z.literal("all"),
    no_new_privileges: z.literal(true),
    raw_logs_after_scene_access: z.literal(
      COMPANY_POLICY_SECURITY_PROFILE.raw_logs_after_scene_access,
    ),
    blueprint_owned_proxy_only: z.literal(true),
    container_and_image_removal_required: z.literal(true),
  })
  .strict();

const contractSchema = z
  .object({
    schema_version: z.literal(COMPANY_POLICY_CONTAINER_SCHEMA_VERSION),
    policy_id: identifier,
    company_id: identifier,
    display_name: z.string().trim().min(1),
    checkpoint_identity: checkpointSchema,
    claim_ceiling: z.literal(COMPANY_POLICY_CONTAINER_CLAIM_CEILING),
    rights: rightsSchema,
    container: containerSchema,
    robot: robotSchema,
    observation_schema: observationSchema,
    action_schema: actionSchema,
    security_profile: securityProfileSchema.optional(),
    contract_digest: digest.optional(),
  })
  .strict();

export type CompanyPolicyContainerContract = z.infer<typeof contractSchema> & {
  security_profile: typeof COMPANY_POLICY_SECURITY_PROFILE;
  contract_digest: string;
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("contract_not_json");
    return serialized;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function companyPolicyContractDigest(value: Record<string, unknown>): string {
  const payload = {...value};
  delete payload.contract_digest;
  return `sha256:${crypto
    .createHash("sha256")
    .update(canonicalJson(payload), "utf8")
    .digest("hex")}`;
}

function duplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

export type CompanyPolicyContractResult =
  | {ok: true; contract: CompanyPolicyContainerContract}
  | {ok: false; code: "company_policy_container_v2_invalid"; errors: string[]};

export function normalizeCompanyPolicyContainerContract(
  value: unknown,
): CompanyPolicyContractResult {
  const parsed = contractSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      code: "company_policy_container_v2_invalid",
      errors: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "contract"}:${issue.code}`)
        .sort(),
    };
  }

  const contract = parsed.data;
  const errors: string[] = [];
  const jointDuplicate = duplicate(contract.robot.joint_names);
  if (jointDuplicate) errors.push(`robot.joint_names:duplicate:${jointDuplicate}`);
  if (contract.robot.joint_limits.length !== contract.robot.joint_names.length) {
    errors.push("robot.joint_limits:length_mismatch");
  }
  contract.robot.joint_limits.forEach((limit, index) => {
    if (limit.name !== contract.robot.joint_names[index]) {
      errors.push(`robot.joint_limits.${index}:joint_order_mismatch`);
    }
    if (limit.lower >= limit.upper) {
      errors.push(`robot.joint_limits.${index}:invalid_interval`);
    }
  });
  if (contract.robot.gripper.command_interval[0] >= contract.robot.gripper.command_interval[1]) {
    errors.push("robot.gripper.command_interval:invalid_interval");
  }

  for (const [path, names] of [
    ["observation_schema.cameras", contract.observation_schema.cameras.map((row) => row.name)],
    [
      "observation_schema.state_fields",
      contract.observation_schema.state_fields.map((row) => row.name),
    ],
    ["action_schema.channels", contract.action_schema.channels.map((row) => row.name)],
  ] as const) {
    const repeated = duplicate([...names]);
    if (repeated) errors.push(`${path}:duplicate:${repeated}`);
  }

  contract.action_schema.channels.forEach((channel, index) => {
    const [commandLow, commandHigh] = channel.command_interval;
    const [rawLow, rawHigh] = channel.raw_accepted_bounds;
    if (commandLow >= commandHigh) {
      errors.push(`action_schema.channels.${index}.command_interval:invalid_interval`);
    }
    if (rawLow >= rawHigh) {
      errors.push(`action_schema.channels.${index}.raw_accepted_bounds:invalid_interval`);
    }
    if (rawLow > commandLow || rawHigh < commandHigh) {
      errors.push(`action_schema.channels.${index}:raw_bounds_narrower_than_command`);
    }
  });

  if (errors.length) {
    return {
      ok: false,
      code: "company_policy_container_v2_invalid",
      errors: [...new Set(errors)].sort(),
    };
  }

  const normalizedWithoutDigest = {
    ...contract,
    security_profile: COMPANY_POLICY_SECURITY_PROFILE,
  };
  delete (normalizedWithoutDigest as {contract_digest?: string}).contract_digest;
  const contractDigest = companyPolicyContractDigest(normalizedWithoutDigest);
  if (contract.contract_digest && contract.contract_digest !== contractDigest) {
    return {
      ok: false,
      code: "company_policy_container_v2_invalid",
      errors: ["contract_digest:mismatch"],
    };
  }
  return {
    ok: true,
    contract: {
      ...normalizedWithoutDigest,
      contract_digest: contractDigest,
    } as CompanyPolicyContainerContract,
  };
}
