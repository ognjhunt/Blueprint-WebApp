import { useEffect, useState } from "react";
import type { RobotConfigurationChoice, RobotDescription } from "@/types/robotDescription";
import { deploymentEmbodimentCatalog, deploymentCatalogWithDigest } from "@/lib/deploymentEmbodimentSupport";
import { robotEmbodimentSchema, type RobotEmbodiment } from "@/types/robotEmbodiment";
import { DeploymentPolicyRouteChoices } from "./DeploymentEmbodimentShortlist";

export function readRobotEmbodiment(form: FormData): RobotEmbodiment | undefined {
  const text = String(form.get("robotEmbodiment") || "").trim();
  if (!text) return undefined;
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error("Robot manifest is not valid JSON."); }
  const result = robotEmbodimentSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Robot manifest ${issue?.path.join(".") || "configuration"}: ${issue?.message || "invalid"}`);
  }
  return result.data;
}

/** The existing manifest surface carries the complete executable robot contract. */
export function RobotEmbodimentFields({ value }: { value?: RobotEmbodiment }) {
  const [text, setText] = useState(value ? JSON.stringify(value, null, 2) : "");
  const [error, setError] = useState("");
  const parsed = (() => { try { return robotEmbodimentSchema.safeParse(JSON.parse(text)); } catch { return null; } })();
  return <details className="ws-section" open={Boolean(value)}>
    <summary>Robot configuration</summary>
    <p className="ws-note">Use your actual USD model and SHA-256, joint limits and controller, reset positions,
      cameras and control rate. Two-arm configurations use <code>blueprint.robot_embodiment.v2</code> with two
      independent named grippers. Joint actions come first, followed by each gripper closure in manifest order.
      This saves a configuration; simulator execution establishes compatibility.</p>
    <label className="block text-sm">Load robot manifest JSON
      <input type="file" accept=".json,application/json" onChange={event => {
        const file = event.currentTarget.files?.[0];
        setError("");
        if (!file) return;
        if (file.size > 40000) { setError("Use a robot manifest no larger than 40 KB."); return; }
        void file.text().then(setText).catch(() => setError("The manifest file could not be read."));
      }} />
    </label>
    <label className="mt-3 block text-sm">Robot manifest (JSON)
      <textarea name="robotEmbodiment" rows={10} maxLength={40000} spellCheck={false}
        value={text} onChange={event => { setText(event.target.value); setError(""); }}
        className="mt-1 block w-full rounded border border-line bg-white p-2 font-mono text-xs" />
    </label>
    {error && <p role="alert">{error}</p>}
    {parsed?.success && <p className="mt-2 text-sm">Declared configuration: {parsed.data.embodiment_id} · {parsed.data.joints.length} joints · {parsed.data.cameras.length} cameras · {parsed.data.control_hz} Hz.</p>}
  </details>;
}

export function readRobotDescription(form: FormData, configurations: RobotConfigurationChoice[]): RobotDescription | undefined {
  const source=String(form.get("robotDescriptionSource") || "");
  if (!source) return undefined;
  if (source.startsWith("support:")) {
    const policyRouteIds=form.getAll("robotSupportPolicyRouteIds").map(String);
    const catalogDigest=String(form.get("robotSupportCatalogDigest") || "");
    if (!policyRouteIds.length) throw new Error("Choose at least one policy route for this robot.");
    if (!/^sha256:[a-f0-9]{64}$/.test(catalogDigest)) throw new Error("The robot catalog is loading. Try saving again.");
    return {source:"support_option",embodimentId:source.slice(8),catalogDigest,policyRouteIds};
  }
  if (source!=="model") {
    const configuration=configurations.find(row=>row.id===source);
    if (!configuration) throw new Error("Choose a robot model again.");
    return {source:"catalog",configurationId:configuration.id,configurationDigest:configuration.binding_digest};
  }
  return {source:"model",format:String(form.get("robotModelFormat")) as "urdf"|"usd"|"mjcf",
    reference:String(form.get("robotModelReference") || ""),
    mobility:String(form.get("robotMobility")) as "fixed"|"mobile"|"legged",
    details:String(form.get("robotModelDetails") || "")};
}

export function RobotDescriptionFields({value,configurations=[],allowSupportOptions=false}: {
  value?:RobotDescription;configurations?:RobotConfigurationChoice[];allowSupportOptions?:boolean;
}) {
  const [source,setSource]=useState(value?.source==="catalog"?value.configurationId:value?.source==="support_option"?`support:${value.embodimentId}`:value?.source || "");
  const choices=value?.source==="catalog" && !configurations.some(row=>row.id===value.configurationId)
    ? [...configurations,{id:value.configurationId,label:"Saved robot model",binding_digest:value.configurationDigest}]
    : configurations;
  const model=value?.source==="model"?value:undefined;
  const savedSupport=value?.source==="support_option"?value:undefined;
  const savedSupportRobot=savedSupport?deploymentEmbodimentCatalog.embodiments.find(row=>row.embodiment_id===savedSupport.embodimentId):undefined;
  const selectedSupport = source.startsWith("support:")
    ? deploymentEmbodimentCatalog.embodiments.find(row => row.embodiment_id === source.slice(8)) : undefined;
  const [routes, setRoutes] = useState(savedSupport?.policyRouteIds || []);
  const [currentDigest, setCurrentDigest] = useState("");
  useEffect(() => {
    if (!allowSupportOptions) return;
    let active = true;
    void deploymentCatalogWithDigest().then(value => { if (active) setCurrentDigest(value.catalog_digest); })
      .catch(() => { if (active) setCurrentDigest(""); });
    return () => { active = false; };
  }, [allowSupportOptions]);
  const supportUnchanged = savedSupport && source === `support:${savedSupport.embodimentId}`
    && JSON.stringify(routes) === JSON.stringify(savedSupport.policyRouteIds);
  const input="mt-1 block w-full rounded border border-line bg-white p-2";
  return <fieldset className="space-y-3 border-t border-line pt-4">
    <legend className="px-1 font-medium">Physical robot</legend>
    <label className="block text-sm">Robot model
      <select name="robotDescriptionSource" value={source} onChange={event=>{
        setSource(event.target.value);
        setRoutes(event.target.value === `support:${savedSupport?.embodimentId}` ? savedSupport?.policyRouteIds || [] : []);
      }} className={input} required>
        <option value="">Choose a robot model</option>
        {choices.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
        {allowSupportOptions ? deploymentEmbodimentCatalog.embodiments.map(robot => <option key={robot.embodiment_id}
          value={`support:${robot.embodiment_id}`}>{robot.display_name}</option>)
          : savedSupport && <option value={`support:${savedSupport.embodimentId}`}>{savedSupportRobot?.display_name || "Saved robot model"}</option>}
        <option value="model">Use my robot model</option>
      </select>
    </label>
    {source.startsWith("support:") && <div className="rounded border border-line p-3">
      <input type="hidden" name="robotSupportCatalogDigest" value={supportUnchanged ? savedSupport.catalogDigest : currentDigest} />
      {allowSupportOptions && selectedSupport ? <DeploymentPolicyRouteChoices embodimentId={selectedSupport.embodiment_id}
        value={routes} onChange={setRoutes} name="robotSupportPolicyRouteIds" />
        : savedSupport?.policyRouteIds.map(route=><input key={route} type="hidden" name="robotSupportPolicyRouteIds" value={route} />)}
      <p className="text-sm font-medium">{selectedSupport?.display_name || savedSupportRobot?.display_name || "Saved robot model"}</p>
      <p className="mt-1 text-sm text-ink-500">Attach the actual model, controller, cameras and grippers in the robot configuration. Runtime support comes from execution receipts.</p>
    </div>}
    {source==="model" && <>
      <label className="block text-sm">Robot model URL
        <input name="robotModelReference" type="url" required maxLength={1000} defaultValue={model?.reference} className={input} placeholder="https://example.com/robot.urdf" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Model format<select name="robotModelFormat" defaultValue={model?.format || "urdf"} className={input}>
          <option value="urdf">URDF</option><option value="usd">USD</option><option value="mjcf">MJCF</option>
        </select></label>
        <label className="block text-sm">Robot type<select name="robotMobility" defaultValue={model?.mobility || "fixed"} className={input}>
          <option value="fixed">Fixed arm</option><option value="mobile">Mobile robot</option><option value="legged">Legged robot</option>
        </select></label>
      </div>
      <details><summary className="cursor-pointer text-sm">Gripper, cameras or mounting details</summary>
        <textarea name="robotModelDetails" maxLength={2000} defaultValue={model?.details} className={input} rows={3} placeholder="Anything needed beyond the model file. Optional." />
      </details>
      <p className="text-sm text-ink-500">Include the robot, gripper and sensors. Model compatibility must be verified before an evaluation can start.</p>
    </>}
    {!source.startsWith("support:") && <p className="text-sm text-ink-500">Your physical model is separate from your policy. A hosted endpoint can keep policy weights on your infrastructure.</p>}
  </fieldset>;
}
