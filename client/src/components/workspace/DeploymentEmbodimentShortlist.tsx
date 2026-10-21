import { useState } from "react";
import {
  deploymentEmbodimentCatalog as catalog, downloadDeploymentEmbodimentShortlist,
  makeDeploymentEmbodimentShortlist, type DeploymentEmbodimentSelection,
} from "@/lib/deploymentEmbodimentSupport";
import { deploymentRobotImages, RobotConfigurationVisual } from "./RobotConfigurationVisual";
import "./deployment-embodiments.css";

const modelNames: Record<string, string> = {
  universal_robots_ur5e: "UR5e", universal_robots_ur5e_bimanual: "UR5e",
  trlc_dk1_bimanual: "TRLC-DK1", almond_axol: "Axol", fanuc_crx_10ia_l: "CRX-10iA/L",
  fanuc_m710ic_45m: "M-710iC/45M", yaskawa_gp12: "GP12", yaskawa_gp20: "GP20",
  i2rt_yam_bimanual: "YAM", agilex_piper_bimanual: "PiPER", standard_bots_ro1: "RO1", standard_bots_core: "Core",
  franka_research_3_bimanual: "Research 3", kinova_gen3_bimanual: "Gen3", ufactory_xarm7_bimanual: "xArm 7", kuka_lbr_iiwa_14: "LBR iiwa 14",
};
const policyNames: Record<string, string> = {
  dreamlabs_dream1: "Dream-1", pi_api: "Pi API", pi05_custom_checkpoint: "π0.5 checkpoint",
  customer_controller: "Controller", planning_endpoint: "Planning endpoint", skill_trace: "Skill trace",
  runway_praxis1: "Praxis-1", groot_custom_checkpoint: "GR00T checkpoint", act_custom_checkpoint: "ACT checkpoint",
};
const readable = (value: string) => value.replaceAll("_", " ");

function RobotIdentity({ embodimentId }: { embodimentId: string }) {
  const robot = catalog.embodiments.find(row => row.embodiment_id === embodimentId);
  if (!robot) return null;
  return <>
    <span className="embodiment-card-name"><span className="embodiment-manufacturer">{robot.manufacturer}</span>
      <span className="embodiment-model-name">{modelNames[embodimentId] || robot.display_name}</span></span>
    <span className="embodiment-spec-chips"><span>{robot.arm_count === 1 ? "Single arm" : "Two arms"}</span>
      {robot.arm_dof && <span>{robot.arm_dof.every(dof => dof === robot.arm_dof![0]) ? `${robot.arm_count === 2 ? "2 × " : ""}${robot.arm_dof[0]} DOF` : `${robot.arm_dof.join(" + ")} DOF`}</span>}
      <span>Fixed base</span></span>
  </>;
}

export function DeploymentEmbodimentDetails({ embodimentId }: { embodimentId: string }) {
  const robot = catalog.embodiments.find(row => row.embodiment_id === embodimentId);
  if (!robot) return null;
  const photo = deploymentRobotImages[embodimentId];
  return <details className="embodiment-setup-details"><summary>Setup details</summary>
    <div className="embodiment-detail-content">
      <p><strong>{robot.display_name}</strong></p><p>{robot.tool_requirement}</p>
      {robot.related_teams.length > 0 && <p>Team references: {robot.related_teams.join(", ")}. A reference does not identify an exact deployed checkpoint.</p>}
      <h4>Assets and preparation</h4>
      {robot.asset_sources.map(asset => <div key={asset.source_id}>
        <a href={asset.url} target="_blank" rel="noreferrer">{asset.format.toUpperCase()} source{asset.relative_path ? ` · ${asset.relative_path}` : ""}</a>
        <p>{asset.preparation}</p><p className="embodiment-detail-meta">{asset.license_note}{asset.revision ? ` Source revision: ${asset.revision}` : ""}</p>
      </div>)}
      <h4>Before simulation</h4><ul>{robot.required_artifacts.map(item => <li key={item}>{readable(item)}</li>)}</ul>
      <h4>Policy evidence</h4>
      {robot.policy_routes.map(evidence => {
        const route = catalog.policy_routes.find(row => row.route_id === evidence.route_id)!;
        return <div key={route.route_id}><a href={evidence.source_url} target="_blank" rel="noreferrer">{route.display_name}</a>
          <p className="embodiment-detail-meta">{readable(evidence.evidence)} · {route.model_id || "Exact model supplied during setup"}</p>
          <ul>{route.required_artifacts.map(item => <li key={item}>{readable(item)}</li>)}</ul></div>;
      })}
      {photo && <><h4>Image source</h4><p><a href={photo.source_url} target="_blank" rel="noreferrer">{photo.credit}</a> · {photo.portrayal}</p><p className="embodiment-detail-meta">{photo.license_note}{photo.notice_url && <> <a href={photo.notice_url} target="_blank" rel="noreferrer">License notice</a></>}</p></>}
      <p className="embodiment-detail-meta">Planning only. Assets, tool channels, model access and simulation validation are required before a run. Photos and schematics do not establish simulation compatibility.</p>
    </div>
  </details>;
}

export function DeploymentPolicyRouteChoices({ embodimentId, value, onChange, name }: {
  embodimentId: string; value: string[]; onChange: (value: string[]) => void; name?: string;
}) {
  const robot = catalog.embodiments.find(row => row.embodiment_id === embodimentId);
  if (!robot) return null;
  return <fieldset className="embodiment-policy-choices" aria-label={`Policy routes for ${robot.display_name}`}>
    <legend>Choose policies</legend><div className="embodiment-policy-chip-list">
      {catalog.policy_routes.filter(route => robot.policy_routes.some(row => row.route_id === route.route_id)).map(route =>
        <label key={route.route_id} className="embodiment-policy-chip" title={route.display_name}>
          <input name={name} type="checkbox" aria-label={route.display_name} value={route.route_id} checked={value.includes(route.route_id)}
            onChange={event => onChange(event.target.checked ? [...value, route.route_id] : value.filter(item => item !== route.route_id))} />
          <span>{policyNames[route.route_id] || route.display_name}{route.kind === "early_access" && <small>Early access</small>}</span>
        </label>)}
    </div>
  </fieldset>;
}

export function DeploymentEmbodimentShortlist({ sourceLaunchId = null }: { sourceLaunchId?: string | null }) {
  const [selections, setSelections] = useState<DeploymentEmbodimentSelection[]>([]);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<0 | 1 | 2>(0);
  const [showAll, setShowAll] = useState(false);
  const featuredIds = ["i2rt_yam_bimanual", "agilex_piper_bimanual", "universal_robots_ur5e", "almond_axol"];
  const gallery = [...featuredIds.map(id => catalog.embodiments.find(robot => robot.embodiment_id === id)!), ...catalog.embodiments.filter(robot => !featuredIds.includes(robot.embodiment_id))];
  const filtered = gallery.filter(robot => !filter || robot.arm_count === filter);
  const visible = showAll ? filtered : filtered.slice(0, 4);
  const needsPolicies = selections.some(row => !row.policy_route_ids.length);
  async function download() {
    setError(""); setExporting(true);
    try { downloadDeploymentEmbodimentShortlist(await makeDeploymentEmbodimentShortlist(selections, sourceLaunchId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The shortlist could not be exported."); }
    finally { setExporting(false); }
  }
  return <section aria-labelledby="deployment-embodiment-shortlist" className="embodiment-shortlist">
    <div className="embodiment-shortlist-header"><div><h2 id="deployment-embodiment-shortlist">Robot and policy shortlist</h2>
      <p>Choose your robots. Add the policies you want to connect.</p></div><span className="embodiment-planning-badge">Planning only</span>
    </div>
    <div className="embodiment-toolbar"><div role="group" aria-label="Filter robot configurations" className="embodiment-filters">
      {([{ value: 0, label: "All robots" }, { value: 1, label: "Single arm" }, { value: 2, label: "Two arms" }] as const).map(item =>
        <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); setShowAll(false); }}>{item.label}</button>)}
    </div><span className="embodiment-selected-count" role="status"><strong>{selections.length}</strong> selected</span></div>
    <div className="embodiment-gallery">{visible.map(robot => {
      const selected = selections.find(row => row.embodiment_id === robot.embodiment_id);
      const routes = catalog.policy_routes.filter(route => robot.policy_routes.some(row => row.route_id === route.route_id));
      return <article className="embodiment-card" data-selected={Boolean(selected)} aria-label={robot.display_name} key={robot.embodiment_id}>
        <label className="embodiment-card-selection"><input type="checkbox" checked={Boolean(selected)} aria-label={`Shortlist ${robot.display_name}`}
          onChange={event => setSelections(event.target.checked ? [...selections, { embodiment_id: robot.embodiment_id, policy_route_ids: [] }]
            : selections.filter(row => row.embodiment_id !== robot.embodiment_id))} />
          <RobotConfigurationVisual embodimentId={robot.embodiment_id} /><RobotIdentity embodimentId={robot.embodiment_id} />
        </label>
        {selected ? <DeploymentPolicyRouteChoices embodimentId={robot.embodiment_id} value={selected.policy_route_ids}
          onChange={policy_route_ids => setSelections(selections.map(row => row.embodiment_id === robot.embodiment_id ? { ...row, policy_route_ids } : row))} />
          : <div className="embodiment-available-policies"><span>Policies</span>{routes.slice(0, 3).map(route => <span key={route.route_id}>{policyNames[route.route_id] || route.display_name}</span>)}
            {routes.length > 3 && <span>+{routes.length - 3}</span>}</div>}
        <DeploymentEmbodimentDetails embodimentId={robot.embodiment_id} />
      </article>;
    })}</div>
    {filtered.length > 4 && <button type="button" className="embodiment-show-more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
      {showAll ? "Show fewer robots" : `Show all ${filtered.length} robots`}</button>}
    <div className="embodiment-shortlist-footer"><p>{selections.length ? needsPolicies ? "Add a policy to each selected robot." : `${selections.length} ${selections.length === 1 ? "robot" : "robots"} in your planning handoff.` : "Select a robot to build your shortlist."}<br />Downloads a setup handoff. No run starts.</p>
      <button type="button" aria-label="Download robot and policy shortlist" disabled={exporting || selections.length === 0 || needsPolicies}
        onClick={() => { void download(); }}>{exporting ? "Preparing…" : "Download shortlist"}</button>
    </div>
    {error && <p role="alert" className="embodiment-shortlist-error">{error}</p>}
  </section>;
}
