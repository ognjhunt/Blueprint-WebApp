import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withCsrfHeader } from "@/lib/csrf";

type BlockedJob = { jobId: string; prospectId: string; briefDigest: string; attempts: number; reason: string; leaseUntil: number };
export function CommunicationsRecovery() {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const key = ["blocked-communications-jobs"];
  const jobs = useQuery<BlockedJob[]>({
    queryKey: key, enabled: expanded, retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/outbound-prospects/communications/blocked-jobs", { headers: await withCsrfHeader({}) });
      if (!response.ok) throw new Error("Could not read blocked jobs.");
      return (await response.json()).jobs;
    },
  });
  const retry = useMutation({
    mutationFn: async (job: BlockedJob) => {
      const response = await fetch(`/api/admin/outbound-prospects/${encodeURIComponent(job.prospectId)}/communications/${encodeURIComponent(job.jobId)}/retry`, {
        method: "POST", headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ briefDigest: job.briefDigest }),
      });
      if (!response.ok) throw new Error("Job is not eligible. Recheck its current context, attempt budget and active lease.");
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: key }); },
  });
  return <section className="runway-panel p-5">
    <button type="button" className="runway-cta-ghost min-h-0 px-3 py-2 text-sm" aria-expanded={expanded}
      onClick={() => setExpanded(!expanded)}>Review blocked communications jobs</button>
    {expanded && <div className="mt-3 space-y-3 text-sm text-runway-body">
      <p>After repairing the dependency, retry the same job. Its session identity, three-attempt budget and human send approval remain in force.</p>
      {jobs.isLoading && <p>Loading blocked jobs…</p>}
      {jobs.isError && <p role="alert">Could not read blocked jobs.</p>}
      {retry.isError && <p role="alert">{retry.error.message}</p>}
      {jobs.data?.length === 0 && <p>No blocked communications jobs.</p>}
      {jobs.data?.map(job => <div key={job.jobId} className="border border-runway-line p-3">
        <p>Prospect: {job.prospectId}</p><p>Job: {job.jobId}</p><p>{job.reason}</p>
        <p>{job.attempts} of 3 attempts used.</p>
        <button type="button" className="runway-cta-ghost mt-2 min-h-0 px-3 py-2 text-sm"
          disabled={retry.isPending || job.attempts >= 3 || job.leaseUntil > Date.now()}
          onClick={() => retry.mutate(job)}>Retry job</button>
      </div>)}
      {jobs.data && jobs.data.length >= 20 && <p>Showing up to 20 blocked jobs.</p>}
    </div>}
  </section>;
}
