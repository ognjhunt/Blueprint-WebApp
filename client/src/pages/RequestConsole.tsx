import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  AlertCircle,
  BadgeCheck,
  Clock3,
  FileSearch,
  MapPinned,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { withCsrfHeader } from "@/lib/csrf";
import { analyticsEvents } from "@/lib/analytics";
import {
  getDemandAttributionFromContext,
  hasDemandAttribution,
} from "@/lib/demandAttribution";
import type { InboundRequestDetail } from "@/types/inbound-request";
import {
  BUYER_TYPE_LABELS,
  OPPORTUNITY_STATE_LABELS,
  REQUEST_CAPTURE_POLICY_LABELS,
  REQUEST_CAPTURE_STATUS_LABELS,
  REQUEST_QUOTE_STATUS_LABELS,
  REQUEST_RIGHTS_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
} from "@/types/inbound-request";

interface RequestConsoleProps {
  params: {
    requestId: string;
  };
}

function activeSection(path: string) {
  if (path.endsWith("/evidence")) return "evidence";
  if (path.endsWith("/preview")) return "preview";
  if (path.endsWith("/qualification")) return "qualification";
  return "overview";
}

function statusTone(
  value?: string | null
): "emerald" | "amber" | "rose" | "sky" | "zinc" {
  const normalized = String(value || "").toLowerCase();
  if (["qualified_ready", "approved", "paid", "verified", "buyer_ready", "quoted"].includes(normalized)) {
    return "emerald";
  }
  if (["needs_more_evidence", "needs_recapture", "permission_required", "review_required"].includes(normalized)) {
    return "amber";
  }
  if (["blocked", "failed", "not_allowed", "not_ready_yet"].includes(normalized)) {
    return "rose";
  }
  if (["capture_requested", "under_review", "queued", "processing", "submitted", "in_review"].includes(normalized)) {
    return "sky";
  }
  return "zinc";
}

function toneClasses(tone: ReturnType<typeof statusTone>) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "amber":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "rose":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "sky":
      return "bg-sky-50 text-sky-700 border-sky-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

function ValueChip({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-900">{value || "Pending"}</p>
    </div>
  );
}

export default function RequestConsole({ params }: RequestConsoleProps) {
  const [location] = useLocation();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const section = activeSection(location);
  const accessToken = searchParams.get("access")?.trim() ?? "";
  const [bootstrapReady, setBootstrapReady] = useState(accessToken.length === 0);
  const lastTrackedSectionRef = useRef("");

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/requests/${params.requestId}/bootstrap`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ access: accessToken }),
      });
      if (!response.ok) {
        throw new Error("This review link is invalid or expired.");
      }
      return response.json();
    },
    onSuccess: () => setBootstrapReady(true),
  });

  useEffect(() => {
    if (!accessToken || bootstrapReady || bootstrapMutation.isPending) {
      return;
    }
    bootstrapMutation.mutate();
  }, [accessToken, bootstrapMutation, bootstrapReady]);

  const requestQuery = useQuery<InboundRequestDetail>({
    queryKey: ["request-console", params.requestId, bootstrapReady],
    enabled: bootstrapReady,
    queryFn: async () => {
      const response = await fetch(`/api/requests/${params.requestId}`, {
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) {
        throw new Error(response.status === 401 ? "Review link required." : "Failed to load request");
      }
      return response.json();
    },
  });

  const tabs = useMemo(
    () => [
      { id: "overview", label: "Overview", href: `/requests/${params.requestId}` },
      { id: "evidence", label: "Evidence", href: `/requests/${params.requestId}/evidence` },
      { id: "qualification", label: "Qualification", href: `/requests/${params.requestId}/qualification` },
      { id: "preview", label: "Preview", href: `/requests/${params.requestId}/preview` },
    ],
    [params.requestId]
  );

  if (bootstrapMutation.isPending || (!bootstrapReady && accessToken)) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-zinc-600">Validating review link…</div>;
  }

  if (bootstrapMutation.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-3xl border border-rose-200 bg-white p-8">
          <AlertCircle className="h-8 w-8 text-rose-600" />
          <h1 className="mt-4 text-2xl font-semibold text-zinc-950">Review link required</h1>
          <p className="mt-2 text-zinc-600">
            This request is private to the buyer review flow. Ask Blueprint to resend the current review link.
          </p>
        </div>
      </div>
    );
  }

  if (requestQuery.isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-zinc-600">Loading request…</div>;
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8">
          <AlertCircle className="h-8 w-8 text-zinc-500" />
          <h1 className="mt-4 text-2xl font-semibold text-zinc-950">Request unavailable</h1>
          <p className="mt-2 text-zinc-600">
            Blueprint could not load this request. The review link may be missing or the record may still be processing.
          </p>
        </div>
      </div>
    );
  }

  const request = requestQuery.data;
  const reviewDemandAttribution = getDemandAttributionFromContext(request.context);
  const readiness = request.deployment_readiness;
  const ops = request.ops;
  const trustScore = readiness?.buyer_trust_score;
  const previewRun = readiness?.provider_run;
  const missingEvidence = readiness?.missing_evidence || [];

  useEffect(() => {
    const trackingKey = `${request.requestId}:${section}`;
    if (lastTrackedSectionRef.current === trackingKey) {
      return;
    }

    lastTrackedSectionRef.current = trackingKey;
    analyticsEvents.buyerReviewViewed({
      section,
      buyerType: request.request.buyerType,
      requestedLaneCount: request.request.requestedLanes.length,
      demandAttribution: hasDemandAttribution(reviewDemandAttribution)
        ? reviewDemandAttribution
        : undefined,
    });
  }, [request, reviewDemandAttribution, section]);

  const sectionTitle =
    section === "evidence"
      ? "Evidence bundle"
      : section === "qualification"
      ? "Qualification review"
      : section === "preview"
      ? "Preview and provenance"
      : "Request overview";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Buyer Review {request.site_submission_id}
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-950">{request.request.siteName}</h1>
              <p className="mt-2 text-zinc-600">{request.request.siteLocation}</p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-700">
                {request.request.taskStatement}
              </p>
            </div>
            <div className="grid min-w-[260px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(statusTone(request.qualification_state))}`}>
                Qualification: {REQUEST_STATUS_LABELS[request.qualification_state]}
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(statusTone(ops?.capture_status))}`}>
                Capture: {REQUEST_CAPTURE_STATUS_LABELS[ops?.capture_status || "not_requested"]}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={`${tab.href}${accessToken ? `?access=${encodeURIComponent(accessToken)}` : ""}`}
                className={`rounded-full px-4 py-2 text-sm ${
                  section === tab.id ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {tab.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ValueChip label="Buyer Type" value={BUYER_TYPE_LABELS[request.request.buyerType]} />
          <ValueChip label="Capture Policy" value={REQUEST_CAPTURE_POLICY_LABELS[ops?.capture_policy_tier || "review_required"]} />
          <ValueChip label="Rights" value={REQUEST_RIGHTS_STATUS_LABELS[ops?.rights_status || "unknown"]} />
          <ValueChip label="Quote Status" value={REQUEST_QUOTE_STATUS_LABELS[ops?.quote_status || "not_started"]} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <FileSearch className="h-5 w-5 text-zinc-500" />
                <h2 className="text-lg font-semibold text-zinc-950">{sectionTitle}</h2>
              </div>

              {section === "overview" ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Next step</p>
                    <p className="mt-2 text-sm text-zinc-800">{ops?.next_step || "Blueprint is reviewing the latest evidence and routing the next step."}</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Region</p>
                    <p className="mt-2 text-sm text-zinc-800">{ops?.assigned_region_id || "Managed assignment"}</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Workflow context</p>
                    <p className="mt-2 text-sm text-zinc-800">
                      {request.request.workflowContext || "Blueprint is using the submitted task statement as the current workflow baseline."}
                    </p>
                  </div>
                </div>
              ) : null}

              {section === "evidence" ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ValueChip label="Operating Constraints" value={request.request.operatingConstraints || "None supplied"} />
                    <ValueChip label="Privacy / Security" value={request.request.privacySecurityConstraints || "None supplied"} />
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Coverage summary</p>
                    <p className="mt-2 text-sm text-zinc-800">
                      {readiness?.capture_quality_summary
                        ? "Blueprint has a capture quality summary attached for this request."
                        : "Capture evidence is still being assembled or reviewed."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Rights summary</p>
                    <p className="mt-2 text-sm text-zinc-800">
                      {readiness?.rights_and_compliance?.consent_scope?.length
                        ? readiness.rights_and_compliance.consent_scope.join(", ")
                        : "Rights scope has not been finalized for buyer-facing delivery yet."}
                    </p>
                  </div>
                </div>
              ) : null}

              {section === "qualification" ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-zinc-500" />
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Buyer trust score</p>
                        <p className="mt-1 text-3xl font-semibold text-zinc-950">{trustScore?.score ?? "N/A"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      {trustScore ? `${trustScore.band} confidence` : "The qualification summary is still being finalized."}
                    </p>
                    {trustScore?.reasons?.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                        {trustScore.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Missing evidence</p>
                    {missingEvidence.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                        {missingEvidence.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-700">No buyer-facing evidence gaps are currently attached.</p>
                    )}
                  </div>
                  {ops?.recapture_reason ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-700">Recapture guidance</p>
                      <p className="mt-2 text-sm text-amber-800">{ops.recapture_reason}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {section === "preview" ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ValueChip label="Preview Status" value={String(readiness?.preview_status || "not_requested").replaceAll("_", " ")} />
                    <ValueChip label="Provider" value={previewRun?.provider_name || "Not assigned"} />
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Provenance</p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {previewRun?.provider_model
                        ? `${previewRun.provider_name} · ${previewRun.provider_model}`
                        : "Preview generation is optional and may not be attached for this request."}
                    </p>
                    {(previewRun?.cost_usd ?? null) !== null || (previewRun?.latency_ms ?? null) !== null ? (
                      <p className="mt-2 text-sm text-zinc-600">
                        {previewRun?.cost_usd != null ? `Cost $${previewRun.cost_usd.toFixed(2)}` : "Cost pending"}
                        {previewRun?.latency_ms != null ? ` · ${Math.round(previewRun.latency_ms)} ms` : ""}
                      </p>
                    ) : null}
                    {previewRun?.failure_reason ? (
                      <p className="mt-3 text-sm text-rose-700">{previewRun.failure_reason}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-zinc-500" />
                <h2 className="text-lg font-semibold text-zinc-950">Current State</h2>
              </div>
              <div className="mt-5 space-y-3">
                <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(statusTone(request.qualification_state))}`}>
                  Qualification: {REQUEST_STATUS_LABELS[request.qualification_state]}
                </div>
                <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(statusTone(request.opportunity_state))}`}>
                  Opportunity: {OPPORTUNITY_STATE_LABELS[request.opportunity_state]}
                </div>
                <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(statusTone(ops?.capture_policy_tier))}`}>
                  Capture policy: {REQUEST_CAPTURE_POLICY_LABELS[ops?.capture_policy_tier || "review_required"]}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <MapPinned className="h-5 w-5 text-zinc-500" />
                <h2 className="text-lg font-semibold text-zinc-950">Capture Readiness</h2>
              </div>
              <div className="mt-5 grid gap-3">
                <ValueChip label="Region" value={ops?.assigned_region_id || "Managed assignment"} />
                <ValueChip label="Rights" value={REQUEST_RIGHTS_STATUS_LABELS[ops?.rights_status || "unknown"]} />
                <ValueChip label="Capture Status" value={REQUEST_CAPTURE_STATUS_LABELS[ops?.capture_status || "not_requested"]} />
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-zinc-500" />
                <h2 className="text-lg font-semibold text-zinc-950">Next Lane</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-700">
                {ops?.next_step || "Blueprint will route the next lane once the qualification record is stable."}
              </p>
              <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
                Preview generation and world-model delivery remain downstream of the qualification record and do not replace it as source of truth.
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <Radar className="h-5 w-5 text-zinc-500" />
                <h2 className="text-lg font-semibold text-zinc-950">Preview Status</h2>
              </div>
              <p className="mt-4 text-sm text-zinc-700">
                {readiness?.preview_status
                  ? `Current preview status: ${String(readiness.preview_status).replaceAll("_", " ")}.`
                  : "No preview run has been attached yet."}
              </p>
              {previewRun?.provider_name ? (
                <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-zinc-500" />
                    {previewRun.provider_name}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
