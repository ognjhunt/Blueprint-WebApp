import { useState, type FormEvent } from "react";
import { Helmet } from "@/lib/helmet";
import { useLocation } from "wouter";

import { Button, Eyebrow, ProofBoundary } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import {
  DECISION_REQUEST_SCHEMA_VERSION,
  newContractId,
  splitLines,
} from "@/lib/decisionEvidence";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

const fieldClass = "runway-input mt-1.5";
const labelClass = "text-body-s font-semibold text-ink-800";

type IntakeState = {
  persona: "robot_team" | "site_operator";
  testbedId: string;
  testbedVersion: string;
  testbedDigest: string;
  siteId: string;
  siteName: string;
  taskId: string;
  taskDescription: string;
  conditions: string;
  decisionQuestion: string;
  candidates: string;
  claims: string;
  thresholdMetric: string;
  thresholdValue: string;
  thresholdUnit: string;
  unacceptableFailures: string;
  falseSafeSeverity: "low" | "moderate" | "high" | "critical";
  falseSafeConsequence: string;
  confidence: string;
  budget: string;
  deadline: string;
  allowedChanges: string;
  restrictions: string;
  physicalTestingPossible: boolean;
  physicalEvidenceUri: string;
  physicalEvidenceVersion: string;
  physicalEvidenceDigest: string;
  entitlementId: string;
};

const initialState: IntakeState = {
  persona: "robot_team",
  testbedId: "",
  testbedVersion: "",
  testbedDigest: "",
  siteId: "",
  siteName: "",
  taskId: "",
  taskDescription: "",
  conditions: "",
  decisionQuestion: "",
  candidates: "",
  claims: "",
  thresholdMetric: "",
  thresholdValue: "",
  thresholdUnit: "",
  unacceptableFailures: "",
  falseSafeSeverity: "high",
  falseSafeConsequence: "",
  confidence: "",
  budget: "",
  deadline: "",
  allowedChanges: "",
  restrictions: "",
  physicalTestingPossible: false,
  physicalEvidenceUri: "",
  physicalEvidenceVersion: "",
  physicalEvidenceDigest: "",
  entitlementId: "",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="runway-panel p-5">
      <legend className="px-1 font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">{title}</legend>
      <p className="mb-4 text-body-s text-ink-500">{description}</p>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "md:col-span-2" : undefined}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export default function RunIntake() {
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof IntakeState>(key: K, value: IntakeState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);
    setError(null);
    const requestId = newContractId("request");
    const decisionId = newContractId("decision");
    const claims = splitLines(form.claims).map((statement, index) => ({
      claim_id: `claim-${index + 1}`,
      statement,
      threshold_ids: form.thresholdMetric && index === 0 ? ["threshold-1"] : [],
    }));
    const physicalEvidence = form.physicalEvidenceUri
      ? [
          {
            artifact_id: "customer-physical-evidence-1",
            kind: "available_physical_evidence",
            uri: form.physicalEvidenceUri,
            version: form.physicalEvidenceVersion,
            digest_sha256: form.physicalEvidenceDigest,
            evidence_class: "physical",
          },
        ]
      : [];
    const request = {
      schema_version: DECISION_REQUEST_SCHEMA_VERSION,
      request_id: requestId,
      decision_id: decisionId,
      testbed: {
        testbed_id: form.testbedId,
        version: form.testbedVersion,
        digest_sha256: form.testbedDigest,
      },
      decision_question: form.decisionQuestion,
      site_task: {
        site_id: form.siteId,
        site_name: form.siteName || undefined,
        task_id: form.taskId,
        task_description: form.taskDescription,
        conditions: splitLines(form.conditions),
      },
      candidates: splitLines(form.candidates).map((label, index) => ({
        candidate_id: `candidate-${index + 1}`,
        kind: form.persona === "robot_team" ? "policy" : "robot",
        label,
        reference: { external_id: label },
      })),
      claims,
      thresholds: form.thresholdMetric
        ? [
            {
              threshold_id: "threshold-1",
              metric: form.thresholdMetric,
              operator: "gte",
              value: Number.isFinite(Number(form.thresholdValue))
                ? Number(form.thresholdValue)
                : form.thresholdValue,
              unit: form.thresholdUnit,
            },
          ]
        : [],
      false_safe: {
        severity: form.falseSafeSeverity,
        consequence: `${form.falseSafeConsequence}\nUnacceptable failures: ${form.unacceptableFailures}`,
      },
      confidence_requirement: {
        kind: "qualitative",
        description: form.confidence,
      },
      constraints: {
        budget: {
          ...(form.budget ? { amount: Number(form.budget) } : {}),
          currency: "USD",
          hard_cap: Boolean(form.budget),
        },
        ...(form.deadline ? { deadline: new Date(form.deadline).toISOString() } : {}),
        available_physical_evidence: physicalEvidence,
        allowed_site_changes: splitLines(form.allowedChanges),
        physical_testing_possible: form.physicalTestingPossible,
        rights_privacy_provider_restrictions: splitLines(form.restrictions),
      },
      requested_audience: [form.persona],
      routing_authority: {
        system: "BlueprintCapturePipeline",
        method_selection: "pipeline_qualified_least_cost_sufficient_evidence",
        webapp_backend_selection_allowed: false,
      },
      idempotency: {
        key: `${currentUser.uid}:${decisionId}`,
        scope: "authenticated_owner_and_decision",
      },
      provenance: {
        source_system: "Blueprint-WebApp",
        source_route: "/app/runs/new",
        submitted_at_iso: new Date().toISOString(),
        request_contract_source: "pipeline_proposed_mirror",
      },
      owner: { user_id: currentUser.uid, authenticated_by: "firebase" },
      ...(form.entitlementId
        ? { authorization: { entitlement_id: form.entitlementId } }
        : {}),
      commercial: {
        engagement: "scoped_task_evaluation_run",
        quote_required: true,
        client_supplied_price: false,
      },
    };

    try {
      const response = await fetch("/api/task-evaluation-runs", {
        method: "POST",
        credentials: "include",
        headers: await withFirebaseAuthHeaders(
          currentUser,
          await withCsrfHeader({ "Content-Type": "application/json" }),
        ),
        body: JSON.stringify(request),
      });
      const payload = (await response.json()) as {
        error?: string;
        migration_errors?: string[];
      };
      if (!response.ok) {
        throw new Error(payload.migration_errors?.join(" ") || payload.error || `Request failed (${response.status})`);
      }
      navigate(`/app/runs/${encodeURIComponent(requestId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell active="runs" breadcrumb="runs / new">
      <Helmet>
        <title>Request a Task Evaluation Run · Blueprint</title>
        <meta name="description" content="Decision-oriented Task Evaluation Run intake." />
      </Helmet>
      <form onSubmit={submit} className="mx-auto flex max-w-[68rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header>
          <Eyebrow tone="brass" rule>Task Evaluation Run</Eyebrow>
          <h1 className="mt-2 font-display text-[1.8rem] font-semibold uppercase tracking-[0.005em] text-ink-900">Describe the decision—not the evaluation stack</h1>
          <p className="mt-2 max-w-3xl text-body-s text-ink-500">
            Blueprint routes each claim to the least expensive evidence that is trustworthy enough, and asks for stronger evidence only when needed.
          </p>
        </header>

        <Section title="1. Site, task, and account" description="Identify the maintained testbed and the real task this decision concerns.">
          <Field label="I am submitting for">
            <select className={fieldClass} value={form.persona} onChange={(e) => set("persona", e.target.value as IntakeState["persona"])}>
              <option value="robot_team">Robot team</option>
              <option value="site_operator">Site operator</option>
            </select>
          </Field>
          <Field label="Account contact"><input className={fieldClass} value={currentUser?.email || "Authenticated account"} disabled /></Field>
          <Field label="Testbed ID"><input required className={fieldClass} value={form.testbedId} onChange={(e) => set("testbedId", e.target.value)} /></Field>
          <Field label="Testbed version"><input required className={fieldClass} value={form.testbedVersion} onChange={(e) => set("testbedVersion", e.target.value)} /></Field>
          <Field label="Testbed manifest digest" wide><input required pattern="sha256:[a-fA-F0-9]{64}" placeholder="sha256:…" className={fieldClass} value={form.testbedDigest} onChange={(e) => set("testbedDigest", e.target.value)} /></Field>
          <Field label="Site ID"><input required className={fieldClass} value={form.siteId} onChange={(e) => set("siteId", e.target.value)} /></Field>
          <Field label="Site name"><input className={fieldClass} value={form.siteName} onChange={(e) => set("siteName", e.target.value)} /></Field>
          <Field label="Task ID"><input required className={fieldClass} value={form.taskId} onChange={(e) => set("taskId", e.target.value)} /></Field>
          <Field label="Task description"><textarea required className={fieldClass} value={form.taskDescription} onChange={(e) => set("taskDescription", e.target.value)} /></Field>
          <Field label="Site and task conditions (one per line)" wide><textarea required className={fieldClass} value={form.conditions} onChange={(e) => set("conditions", e.target.value)} /></Field>
        </Section>

        <Section title="2. Decision and claims" description="A run may return a bounded positive or negative decision, a partial decision, or an explicit abstention.">
          <Field label="What decision do you need to make?" wide><textarea required className={fieldClass} value={form.decisionQuestion} onChange={(e) => set("decisionQuestion", e.target.value)} /></Field>
          <Field label="Candidates or policies, if applicable (one per line)" wide><textarea className={fieldClass} value={form.candidates} onChange={(e) => set("candidates", e.target.value)} /></Field>
          <Field label="Decision-relevant claims (one per line)" wide><textarea required className={fieldClass} value={form.claims} onChange={(e) => set("claims", e.target.value)} /></Field>
          <Field label="Primary success metric"><input className={fieldClass} value={form.thresholdMetric} onChange={(e) => set("thresholdMetric", e.target.value)} /></Field>
          <Field label="Minimum value"><input className={fieldClass} value={form.thresholdValue} onChange={(e) => set("thresholdValue", e.target.value)} /></Field>
          <Field label="Unit"><input className={fieldClass} value={form.thresholdUnit} onChange={(e) => set("thresholdUnit", e.target.value)} /></Field>
          <Field label="Acceptable risk or confidence requirement"><input required className={fieldClass} value={form.confidence} onChange={(e) => set("confidence", e.target.value)} /></Field>
        </Section>

        <Section title="3. Consequences and constraints" description="These inputs determine how strong the evidence must be before Blueprint can support a claim.">
          <Field label="Unacceptable failures" wide><textarea required className={fieldClass} value={form.unacceptableFailures} onChange={(e) => set("unacceptableFailures", e.target.value)} /></Field>
          <Field label="False-safe severity"><select className={fieldClass} value={form.falseSafeSeverity} onChange={(e) => set("falseSafeSeverity", e.target.value as IntakeState["falseSafeSeverity"])}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
          <Field label="Consequence of a false-safe"><textarea required className={fieldClass} value={form.falseSafeConsequence} onChange={(e) => set("falseSafeConsequence", e.target.value)} /></Field>
          <Field label="Budget ceiling (USD)"><input type="number" min="0" className={fieldClass} value={form.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
          <Field label="Decision deadline"><input type="datetime-local" className={fieldClass} value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
          <Field label="Allowed site changes (one per line)" wide><textarea className={fieldClass} value={form.allowedChanges} onChange={(e) => set("allowedChanges", e.target.value)} /></Field>
          <Field label="Rights, privacy, and provider restrictions (one per line)" wide><textarea required className={fieldClass} value={form.restrictions} onChange={(e) => set("restrictions", e.target.value)} /></Field>
          <label className="md:col-span-2 flex items-center gap-3 text-body-s font-semibold text-ink-800"><input type="checkbox" checked={form.physicalTestingPossible} onChange={(e) => set("physicalTestingPossible", e.target.checked)} />Authoritative physical testing is possible for this task</label>
        </Section>

        <details className="runway-panel p-5">
          <summary className="cursor-pointer font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">Optional evidence and authorization details</summary>
          <p className="mt-2 text-body-s text-ink-500">Add exact references only. Do not paste credentials, private endpoints, or raw policy weights.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Physical evidence artifact URI" wide><input className={fieldClass} value={form.physicalEvidenceUri} onChange={(e) => set("physicalEvidenceUri", e.target.value)} /></Field>
            <Field label="Artifact version"><input className={fieldClass} required={Boolean(form.physicalEvidenceUri)} value={form.physicalEvidenceVersion} onChange={(e) => set("physicalEvidenceVersion", e.target.value)} /></Field>
            <Field label="Artifact digest"><input className={fieldClass} required={Boolean(form.physicalEvidenceUri)} pattern="sha256:[a-fA-F0-9]{64}" value={form.physicalEvidenceDigest} onChange={(e) => set("physicalEvidenceDigest", e.target.value)} /></Field>
            <Field label="Existing entitlement ID" wide><input className={fieldClass} value={form.entitlementId} onChange={(e) => set("entitlementId", e.target.value)} /></Field>
          </div>
        </details>

        <ProofBoundary level="info" title="What happens next">
          Pipeline selects and qualifies evidence methods. A submitted request without an existing authorization remains visible as awaiting authorization; provider availability is never presented as a scientific result.
        </ProofBoundary>
        {error ? <p role="alert" className="border border-runway-red-dim bg-runway-red/[0.06] p-3 text-body-s text-runway-red">{error}</p> : null}
        <Button type="submit" variant="action" disabled={submitting}>{submitting ? "Submitting…" : "Request a Task Evaluation Run"}</Button>
      </form>
    </AppShell>
  );
}
