import { useState } from "react";
import { PlayCircle } from "lucide-react";
import type { SiteLibrarySite } from "@/data/siteLibrary";
import { buildRobotEvalJobRequestFromSite } from "@/lib/robotEvalJobRequest";

type StatusState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "queued"; jobId: string }
  | { kind: "error"; message: string };

export function RobotEvalJobRequestButton({
  site,
  source,
  className,
}: {
  site: SiteLibrarySite;
  source: "sites" | "site-detail";
  className?: string;
}) {
  const [status, setStatus] = useState<StatusState>({ kind: "idle" });
  const disabled =
    status.kind === "submitting" ||
    !site.robotEvalPublication?.readyToEvaluatePublishable ||
    !site.defaultRobotEvalSelection;

  async function submitJobRequest() {
    try {
      setStatus({ kind: "submitting" });
      const jobRequest = buildRobotEvalJobRequestFromSite(site, {
        route: `/sites/${site.slug}`,
        surface: source,
      });
      const response = await fetch("/api/robot-eval/job-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobRequest),
      });
      const data = (await response.json()) as {
        jobRequest?: { job_id?: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || `Request failed with ${response.status}`);
      }
      setStatus({
        kind: "queued",
        jobId: data.jobRequest?.job_id || jobRequest.job_id,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Request failed",
      });
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={submitJobRequest}
        className={
          className ||
          "inline-flex min-h-11 items-center justify-center border border-black/10 px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55"
        }
      >
        <PlayCircle className="mr-2 h-4 w-4" />
        {status.kind === "submitting" ? "Creating request" : "Create eval job request"}
      </button>
      {status.kind === "queued" ? (
        <p className="mt-2 text-xs font-semibold text-emerald-800">{status.jobId}</p>
      ) : null}
      {status.kind === "error" ? (
        <p className="mt-2 text-xs font-semibold text-red-700">{status.message}</p>
      ) : null}
    </div>
  );
}
