import { useState } from "react";
import {
  deploymentEmbodimentCatalog as catalog, downloadDeploymentEmbodimentShortlist,
  makeDeploymentEmbodimentShortlist, type DeploymentEmbodimentSelection,
} from "@/lib/deploymentEmbodimentSupport";

export function DeploymentEmbodimentDetails({ embodimentId }: { embodimentId: string }) {
  const robot = catalog.embodiments.find(row => row.embodiment_id === embodimentId);
  if (!robot) return null;
  return <div className="space-y-3 text-sm">
    <p>{robot.manufacturer} · {robot.arm_count} {robot.arm_count === 1 ? "arm" : "arms"}{robot.arm_dof ? ` · ${robot.arm_dof.join(" + ")} DOF` : ""} · fixed base</p>
    <p>{robot.tool_requirement}</p>
    {robot.related_teams.length > 0 && <p>Deployment-team references: {robot.related_teams.join(", ")}. These references do not establish an exact deployed checkpoint or Blueprint qualification.</p>}
    <details><summary className="cursor-pointer">Robot assets and setup requirements</summary>
      <ul className="mt-2 space-y-3">
        {robot.asset_sources.map(asset => <li key={asset.source_id}>
          <a className="ws-link underline" href={asset.url} target="_blank" rel="noreferrer">{asset.format} source{asset.relative_path ? ` · ${asset.relative_path}` : ""}</a>
          <p>{asset.preparation}</p><p>{asset.license_note}</p>
          {asset.revision && <p className="break-all">Source revision: {asset.revision}</p>}
        </li>)}
      </ul>
      <ul className="mt-3 list-disc pl-5">{robot.required_artifacts.map(item => <li key={item}>{item.replaceAll("_", " ")}</li>)}</ul>
    </details>
  </div>;
}

export function DeploymentPolicyRouteChoices({ embodimentId, value, onChange, name }: {
  embodimentId: string; value: string[]; onChange: (value: string[]) => void; name?: string;
}) {
  const robot = catalog.embodiments.find(row => row.embodiment_id === embodimentId);
  if (!robot) return null;
  return <fieldset className="space-y-3">
    <legend className="mb-2 text-sm font-medium">Policy routes for {robot.display_name}</legend>
    {catalog.policy_routes.filter(route => robot.policy_routes.some(row => row.route_id === route.route_id)).map(route => {
      const evidence = robot.policy_routes.find(row => row.route_id === route.route_id)!;
      return <label key={route.route_id} className="ws-check">
        <input name={name} type="checkbox" value={route.route_id} checked={value.includes(route.route_id)}
          onChange={event => onChange(event.target.checked ? [...value, route.route_id] : value.filter(item => item !== route.route_id))} />
        <span>{route.display_name}<span className="block text-sm text-ink-500">{evidence.evidence.replaceAll("_", " ")}{route.model_id ? ` · ${route.model_id}` : " · exact model supplied during setup"}</span>
          <a className="ws-link block text-sm underline" href={evidence.source_url} target="_blank" rel="noreferrer">{evidence.evidence === "publisher_demonstrated" ? "Publisher demonstration" : "Interface reference"}</a>
          <span className="block text-sm text-ink-500">Required: {route.required_artifacts.map(item => item.replaceAll("_", " ")).join("; ")}</span>
        </span>
      </label>;
    })}
  </fieldset>;
}

export function DeploymentEmbodimentShortlist({ sourceLaunchId = null }: { sourceLaunchId?: string | null }) {
  const [selections, setSelections] = useState<DeploymentEmbodimentSelection[]>([]);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  async function download() {
    setError(""); setExporting(true);
    try { downloadDeploymentEmbodimentShortlist(await makeDeploymentEmbodimentShortlist(selections, sourceLaunchId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The shortlist could not be exported."); }
    finally { setExporting(false); }
  }
  return <section aria-labelledby="deployment-embodiment-shortlist" className="mb-10 space-y-5 border-b border-line pb-8">
    <div><h2 id="deployment-embodiment-shortlist">Robot and policy shortlist</h2>
      <p className="ws-note mt-2">Compare deployment embodiments and compatible policy interfaces. Save an option in your robot setup or download this planning handoff for Pipeline setup. A shortlist does not start a run; exact assets, model access and simulation validation are required.</p>
    </div>
    <button type="button" className="ws-secondary" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Choose robots and policies ({catalog.embodiments.length} options)</button>
    {expanded && <div className="space-y-4">{catalog.embodiments.map(robot => {
      const selected = selections.find(row => row.embodiment_id === robot.embodiment_id);
      return <div className="rounded border border-line p-4" key={robot.embodiment_id}>
        <label className="ws-check"><input type="checkbox" checked={Boolean(selected)} aria-label={`Shortlist ${robot.display_name}`}
          onChange={event => setSelections(event.target.checked ? [...selections, { embodiment_id: robot.embodiment_id, policy_route_ids: [] }]
            : selections.filter(row => row.embodiment_id !== robot.embodiment_id))} /><span>{robot.display_name}</span></label>
        {selected && <div className="mt-3 space-y-4"><DeploymentEmbodimentDetails embodimentId={robot.embodiment_id} />
          <DeploymentPolicyRouteChoices embodimentId={robot.embodiment_id} value={selected.policy_route_ids}
            onChange={routes => setSelections(selections.map(row => row.embodiment_id === robot.embodiment_id ? { ...row, policy_route_ids: routes } : row))} />
        </div>}
      </div>;
    })}</div>}
    {error && <p role="alert" className="text-sm">{error}</p>}
    <button className="ws-secondary" type="button" disabled={exporting || selections.length === 0 || selections.some(row => !row.policy_route_ids.length)}
      onClick={() => { void download(); }}>{exporting ? "Preparing…" : "Download robot and policy shortlist"}</button>
    <p className="ws-note">Planning only · source catalog and selections are digest-bound · no runtime preset or checkpoint is created.</p>
  </section>;
}
