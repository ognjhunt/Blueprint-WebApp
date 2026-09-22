import { Tag } from "@/components/workspace/WorkspaceUI";
import type { CaptureSiteTaskTestbedInspection } from "@/lib/captureUploads";

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function metricVector(value: unknown, digits = 3) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const numbers = value.map(Number);
  if (!numbers.every(Number.isFinite)) return null;
  return numbers.map((item) => item.toFixed(digits)).join(", ");
}

/** What the testbed doesn't cover up front; objects, evidence, and the exact file stay in drawers. */
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
    <section aria-labelledby="site-task-testbed-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="site-task-testbed-heading">Testbed</h2>
        <Tag tone="green">Ready</Tag>
      </div>
      <p className="mt-2 break-all text-sm text-ink-500">{String(testbed.testbed_id)} · version {String(testbed.version)}</p>

      {unsupported.length ? (
        <>
          <h3 className="mt-6 text-lg">Not covered</h3>
          <ul className="mt-2 list-disc pl-5">
            {unsupported.map((item) => <li key={item}>{humanize(item)}</li>)}
          </ul>
        </>
      ) : null}

      {semanticObjects.length ? (
        <details className="mt-6">
          <summary>Objects found ({semanticObjects.length})</summary>
          <p className="text-sm text-ink-600">Object boxes are estimates from the capture, kept separate from collision geometry.</p>
          <ul className="mt-3 flex flex-col">
            {semanticObjects.map((object) => {
              const center = metricVector(object.center_world_m);
              const dimensions = metricVector(object.dimensions_m);
              const measured = object.semantic_status === "qualified_metric_obb_candidate";
              return (
                <li key={object.track_id} className="border-t border-line py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <strong className="font-medium">{object.label || "Unlabeled object"}</strong>
                    <Tag tone={measured ? "green" : "neutral"}>{measured ? "Box measured" : "Not measured"}</Tag>
                  </div>
                  {measured && center && dimensions ? (
                    <p className="mt-1 tabular-nums">Center {center} m (Z up) · size {dimensions} m</p>
                  ) : null}
                  <p className="mt-1 text-ink-600">Collision check: {humanize(object.collision_consistency_status).toLowerCase()}.</p>
                  {typeof object.next_experiment === "string" && object.next_experiment ? (
                    <p className="mt-1 text-ink-600">Next: {humanize(object.next_experiment)}</p>
                  ) : null}
                  <p className="mt-1 break-all text-xs text-ink-500">{object.track_id}</p>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      <details className={semanticObjects.length ? undefined : "mt-6"}>
        <summary>Evidence and files</summary>
        {evidence.length ? (
          <ul className="text-sm">
            {evidence.map((row, index) => (
              <li key={`${String(row.evidence_id || "evidence")}-${index}`}>
                {String(row.evidence_id || "evidence")} · {humanize(String(row.status || row.authority || "recorded"))}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 break-all text-xs text-ink-500">{String(testbed.testbed_digest)}</p>
        <button type="button" className="ws-link mt-3" onClick={download}>Download the testbed (JSON)</button>
        <pre className="mt-3 max-h-[32rem] overflow-auto text-xs leading-relaxed">{JSON.stringify(testbed, null, 2)}</pre>
      </details>
    </section>
  );
}
