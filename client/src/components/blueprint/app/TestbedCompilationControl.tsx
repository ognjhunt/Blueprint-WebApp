import { useState } from "react";

import { Field } from "@/components/workspace/WorkspaceUI";
import type { CaptureTestbedCompilationCommand } from "@/lib/captureUploads";

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
    <section aria-labelledby="testbed-compile-heading">
      <h2 id="testbed-compile-heading">Build the testbed</h2>
      <p className="mt-2 text-ink-600">
        Describe the robot for the approved task. These details don't confirm where it can stand; if placement
        can't be checked yet, Blueprint asks for the capture it needs.
      </p>
      <div className="ws-fields mt-6">
        <Field label="Robot ID"><input value={robotId} onChange={(event) => setRobotId(event.target.value)} placeholder="franka-panda" /></Field>
        <Field label="Embodiment version"><input value={embodimentVersion} onChange={(event) => setEmbodimentVersion(event.target.value)} placeholder="1" /></Field>
        <Field label="Footprint radius (m)"><input type="number" min="0.001" step="0.001" value={radius} onChange={(event) => setRadius(event.target.value)} /></Field>
        <Field label="Primary sensor ID"><input value={sensorId} onChange={(event) => setSensorId(event.target.value)} placeholder="wrist-rgb-v1" /></Field>
        <Field label="Controller ID"><input value={controllerId} onChange={(event) => setControllerId(event.target.value)} placeholder="joint-position-v1" /></Field>
        <Field label="End effector ID"><input value={endEffectorId} onChange={(event) => setEndEffectorId(event.target.value)} placeholder="parallel-gripper-v1" /></Field>
        <Field label="Minimum reach (m)"><input type="number" min="0" step="0.001" value={minimumReach} onChange={(event) => setMinimumReach(event.target.value)} /></Field>
        <Field label="Maximum reach (m)"><input type="number" min="0.001" step="0.001" value={maximumReach} onChange={(event) => setMaximumReach(event.target.value)} /></Field>
      </div>
      <details className="mt-8">
        <summary>Decision limits</summary>
        <div className="ws-fields">
          <Field label="False-safe consequence" hint="How bad it is if a result says the robot is fine when it isn't.">
            <select value={falseSafeConsequence} onChange={(event) => setFalseSafeConsequence(event.target.value as typeof falseSafeConsequence)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></select>
          </Field>
          <Field label="Maximum false-safe risk"><input type="number" min="0" max="1" step="0.01" value={maxRisk} onChange={(event) => setMaxRisk(event.target.value)} /></Field>
          <Field label="Minimum evidence coverage"><input type="number" min="0.01" max="1" step="0.01" value={minimumCoverage} onChange={(event) => setMinimumCoverage(event.target.value)} /></Field>
          <Field label="Minimum independent methods"><input type="number" min="1" max="8" step="1" value={minimumMethods} onChange={(event) => setMinimumMethods(event.target.value)} /></Field>
          <Field label="Maximum evidence cost (USD)"><input type="number" min="0" step="0.01" value={maxCost} onChange={(event) => setMaxCost(event.target.value)} /></Field>
          <Field label="Maximum latency (seconds)"><input type="number" min="1" step="1" value={maxLatency} onChange={(event) => setMaxLatency(event.target.value)} /></Field>
          <Field label="Decision deadline" wide><input value={deadline} onChange={(event) => setDeadline(event.target.value)} /></Field>
        </div>
      </details>
      <div className="ws-form-actions">
        <button
          type="button"
          className="ws-primary"
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
        >{busy ? "Building…" : "Build the testbed"}</button>
      </div>
    </section>
  );
}
