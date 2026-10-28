import type { DeploymentEmbodimentCatalog } from "../../../client/src/lib/deploymentEmbodimentSupport";

/** Synthetic schema exercise only; no robot assets, license, task fit or runtime qualification. */
export function syntheticCatalogRobot(robot: DeploymentEmbodimentCatalog["embodiments"][number]) {
  const joints=Array.from({length:robot.arm_dof?.reduce((sum,n)=>sum+n,0) || 6},(_,i)=>({
    name:`arm_joint_${i}`,control:"position" as const,lower:-3,upper:3,max_velocity:2,
  }));
  const grippers=Array.from({length:robot.arm_count},(_,i)=>({name:`gripper_${i}`,tool_link:`tool_${i}`,
    joints:[{name:`finger_${i}`,open:0.04,closed:0}],max_width_m:0.08,contact_links:[`finger_link_${i}`]}));
  return {schema_version:"blueprint.robot_embodiment.v2" as const,embodiment_id:robot.embodiment_id,
    form:robot.arm_count===2?"bimanual_arm" as const:"fixed_base_arm" as const,
    model:{format:"usd" as const,url:"https://fixture.example/robot.usd",sha256:`sha256:${"9".repeat(64)}`},
    base:{mode:"fixed" as const},joints,grippers,tool_link:"tool_0",
    reset_joint_positions:Object.fromEntries([...joints.map(row=>[row.name,0]),...grippers.map(row=>[row.joints[0].name,0.04])]),
    actuator:{stiffness:400,damping:40},cameras:[{name:"scene_rgb",mount_link:null,position_m:[1,0,1.2] as [number,number,number],
      orientation_xyzw:[0,0,0,1] as [number,number,number,number],width:320,height:240,horizontal_fov_deg:60}],
    control_hz:30 as const,action_chunk_rows:4,reach_m:1,
  };
}
