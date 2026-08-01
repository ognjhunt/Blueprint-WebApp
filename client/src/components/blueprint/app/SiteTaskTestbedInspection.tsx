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
  const semanticObjects = Array.isArray(testbed.semantic_object_inventory)
    ? testbed.semantic_object_inventory
    : [];

  function metricVector(value: unknown, digits = 3) {
    if (!Array.isArray(value) || value.length !== 3) return null;
    const numbers = value.map(Number);
    if (!numbers.every(Number.isFinite)) return null;
    return numbers.map((item) => item.toFixed(digits)).join(", ");
  }

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

      {semanticObjects.length ? (
        <Card pad="lg">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
                Semantic object candidates
              </h3>
              <p className="mt-2 max-w-3xl text-body-s text-ink-600">
                Pipeline-projected object hypotheses and metric boxes from observed multi-view support. These candidates remain separate from collision geometry and physics qualification.
              </p>
            </div>
            <StatusChip tone="warn" square>Candidate evidence only</StatusChip>
          </div>
          <ul className="mt-5 grid gap-3 lg:grid-cols-2">
            {semanticObjects.map((object) => {
              const center = metricVector(object.center_world_m);
              const dimensions = metricVector(object.dimensions_m);
              const qualified = object.semantic_status === "qualified_metric_obb_candidate";
              return (
                <li key={object.track_id} className="rounded-md border border-line bg-surface-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="text-body-s font-semibold text-ink-900">
                        {object.label || "Unlabeled object"}
                      </h4>
                      <p className="mt-1 font-mono text-[0.68rem] text-ink-500">{object.track_id}</p>
                    </div>
                    <StatusChip tone={qualified ? "proof" : "warn"} square>
                      {qualified ? "Metric box candidate" : "Abstained"}
                    </StatusChip>
                  </div>
                  {qualified && center && dimensions ? (
                    <dl className="mt-4 grid gap-3 text-body-s sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-400">Center (m, Z-up)</dt>
                        <dd className="mt-1 font-mono text-ink-700">{center}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-400">Dimensions (m)</dt>
                        <dd className="mt-1 font-mono text-ink-700">{dimensions}</dd>
                      </div>
                    </dl>
                  ) : null}
                  <p className="mt-4 text-body-s text-ink-600">
                    Collision consistency: {object.collision_consistency_status.replace(/_/g, " ")}.
                    {" "}This does not establish collision, contact, physical success, or deployment readiness.
                  </p>
                  {typeof object.next_experiment === "string" && object.next_experiment ? (
                    <p className="mt-2 text-body-s text-ink-600">
                      <strong>Next experiment:</strong> {object.next_experiment.replace(/_/g, " ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <details className="rounded-md border border-line bg-white p-4">
        <summary className="cursor-pointer text-body-s font-semibold text-ink-800">Inspect exact Cards, layers, transforms, and provenance</summary>
        <pre className="mt-4 max-h-[32rem] overflow-auto rounded-md bg-ink-950 p-4 text-[0.7rem] leading-relaxed text-white">
          {JSON.stringify(testbed, null, 2)}
        </pre>
      </details>
    </section>
  );
}
