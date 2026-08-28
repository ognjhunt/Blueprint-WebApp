import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button, Card, ProofBoundary } from "@/components/blueprint";
import type { CaptureTestbedCompilationCommand } from "@/lib/captureUploads";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-line bg-paper-0 px-3 py-2.5 text-body-s text-ink-900 shadow-sm outline-none focus:border-action focus:ring-2 focus:ring-action/20";
const labelClass = "text-body-s font-semibold text-ink-800";

function defaultDeadline() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function TestbedCompilationControl({
  sceneId,
  busy,
  onCompile,
}: {
  sceneId: string;
  busy: boolean;
  onCompile: (command: CaptureTestbedCompilationCommand) => void;
}) {
  const [robotId, setRobotId] = useState("");
  const [embodimentVersion, setEmbodimentVersion] = useState("");
  const [radius, setRadius] = useState("");
  const [sensorId, setSensorId] = useState("");
  const [controllerId, setControllerId] = useState("");
  const [endEffectorId, setEndEffectorId] = useState("");
  const [minimumReach, setMinimumReach] = useState("0");
  const [maximumReach, setMaximumReach] = useState("");
  const [falseSafeConsequence, setFalseSafeConsequence] = useState<
    CaptureTestbedCompilationCommand["false_safe_consequence"]
  >("moderate");
  const [maxRisk, setMaxRisk] = useState("0.05");
  const [minimumCoverage, setMinimumCoverage] = useState("0.9");
  const [minimumMethods, setMinimumMethods] = useState("1");
  const [maxCost, setMaxCost] = useState("0");
  const [maxLatency, setMaxLatency] = useState("60");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [idempotencyKey] = useState(() => `web-testbed-${crypto.randomUUID()}`);

  const valid = [
    sceneId,
    robotId,
    embodimentVersion,
    radius,
    sensorId,
    controllerId,
    endEffectorId,
    maximumReach,
    deadline,
  ].every((value) => value.trim()) && Number(radius) > 0 && Number(maximumReach) > Number(minimumReach);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="testbed-compile-heading">
      <div>
        <h2 id="testbed-compile-heading" className="text-title-l font-semibold tracking-tight text-ink-900">
          Compile the maintained testbed
        </h2>
        <p className="mt-2 max-w-3xl text-body-s text-ink-500">
          Bind the approved task to the exact robot and decision limits. Pipeline owns
          SimReady, placement, qualification, and verdict calculations.
        </p>
      </div>
      <ProofBoundary level="warn" title="Placement remains evidence-gated" icon={AlertTriangle}>
        These fields identify the robot and customer decision constraints. They do not
        assert a valid base placement. Pipeline will abstain and request the cheapest
        missing evidence until a qualified placement method has enough captured coverage.
      </ProofBoundary>
      <Card pad="lg" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label><span className={labelClass}>Robot ID</span><input className={fieldClass} value={robotId} onChange={(event) => setRobotId(event.target.value)} placeholder="franka-panda" /></label>
        <label><span className={labelClass}>Embodiment version</span><input className={fieldClass} value={embodimentVersion} onChange={(event) => setEmbodimentVersion(event.target.value)} placeholder="1" /></label>
        <label><span className={labelClass}>Circular footprint radius (m)</span><input className={fieldClass} type="number" min="0.001" step="0.001" value={radius} onChange={(event) => setRadius(event.target.value)} /></label>
        <label><span className={labelClass}>Primary sensor ID</span><input className={fieldClass} value={sensorId} onChange={(event) => setSensorId(event.target.value)} placeholder="wrist-rgb-v1" /></label>
        <label><span className={labelClass}>Controller ID</span><input className={fieldClass} value={controllerId} onChange={(event) => setControllerId(event.target.value)} placeholder="joint-position-v1" /></label>
        <label><span className={labelClass}>End effector ID</span><input className={fieldClass} value={endEffectorId} onChange={(event) => setEndEffectorId(event.target.value)} placeholder="parallel-gripper-v1" /></label>
        <label><span className={labelClass}>Minimum reach (m)</span><input className={fieldClass} type="number" min="0" step="0.001" value={minimumReach} onChange={(event) => setMinimumReach(event.target.value)} /></label>
        <label><span className={labelClass}>Maximum reach (m)</span><input className={fieldClass} type="number" min="0.001" step="0.001" value={maximumReach} onChange={(event) => setMaximumReach(event.target.value)} /></label>
        <label><span className={labelClass}>False-safe consequence</span><select className={fieldClass} value={falseSafeConsequence} onChange={(event) => setFalseSafeConsequence(event.target.value as typeof falseSafeConsequence)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <label><span className={labelClass}>Maximum false-safe risk</span><input className={fieldClass} type="number" min="0" max="1" step="0.01" value={maxRisk} onChange={(event) => setMaxRisk(event.target.value)} /></label>
        <label><span className={labelClass}>Minimum evidence coverage</span><input className={fieldClass} type="number" min="0.01" max="1" step="0.01" value={minimumCoverage} onChange={(event) => setMinimumCoverage(event.target.value)} /></label>
        <label><span className={labelClass}>Minimum independent methods</span><input className={fieldClass} type="number" min="1" max="8" step="1" value={minimumMethods} onChange={(event) => setMinimumMethods(event.target.value)} /></label>
        <label><span className={labelClass}>Maximum evidence cost (USD)</span><input className={fieldClass} type="number" min="0" step="0.01" value={maxCost} onChange={(event) => setMaxCost(event.target.value)} /></label>
        <label><span className={labelClass}>Maximum latency (seconds)</span><input className={fieldClass} type="number" min="1" step="1" value={maxLatency} onChange={(event) => setMaxLatency(event.target.value)} /></label>
        <label><span className={labelClass}>Decision deadline</span><input className={fieldClass} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
        <div className="flex items-end">
          <Button
            type="button"
            variant="action"
            disabled={busy || !valid}
            onClick={() => onCompile({
              schema_version: "capture_testbed_compilation_command.v1",
              testbed_id: `testbed-${sceneId}`.slice(0, 128),
              version: "1",
              robot_binding: {
                robot_id: robotId.trim(),
                embodiment_version: embodimentVersion.trim(),
                base_footprint: { shape: "circle", radius_m: Number(radius) },
                sensors: { primary: sensorId.trim() },
                controller_id: controllerId.trim(),
                end_effector_id: endEffectorId.trim(),
                reach_envelope: {
                  minimum_m: Number(minimumReach),
                  maximum_m: Number(maximumReach),
                },
              },
              false_safe_consequence: falseSafeConsequence,
              acceptable_false_safe_risk: Number(maxRisk),
              minimum_coverage: Number(minimumCoverage),
              minimum_independent_methods: Number(minimumMethods),
              max_cost_usd: Number(maxCost),
              max_latency_seconds: Number(maxLatency),
              deadline,
              requested_result_audience: "design_partner",
              idempotency_key: idempotencyKey,
            })}
          >{busy ? "Compiling…" : "Compile testbed"}</Button>
        </div>
      </Card>
    </section>
  );
}
