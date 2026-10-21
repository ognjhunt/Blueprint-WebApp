import { useEffect, useState } from "react";
import { deploymentEmbodimentCatalog as catalog } from "@/lib/deploymentEmbodimentSupport";
import photographs from "@/data/deploymentEmbodimentImages.json";

type ProductImage = { src: string; source_url: string; credit: string; visual_kind: string; portrayal: string; license_note: string; notice_url?: string; alt: string };
export const deploymentRobotImages = photographs as Record<string, ProductImage>;

const configurations: Record<string, { shell: string; joint: string; family: "industrial" | "cobot" | "tabletop" | "torso" }> = {
  universal_robots_ur5e: { shell: "#d7dfe0", joint: "#6f9cad", family: "cobot" },
  universal_robots_ur5e_bimanual: { shell: "#d7dfe0", joint: "#6f9cad", family: "cobot" },
  trlc_dk1_bimanual: { shell: "#e2e6df", joint: "#596965", family: "tabletop" },
  almond_axol: { shell: "#54645d", joint: "#283a32", family: "torso" },
  fanuc_crx_10ia_l: { shell: "#e7e8df", joint: "#719077", family: "cobot" },
  fanuc_m710ic_45m: { shell: "#d0b45c", joint: "#626250", family: "industrial" },
  yaskawa_gp12: { shell: "#6f99af", joint: "#486674", family: "industrial" },
  yaskawa_gp20: { shell: "#6f99af", joint: "#486674", family: "industrial" },
  i2rt_yam_bimanual: { shell: "#dce0d9", joint: "#4b6572", family: "tabletop" },
  agilex_piper_bimanual: { shell: "#a8bdc7", joint: "#425b66", family: "tabletop" },
  standard_bots_ro1: { shell: "#d5d9d1", joint: "#4b5a52", family: "industrial" },
  standard_bots_core: { shell: "#d5d9d1", joint: "#4b5a52", family: "industrial" },
  franka_research_3_bimanual: { shell: "#e3e3dc", joint: "#536360", family: "cobot" },
  kinova_gen3_bimanual: { shell: "#737f7a", joint: "#394941", family: "cobot" },
  ufactory_xarm7_bimanual: { shell: "#dcded6", joint: "#627269", family: "cobot" },
  kuka_lbr_iiwa_14: { shell: "#dedbd0", joint: "#b78a5e", family: "cobot" },
};

function SchematicArm({ x, paired, index, shell, joint, family }: {
  x: number; paired: boolean; index: number; shell: string; joint: string; family: string;
}) {
  const direction = paired && index === 1 ? -1 : 1;
  const points = family === "industrial" ? [[0, 2], [0, -43], [28, -82], [67, -63], [76, -45]]
    : family === "torso" ? [[0, -26], [direction * 24, -42], [direction * 38, -4], [direction * 69, -25], [direction * 80, -18]]
      : [[0, 0], [direction * -9, -38], [direction * 21, -73], [direction * 55, -54], [direction * 65, -37]];
  const path = points.map(point => point.join(",")).join(" ");
  const last = points[points.length - 1];
  return <g transform={`translate(${x} 135)`}>
    <ellipse cx="0" cy="7" rx="23" ry="5" fill="#b8c3b8" opacity=".35" />
    <rect x="-18" y="-3" width="36" height="10" rx="3" fill={joint} />
    <polyline points={path} fill="none" stroke="#64746b" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points={path} fill="none" stroke={shell} strokeWidth={family === "industrial" ? "17" : "14"} strokeLinecap="round" strokeLinejoin="round" />
    {points.slice(0, -1).map(([cx, cy], i) => <g key={i}><circle cx={cx} cy={cy} r={i === 0 ? 10 : 8} fill={joint} /><circle cx={cx} cy={cy} r="3.3" fill="#edf0e9" opacity=".7" /></g>)}
    <g transform={`translate(${last[0]} ${last[1]}) rotate(${direction * -12})`}>
      <rect x="-9" y="-5" width="18" height="10" rx="2" fill={joint} />
      <path d="M-6 4v13h4M6 4v13H2" fill="none" stroke={joint} strokeWidth="4" strokeLinejoin="round" />
    </g>
  </g>;
}

export function RobotConfigurationVisual({ embodimentId }: { embodimentId: string }) {
  const [failed, setFailed] = useState(false);
  const robot = catalog.embodiments.find(row => row.embodiment_id === embodimentId);
  const photo = deploymentRobotImages[embodimentId];
  useEffect(() => setFailed(false), [embodimentId, photo?.src]);
  if (!robot) return null;
  const trait = configurations[embodimentId] || configurations.universal_robots_ur5e;
  const paired = robot.arm_count === 2;
  return <div className="embodiment-artwork">
    {photo && !failed ? <img className="embodiment-product-image" src={photo.src} width="480" height="320" loading="lazy" decoding="async"
      alt={`${robot.display_name}: ${photo.alt}`} onError={() => setFailed(true)} />
      : <svg className="embodiment-configuration-svg" viewBox="0 0 320 180" role="img" aria-label={`${robot.display_name}: schematic ${paired ? "two-arm" : "single-arm"} configuration, not exact model geometry`}>
        <ellipse cx="165" cy="147" rx="117" ry="13" fill="#ccd5cb" opacity=".35" />
        <path d="M39 144H285M62 154H266" stroke="#c8d2c7" strokeWidth="1" />
        {trait.family === "torso" && <g><path d="M135 140V81Q160 65 185 81V140" fill={trait.shell} /><rect x="149" y="53" width="22" height="20" rx="5" fill={trait.joint} /><circle cx="160" cy="61" r="3" fill="#b4c6bd" /></g>}
        {paired ? <><SchematicArm x={trait.family === "torso" ? 137 : 96} paired index={0} {...trait} /><SchematicArm x={trait.family === "torso" ? 183 : 230} paired index={1} {...trait} /></>
          : <SchematicArm x={120} paired={false} index={0} {...trait} />}
      </svg>}
    <span className="embodiment-artwork-caption">{photo && !failed ? photo.visual_kind === "simulator_asset_render" ? "Simulator render" : photo.visual_kind.includes("render") ? "Manufacturer render" : "Product image" : "Configuration illustration"}</span>
  </div>;
}
