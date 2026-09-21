import { useState } from "react";
import type { RobotConfigurationChoice, RobotDescription } from "@/types/robotDescription";

export function readRobotDescription(form: FormData, configurations: RobotConfigurationChoice[]): RobotDescription | undefined {
  const source=String(form.get("robotDescriptionSource") || "");
  if (!source) return undefined;
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

export function RobotDescriptionFields({value,configurations=[]}: {
  value?:RobotDescription;configurations?:RobotConfigurationChoice[];
}) {
  const [source,setSource]=useState(value?.source==="catalog"?value.configurationId:value?.source || "");
  const choices=value?.source==="catalog" && !configurations.some(row=>row.id===value.configurationId)
    ? [...configurations,{id:value.configurationId,label:"Saved robot model",binding_digest:value.configurationDigest}]
    : configurations;
  const model=value?.source==="model"?value:undefined;
  const input="mt-1 block w-full rounded border border-line bg-white p-2";
  return <fieldset className="space-y-3 border-t border-line pt-4">
    <legend className="px-1 font-medium">Physical robot</legend>
    <label className="block text-sm">Robot model
      <select name="robotDescriptionSource" value={source} onChange={event=>setSource(event.target.value)} className={input} required>
        <option value="">Choose a robot model</option>
        {choices.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
        <option value="model">Use my robot model</option>
      </select>
    </label>
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
    <p className="text-sm text-ink-500">Your physical model is separate from your policy. A hosted endpoint can keep policy weights on your infrastructure.</p>
  </fieldset>;
}
