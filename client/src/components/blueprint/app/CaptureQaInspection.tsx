import { Tag } from "@/components/workspace/WorkspaceUI";
import type { CaptureQaInspection as CaptureQaInspectionValue } from "@/lib/captureUploads";

const statusLabels: Record<CaptureQaInspectionValue["status"], [string, "green" | "red" | "neutral"]> = {
  accepted: ["Accepted", "green"],
  recapture_required: ["Recapture needed", "red"],
  rejected: ["Rejected", "red"],
  analysis_required: ["Needs more analysis", "neutral"],
};

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** The check result and what to recapture; the raw checks stay in a closed drawer. */
export function CaptureQaInspection({ inspection }: { inspection: CaptureQaInspectionValue }) {
  const report = inspection.publication.report;
  const [label, tone] = statusLabels[inspection.status] || [humanize(inspection.status), "neutral"];
  const next = report.next_cheapest_experiment;

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
    <section aria-labelledby="capture-qa-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="capture-qa-heading">Capture check</h2>
        <Tag tone={tone}>{label}</Tag>
      </div>
      <p className="mt-2 text-sm text-ink-600">Passing means this file is good enough to work from.</p>

      {report.recapture_plan.length ? (
        <>
          <h3 className="mt-6 text-lg">What to recapture</h3>
          <ol className="mt-3 flex flex-col">
            {report.recapture_plan.map((step) => (
              <li key={step.code} className="border-t border-line py-3">
                <p className="font-medium">{step.instruction}</p>
                <p className="mt-1 text-sm text-ink-500">{step.reason}</p>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {report.missing_evidence.length ? (
        <p className="mt-4">Missing: {report.missing_evidence.map(humanize).join(", ")}.</p>
      ) : null}
      {next ? (
        <p className="mt-2">Next: {String(next.instruction || humanize(String(next.kind || "see the full check")))}</p>
      ) : null}

      <details className="mt-6">
        <summary>All checks</summary>
        <button type="button" className="ws-link" onClick={download}>Download the check (JSON)</button>
        <p className="mt-2 break-all text-xs text-ink-500">{inspection.publication.qa_report_digest}</p>
        <pre className="mt-3 max-h-[32rem] overflow-auto text-xs leading-relaxed">{JSON.stringify(report, null, 2)}</pre>
      </details>
    </section>
  );
}
