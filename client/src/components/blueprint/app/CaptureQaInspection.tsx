import { Download, ScanSearch, ShieldAlert } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import type { CaptureQaInspection as CaptureQaInspectionValue } from "@/lib/captureUploads";

function tone(status: CaptureQaInspectionValue["status"]): "proof" | "warn" | "block" | "neutral" {
  if (status === "accepted") return "proof";
  if (status === "rejected") return "block";
  if (status === "recapture_required") return "warn";
  return "neutral";
}

export function CaptureQaInspection({ inspection }: { inspection: CaptureQaInspectionValue }) {
  const report = inspection.publication.report;

  function download() {
    const blob = new Blob([`${JSON.stringify(inspection.publication, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `capture-qa-${inspection.publication.qa_report_digest.slice(7, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="capture-qa-heading">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <StatusChip tone={tone(inspection.status)} square>{inspection.status.replace(/_/g, " ")}</StatusChip>
          <h2 id="capture-qa-heading" className="mt-3 text-title-l font-semibold tracking-tight text-ink-900">
            Capture QA
          </h2>
          <p className="mt-2 font-mono text-[0.72rem] text-ink-500">
            {inspection.publication.qa_report_digest}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" iconLeft={<Download />} onClick={download}>
          Download exact QA JSON
        </Button>
      </div>

      <ProofBoundary level="warn" title="Capture boundary" icon={ShieldAlert}>
        Capture acceptance means this exact input passed the named QA envelope. It is not reconstruction, task success, physical success, deployment readiness, safety certification, or comparative policy-ranking support.
      </ProofBoundary>

      {report.recapture_plan.length ? (
        <Card pad="lg">
          <h3 className="flex items-center gap-2 text-title-m font-semibold text-ink-900"><ScanSearch className="size-5" /> Exact recapture request</h3>
          <ol className="mt-4 space-y-4">
            {report.recapture_plan.map((step) => (
              <li key={step.code} className="rounded-md border border-line bg-inset p-4">
                <p className="font-mono text-[0.7rem] text-ink-400">{step.code}</p>
                <p className="mt-1 text-body-s font-semibold text-ink-900">{step.instruction}</p>
                <p className="mt-1 text-body-xs text-ink-500">{step.reason}</p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <Card pad="lg" className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">Missing evidence</h3>
          {report.missing_evidence.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-body-s text-ink-600">
              {report.missing_evidence.map((item) => <li key={item}>{item.replace(/_/g, " ")}</li>)}
            </ul>
          ) : <p className="mt-2 text-body-s text-ink-600">No missing evidence recorded for this QA envelope.</p>}
        </div>
        <div>
          <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">Next cheapest experiment</h3>
          <p className="mt-2 text-body-s text-ink-600">
            {report.next_cheapest_experiment
              ? String(report.next_cheapest_experiment.instruction || report.next_cheapest_experiment.kind || "Inspect the exact report.")
              : "No additional capture experiment requested by this QA report."}
          </p>
        </div>
      </Card>

      <details className="rounded-md border border-line bg-paper-0 p-4">
        <summary className="cursor-pointer text-body-s font-semibold text-ink-800">Inspect all deterministic QA checks</summary>
        <pre className="mt-4 max-h-[32rem] overflow-auto rounded-md bg-runway-black p-4 text-[0.7rem] leading-relaxed text-white">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </section>
  );
}
