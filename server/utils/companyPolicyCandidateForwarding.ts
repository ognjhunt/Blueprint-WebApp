import crypto from "node:crypto";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_PIPELINE_INTAKE_CLIENT_ID = "blueprint-webapp";

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export interface CompanyPolicyCandidateHandoff {
  schema_version: "company_policy_container_admission_request.v1";
  tenant_id: string;
  run_id: string;
  submission_id: string;
  company_id: string;
  contract_digest: string;
  contract: Record<string, unknown>;
  registry_credential_lease_id: string | null;
  claim_ceiling: "development_only";
  launch_authority_granted: false;
  provider_mutation_authorized: false;
}

function containsSecretCarrier(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretCarrier);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) =>
    [
      "registry_secret",
      "encrypted_credential",
      "registry_password",
      "docker_config_json",
      "authorization_header",
    ].includes(key.toLowerCase()) || containsSecretCarrier(nested),
  );
}

export function buildCompanyPolicyPipelineIntakeSignature(args: {
  secret: string;
  timestamp: string;
  clientId: string;
  nonce: string;
  body: string;
}): string {
  return crypto
    .createHmac("sha256", args.secret)
    .update(`${args.timestamp}.${args.clientId}.${args.nonce}.${args.body}`)
    .digest("hex");
}

export async function forwardCompanyPolicyCandidateToPipeline(
  handoff: CompanyPolicyCandidateHandoff,
): Promise<Record<string, unknown>> {
  const url = String(process.env.COMPANY_POLICY_CONTAINER_FORWARD_URL || "").trim();
  const secret = String(process.env.PIPELINE_SYNC_TOKEN || "").trim();
  const required = truthy(process.env.COMPANY_POLICY_CONTAINER_FORWARD_REQUIRED);
  if (!url || !secret) {
    return {
      status: "not_configured",
      performed: false,
      accepted: false,
      required,
      blockers: [
        !url ? "company_policy_container_forward_url_missing" : null,
        !secret ? "pipeline_sync_secret_missing" : null,
      ].filter(Boolean),
    };
  }
  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    return {
      status: "blocked",
      performed: false,
      accepted: false,
      required,
      blockers: ["company_policy_container_forward_url_invalid"],
    };
  }
  const loopbackHttp = endpoint.protocol === "http:"
    && new Set(["127.0.0.1", "localhost"]).has(endpoint.hostname);
  if (
    (endpoint.protocol !== "https:" && !loopbackHttp)
    || endpoint.username
    || endpoint.password
    || endpoint.hash
  ) {
    return {
      status: "blocked",
      performed: false,
      accepted: false,
      required,
      blockers: ["company_policy_container_forward_url_not_https_or_loopback"],
    };
  }

  if (containsSecretCarrier(handoff)) {
    return {
      status: "blocked",
      performed: false,
      accepted: false,
      required,
      blockers: ["company_policy_container_handoff_secret_carrier_detected"],
    };
  }
  const body = JSON.stringify(handoff);
  const timestamp = new Date().toISOString();
  const clientId = String(
    process.env.COMPANY_POLICY_CONTAINER_FORWARD_CLIENT_ID || DEFAULT_PIPELINE_INTAKE_CLIENT_ID,
  ).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(clientId)) {
    return {
      status: "blocked",
      performed: false,
      accepted: false,
      required,
      blockers: ["company_policy_container_forward_client_id_invalid"],
    };
  }
  const nonce = `company-policy-${crypto.randomBytes(24).toString("hex")}`;
  const signature = buildCompanyPolicyPipelineIntakeSignature({
    secret,
    timestamp,
    clientId,
    nonce,
    body,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Blueprint-Pipeline-Timestamp": timestamp,
        "X-Blueprint-Pipeline-Signature": `sha256=${signature}`,
        "X-Blueprint-Pipeline-Client-Id": clientId,
        "X-Blueprint-Pipeline-Nonce": nonce,
        "Idempotency-Key": handoff.submission_id,
      },
      body,
      signal: controller.signal,
      redirect: "error",
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const responseBound = payload.status === "admitted_no_spend"
      && payload.accepted === true
      && payload.tenant_id === handoff.tenant_id
      && payload.run_id === handoff.run_id
      && payload.submission_id === handoff.submission_id
      && payload.company_id === handoff.company_id
      && payload.contract_digest === handoff.contract_digest
      && payload.registry_credential_lease_id === handoff.registry_credential_lease_id
      && payload.claim_ceiling === "development_only"
      && payload.registry_credential_consumed === false
      && payload.profile_published === false
      && payload.launch_queued === false
      && payload.launch_authority_granted === false
      && payload.provider_mutation_authorized === false
      && payload.provider_mutation_performed === false
      && /^company-policy-admission-[0-9a-f]{40}$/.test(String(payload.admission_id || ""))
      && /^sha256:[0-9a-f]{64}$/.test(String(payload.admission_digest || ""));
    const accepted = response.ok && responseBound;
    return {
      status: accepted ? "accepted" : "blocked",
      performed: true,
      accepted,
      required,
      pipeline_status: response.status,
      admission_id: payload.admission_id || null,
      admission_digest: payload.admission_digest || null,
      blockers: accepted
        ? []
        : [
            ...(Array.isArray(payload.blockers) ? payload.blockers : []),
            ...(response.ok && payload.accepted === true && !responseBound
              ? ["company_policy_pipeline_admission_receipt_binding_invalid"]
              : []),
          ],
    };
  } catch (error) {
    return {
      status: "blocked",
      performed: true,
      accepted: false,
      required,
      blockers: [error instanceof Error && error.name === "AbortError"
        ? "company_policy_container_forward_timeout"
        : "company_policy_container_forward_failed"],
    };
  } finally {
    clearTimeout(timeout);
  }
}
