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
import { SEO } from "@/components/SEO";
import {
  SurfaceBrowserFrame,
  SurfaceCard,
  SurfaceMiniLabel,
  SurfacePage,
  SurfaceSection,
  SurfaceStatusList,
  SurfaceTopBar,
} from "@/components/site/privateSurface";
import { withCsrfHeader } from "@/lib/csrf";
import { analyticsEvents } from "@/lib/analytics";
import {
  getDemandAttributionFromContext,
  hasDemandAttribution,
} from "@/lib/demandAttribution";
import { privateGeneratedAssets } from "@/lib/privateGeneratedAssets";
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
      { id: "qualification", label: "Review", href: `/requests/${params.requestId}/qualification` },
      { id: "preview", label: "Preview", href: `/requests/${params.requestId}/preview` },
    ],
    [params.requestId]
  );

  if (bootstrapMutation.isPending || (!bootstrapReady && accessToken)) {
    return (
      <SurfacePage>
        <SEO title="Buyer Review | Blueprint" description="Private buyer review workspace." noIndex />
        <SurfaceTopBar eyebrow="Buyer Review" rightLabel="Private Workspace" />
        <SurfaceSection className="py-12">
          <SurfaceBrowserFrame>
            <div className="grid min-h-[36rem] place-items-center bg-[#f8f4ec] p-8">
              <div className="max-w-xl text-center">
                <SurfaceMiniLabel>Private Review Link</SurfaceMiniLabel>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.08em] text-[#111110]">
                  Validating review link
                </h1>
                <p className="mt-4 text-sm leading-7 text-black/60">
                  Blueprint is checking whether this private review URL still maps to an active
                  buyer workspace.
                </p>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    );
  }

  if (bootstrapMutation.isError) {
    return (
      <SurfacePage>
        <SEO title="Buyer Review | Blueprint" description="Private buyer review workspace." noIndex />
        <SurfaceTopBar eyebrow="Buyer Review" rightLabel="Private Workspace" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid gap-0 xl:grid-cols-[0.4fr_0.6fr]">
              <div className="bg-[#f4efe6] p-8 lg:p-10">
                <SurfaceMiniLabel>Private Access</SurfaceMiniLabel>
                <h1 className="mt-5 text-[clamp(3rem,5vw,4.8rem)] font-semibold tracking-[-0.08em] leading-[0.92]">
                  Review link required
                </h1>
                <p className="mt-4 max-w-[24rem] text-sm leading-7 text-black/60">
                  This request is private to the buyer review flow. Ask Blueprint to resend the
                  current review link so the exact-site evidence room opens with the correct access
                  token attached.
                </p>
              </div>
              <div className="bg-white p-8 lg:p-10">
                <div className="overflow-hidden rounded-[1.7rem] border border-black/10">
                  <img
                    src={privateGeneratedAssets.privateFacilityAerial}
                    alt="Blueprint private facility review"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-6 rounded-[1.35rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                  Review links are request-scoped and expire when the protected workspace changes.
                </div>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    );
  }

  if (requestQuery.isLoading) {
    return (
      <SurfacePage>
        <SEO title="Buyer Review | Blueprint" description="Private buyer review workspace." noIndex />
        <SurfaceTopBar eyebrow="Buyer Review" rightLabel="Private Workspace" />
        <SurfaceSection className="py-12">
          <SurfaceBrowserFrame>
            <div className="grid min-h-[36rem] place-items-center bg-[#f8f4ec] p-8">
              <div className="max-w-xl text-center">
                <SurfaceMiniLabel>Protected Request</SurfaceMiniLabel>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.08em] text-[#111110]">
                  Loading request
                </h1>
                <p className="mt-4 text-sm leading-7 text-black/60">
                  Blueprint is pulling the current review, evidence, and provenance state for
                  this exact-site request.
                </p>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <SurfacePage>
        <SEO title="Buyer Review | Blueprint" description="Private buyer review workspace." noIndex />
        <SurfaceTopBar eyebrow="Buyer Review" rightLabel="Private Workspace" />
        <SurfaceSection className="py-8">
          <SurfaceBrowserFrame>
            <div className="grid gap-0 xl:grid-cols-[0.42fr_0.58fr]">
              <div className="bg-[#f4efe6] p-8 lg:p-10">
                <SurfaceMiniLabel>Protected Request</SurfaceMiniLabel>
                <h1 className="mt-5 text-[clamp(3rem,5vw,4.8rem)] font-semibold tracking-[-0.08em] leading-[0.92]">
                  Request unavailable
                </h1>
                <p className="mt-4 max-w-[24rem] text-sm leading-7 text-black/60">
                  Blueprint could not load this request. The review link may be missing, expired,
                  or the record may still be processing into the buyer-facing workspace.
                </p>
              </div>
              <div className="bg-white p-8 lg:p-10">
                <div className="overflow-hidden rounded-[1.7rem] border border-black/10">
                  <img
                    src={privateGeneratedAssets.facilityPlanBoard}
                    alt="Blueprint request provenance board"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-6 rounded-[1.35rem] border border-black/10 bg-[#faf6ef] p-5 text-sm leading-7 text-black/60">
                  Buyer review links only open once the protected request room has a valid record
                  behind it.
                </div>
              </div>
            </div>
          </SurfaceBrowserFrame>
        </SurfaceSection>
      </SurfacePage>
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
      ? "Readiness review"
      : section === "preview"
      ? "Preview and provenance"
      : "Request overview";

  return (
    <SurfacePage>
      <SEO title="Buyer Review | Blueprint" description="Private buyer review workspace." noIndex />
      <SurfaceTopBar eyebrow="Buyer Review" rightLabel="Private Workspace" />
      <SurfaceSection className="py-8">
        <SurfaceBrowserFrame>
          <div className="bg-[#f8f4ed] p-6 lg:p-7">
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.22fr] xl:items-start">
              <div className="flex gap-5">
                <div className="hidden h-28 w-40 shrink-0 overflow-hidden rounded-[1.3rem] border border-black/10 bg-white md:block">
                  <img
                    src={privateGeneratedAssets.privateFacilityAerial}
                    alt={request.request.siteName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <SurfaceMiniLabel>Buyer Review {request.site_submission_id}</SurfaceMiniLabel>
                  <h1 className="mt-3 text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.08em] leading-[0.94] text-[#111110]">
                    {request.request.siteName}
                  </h1>
                  <p className="mt-2 text-sm text-black/55">{request.request.siteLocation}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">
                    {request.request.taskStatement}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(statusTone(request.qualification_state))}`}>
                      {REQUEST_STATUS_LABELS[request.qualification_state]}
                    </span>
                    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(statusTone(ops?.capture_status))}`}>
                      {REQUEST_CAPTURE_STATUS_LABELS[ops?.capture_status || "not_requested"]}
                    </span>
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/50">
                      Protected
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-black/10 bg-white px-5 py-4 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">Trust score</p>
                <p className="mt-3 text-[3rem] font-semibold tracking-[-0.08em] text-[#111110]">
                  {trustScore?.score ?? "N/A"}
                </p>
                <p className="text-sm text-black/50">{trustScore?.band || "Pending review"}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <a
                  key={tab.id}
                  href={`${tab.href}${accessToken ? `?access=${encodeURIComponent(accessToken)}` : ""}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    section === tab.id
                      ? "bg-[#111110] text-white"
                      : "border border-black/10 bg-white text-black/60 hover:bg-[#f5f0e7]"
                  }`}
                >
                  {tab.label}
                </a>
              ))}
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
              <div className="space-y-5">
                <SurfaceCard className="bg-white">
                  <div className="flex items-center gap-3">
                    <FileSearch className="h-5 w-5 text-black/45" />
                    <div>
                      <SurfaceMiniLabel>{sectionTitle}</SurfaceMiniLabel>
                      <p className="mt-1 text-sm text-black/55">
                        Exact-site request status, evidence, readiness, and preview provenance.
                      </p>
                    </div>
                  </div>

                  {section === "overview" ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <ValueChip label="Next step" value={ops?.next_step || "Blueprint is reviewing the latest evidence."} />
                      <ValueChip label="Region" value={ops?.assigned_region_id || "Managed assignment"} />
                      <ValueChip label="Buyer type" value={BUYER_TYPE_LABELS[request.request.buyerType]} />
                      <ValueChip label="Quote status" value={REQUEST_QUOTE_STATUS_LABELS[ops?.quote_status || "not_started"]} />
                      <div className="rounded-2xl border border-zinc-200 bg-[#faf6ef] p-4 md:col-span-2">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Workflow context</p>
                        <p className="mt-2 text-sm leading-7 text-zinc-800">
                          {request.request.workflowContext || "Blueprint is using the submitted task statement as the current workflow baseline."}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {section === "evidence" ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <ValueChip label="Operating constraints" value={request.request.operatingConstraints || "None supplied"} />
                      <ValueChip label="Privacy / Security" value={request.request.privacySecurityConstraints || "None supplied"} />
                      <ValueChip
                        label="Coverage summary"
                        value={readiness?.capture_quality_summary ? "Attached" : "Still assembling"}
                      />
                      <ValueChip
                        label="Rights summary"
                        value={
                          readiness?.rights_and_compliance?.consent_scope?.length
                            ? readiness.rights_and_compliance.consent_scope.join(", ")
                            : "Pending"
                        }
                      />
                    </div>
                  ) : null}

                  {section === "qualification" ? (
                    <div className="mt-5 grid gap-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <ValueChip label="Buyer trust score" value={trustScore ? `${trustScore.score} / ${trustScore.band}` : "Pending"} />
                        <ValueChip label="Missing evidence" value={missingEvidence.length ? `${missingEvidence.length} item(s)` : "None attached"} />
                      </div>
                      {trustScore?.reasons?.length ? (
                        <div className="rounded-2xl border border-zinc-200 bg-[#faf6ef] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Why this score exists</p>
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                            {trustScore.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {ops?.recapture_reason ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          Recapture guidance: {ops.recapture_reason}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {section === "preview" ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-[0.56fr_0.44fr]">
                      <div className="overflow-hidden rounded-[1.4rem] border border-black/10 bg-white">
                        <img
                          src={privateGeneratedAssets.facilityPlanBoard}
                          alt="Blueprint provenance board"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-4">
                        <ValueChip label="Preview status" value={String(readiness?.preview_status || "not_requested").replaceAll("_", " ")} />
                        <ValueChip label="Provider" value={previewRun?.provider_name || "Not assigned"} />
                        <ValueChip
                          label="Provenance"
                          value={
                            previewRun?.provider_model
                              ? `${previewRun.provider_name} · ${previewRun.provider_model}`
                              : "Preview generation is optional and may not be attached."
                          }
                        />
                        {previewRun?.failure_reason ? (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {previewRun.failure_reason}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </SurfaceCard>
              </div>

              <div className="space-y-5">
                <SurfaceCard className="bg-white">
                  <div className="flex items-center gap-3">
                    <Clock3 className="h-5 w-5 text-black/45" />
                    <div>
                      <SurfaceMiniLabel>Current State</SurfaceMiniLabel>
                      <p className="mt-1 text-sm text-black/55">Live request status across review, rights, and capture.</p>
                    </div>
                  </div>
                  <SurfaceStatusList
                    className="mt-5"
                    items={[
                      { label: "Readiness", value: REQUEST_STATUS_LABELS[request.qualification_state] },
                      { label: "Opportunity", value: OPPORTUNITY_STATE_LABELS[request.opportunity_state] },
                      { label: "Capture policy", value: REQUEST_CAPTURE_POLICY_LABELS[ops?.capture_policy_tier || "review_required"] },
                    ]}
                  />
                </SurfaceCard>

                <SurfaceCard className="bg-white">
                  <div className="flex items-center gap-3">
                    <MapPinned className="h-5 w-5 text-black/45" />
                    <div>
                      <SurfaceMiniLabel>Request Details</SurfaceMiniLabel>
                      <p className="mt-1 text-sm text-black/55">Protected metadata tied to this buyer review.</p>
                    </div>
                  </div>
                  <SurfaceStatusList
                    className="mt-5"
                    items={[
                      { label: "Request ID", value: request.requestId },
                      { label: "Rights", value: REQUEST_RIGHTS_STATUS_LABELS[ops?.rights_status || "unknown"] },
                      { label: "Capture status", value: REQUEST_CAPTURE_STATUS_LABELS[ops?.capture_status || "not_requested"] },
                      { label: "Requested on", value: request.createdAt || "Pending" },
                    ]}
                  />
                </SurfaceCard>

                <SurfaceCard className="bg-[#111110] text-white">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-white/60" />
                    <div>
                      <SurfaceMiniLabel className="text-white/40">Next Step</SurfaceMiniLabel>
                      <p className="mt-1 text-sm text-white/70">
                        Preview generation waits for the review record.
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-base leading-7 text-white/80">
                    {ops?.next_step || "Blueprint will route the next step once the review record is stable."}
                  </p>
                  {previewRun?.provider_name ? (
                    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                      <BadgeCheck className="h-4 w-4" />
                      {previewRun.provider_name}
                    </div>
                  ) : null}
                </SurfaceCard>

                <SurfaceCard className="bg-white">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-black/45" />
                    <div>
                      <SurfaceMiniLabel>Dry-Run Boundary</SurfaceMiniLabel>
                      <p className="mt-1 text-sm text-black/55">
                        What this protected room can and cannot claim yet.
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-black/60">
                    This console shows request state, buyer context, and attached evidence labels.
                    Package files, provider previews, live hosted sessions, payment, and fulfillment
                    stay blocked until the backing record explicitly supports them.
                  </p>
                </SurfaceCard>

                <SurfaceCard className="bg-white">
                  <div className="flex items-center gap-3">
                    <Radar className="h-5 w-5 text-black/45" />
                    <div>
                      <SurfaceMiniLabel>Preview Status</SurfaceMiniLabel>
                      <p className="mt-1 text-sm text-black/55">Provider-backed preview state when attached.</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-black/60">
                    {readiness?.preview_status
                      ? `Current preview status: ${String(readiness.preview_status).replaceAll("_", " ")}.`
                      : "No preview run has been attached yet."}
                  </p>
                </SurfaceCard>
              </div>
            </div>
          </div>
        </SurfaceBrowserFrame>
      </SurfaceSection>
    </SurfacePage>
  );
}
