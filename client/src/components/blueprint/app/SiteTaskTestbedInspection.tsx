import { Download, ShieldCheck } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import type { CaptureSiteTaskTestbedInspection } from "@/lib/captureUploads";

export function SiteTaskTestbedInspection({
  inspection,
}: {
  inspection: CaptureSiteTaskTestbedInspection;
}) {
  const testbed = inspection.testbed;
  const unsupported = Array.isArray(testbed.known_unsupported_conditions)
    ? testbed.known_unsupported_conditions.map(String)
    : [];
  const evidence = Array.isArray(testbed.evidence_inventory)
    ? testbed.evidence_inventory as Array<Record<string, unknown>>
    : [];

  function download() {
    const blob = new Blob([`${JSON.stringify(testbed, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(testbed.testbed_id)}-${String(testbed.version)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="site-task-testbed-heading">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <StatusChip tone="proof" square>Testbed ready</StatusChip>
          <h2 id="site-task-testbed-heading" className="mt-3 text-title-l font-semibold tracking-tight text-ink-900">
            Maintained Site-Task Testbed
          </h2>
          <p className="mt-2 font-mono text-[0.72rem] text-ink-500">
            {String(testbed.testbed_id)} · {String(testbed.version)} · {String(testbed.testbed_digest)}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" iconLeft={<Download />} onClick={download}>
          Download exact JSON
        </Button>
      </div>

      <ProofBoundary level="proof" title="Inspectable evidence boundary" icon={ShieldCheck}>
        This immutable version is bound to the approved task and source capture. Its appearance, generated regions, and simulation outputs do not establish collision truth, physical success, deployment readiness, safety certification, or comparative policy-ranking support.
      </ProofBoundary>

      <Card pad="lg" className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">Evidence inventory</h3>
          <ul className="mt-2 space-y-2 text-body-s text-ink-600">
            {evidence.map((row, index) => (
              <li key={`${String(row.evidence_id || "evidence")}-${index}`}>
                <strong>{String(row.evidence_id || "evidence")}</strong> · {String(row.status || row.authority || "recorded")}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">Unsupported conditions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-body-s text-ink-600">
            {unsupported.map((item) => <li key={item}>{item.replace(/_/g, " ")}</li>)}
          </ul>
        </div>
      </Card>

      <details className="rounded-md border border-line bg-white p-4">
        <summary className="cursor-pointer text-body-s font-semibold text-ink-800">Inspect exact Cards, layers, transforms, and provenance</summary>
        <pre className="mt-4 max-h-[32rem] overflow-auto rounded-md bg-ink-950 p-4 text-[0.7rem] leading-relaxed text-white">
          {JSON.stringify(testbed, null, 2)}
        </pre>
      </details>
    </section>
  );
}
