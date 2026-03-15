import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { withCsrfHeader } from "@/lib/csrf";
import type { InboundRequestDetail } from "@/types/inbound-request";

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

export default function RequestConsole({ params }: RequestConsoleProps) {
  const [location] = useLocation();
  const section = activeSection(location);

  const requestQuery = useQuery<InboundRequestDetail>({
    queryKey: ["request-console", params.requestId],
    queryFn: async () => {
      const response = await fetch(`/api/requests/${params.requestId}`, {
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to load request");
      return response.json();
    },
  });

  const tabs = useMemo(
    () => [
      { id: "overview", label: "Overview", href: `/requests/${params.requestId}` },
      { id: "evidence", label: "Evidence", href: `/requests/${params.requestId}/evidence` },
      {
        id: "qualification",
        label: "Qualification",
        href: `/requests/${params.requestId}/qualification`,
      },
      { id: "preview", label: "Preview", href: `/requests/${params.requestId}/preview` },
    ],
    [params.requestId]
  );

  if (requestQuery.isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-zinc-600">Loading request…</div>;
  }

  if (requestQuery.isError || !requestQuery.data) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-zinc-600">Request unavailable.</div>;
  }

  const request = requestQuery.data;
  const readiness = request.deployment_readiness;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Buyer Request {request.site_submission_id}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950">{request.request.siteName}</h1>
          <p className="mt-2 text-zinc-600">{request.request.siteLocation}</p>
          <p className="mt-4 text-sm text-zinc-700">{request.request.taskStatement}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                className={`rounded-full px-4 py-2 text-sm ${
                  section === tab.id
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {tab.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Status</p>
            <p className="mt-3 text-sm text-zinc-700">
              Qualification: {request.qualification_state}
            </p>
            <p className="mt-1 text-sm text-zinc-700">
              Opportunity: {request.opportunity_state}
            </p>
            {readiness?.buyer_trust_score ? (
              <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Buyer trust score</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950">
                  {readiness.buyer_trust_score.score}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {readiness.buyer_trust_score.band} confidence
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Preview</p>
            <p className="mt-3 text-sm text-zinc-700">
              Status: {readiness?.preview_status || "not_requested"}
            </p>
            {readiness?.provider_run?.provider_name ? (
              <p className="mt-1 text-sm text-zinc-700">
                Provider: {readiness.provider_run.provider_name}
              </p>
            ) : null}
            {readiness?.provider_run?.failure_reason ? (
              <p className="mt-3 text-sm text-rose-700">
                {readiness.provider_run.failure_reason}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            {section === "evidence"
              ? "Evidence summary"
              : section === "qualification"
              ? "Qualification package"
              : section === "preview"
              ? "Derived preview"
              : "Request summary"}
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
            {JSON.stringify(
              section === "evidence"
                ? {
                    pipeline: request.pipeline,
                    derived_assets: request.derived_assets,
                    capture_quality_summary: readiness?.capture_quality_summary,
                  }
                : section === "qualification"
                ? {
                    qualification_summary: readiness?.qualification_summary,
                    buyer_trust_score: readiness?.buyer_trust_score,
                    missing_evidence: readiness?.missing_evidence,
                  }
                : section === "preview"
                ? {
                    provider_run: readiness?.provider_run,
                    preview_status: readiness?.preview_status,
                    preview_manifest_uri: request.pipeline?.artifacts?.preview_manifest_uri,
                  }
                : request,
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
