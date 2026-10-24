/**
 * Beta L5: what a robot team builds so Blueprint can evaluate its policy on its
 * own robot or on Blueprint's simulated DROID Franka. The contract is the
 * Pipeline's (`team_policy_https_client`, `droid_https_policy_client`); this
 * page states it, it does not define it.
 */

const EXAMPLE_MANIFEST = `{
  "schema_version": "blueprint.robot_embodiment.v1",
  "embodiment_id": "acme-arm-v2",
  "form": "fixed_base_arm",
  "model": { "format": "usd", "url": "https://models.acme.example/arm.usd", "sha256": "sha256:<64 hex>" },
  "base": { "mode": "fixed" },
  "joints": [
    { "name": "shoulder", "control": "position", "lower": -3, "upper": 3, "max_velocity": 2 },
    { "name": "elbow", "control": "position", "lower": -3, "upper": 3, "max_velocity": 2 }
  ],
  "gripper": { "joints": [{ "name": "finger", "open": 0.04, "closed": 0 }], "max_width_m": 0.08,
               "contact_links": ["left_finger", "right_finger"] },
  "tool_link": "wrist",
  "reset_joint_positions": { "shoulder": 0, "elbow": 0, "finger": 0.04 },
  "actuator": { "stiffness": 400, "damping": 40 },
  "cameras": [{ "name": "wrist_rgb", "mount_link": "wrist", "position_m": [0, 0.05, 0.02],
                "orientation_xyzw": [0, 0, 0, 1], "width": 320, "height": 240, "horizontal_fov_deg": 90 }],
  "control_hz": 30,
  "action_chunk_rows": 4,
  "reach_m": 0.9
}`;

const METADATA = `GET <your policy URL>  →
{
  "schema_version": "blueprint.policy_https_metadata.v1",
  "policy_id": "<your id>",
  "policy_interface_id": "blueprint_policy_https.v1",
  "action_space": "joint_position",
  "action_chunk_rows": <your manifest's action_chunk_rows>,
  "model_identity_digest": "sha256:<64 hex naming your weights>",
  "embodiment_id": "<your manifest's embodiment_id>"
}`;

const REQUEST = `POST <your policy URL>
{
  "schema_version": "blueprint.policy_https_request.v1",
  "request_id": "<hex>",
  "policy_interface_id": "blueprint_policy_https.v1",
  "observation": {
    "images": { "<camera name>": { "encoding": "png_base64", "width": W, "height": H, "data": "<base64 PNG>" } },
    "state": {
      "joint_position": [one per declared joint, manifest order],
      "joint_velocity": [one per declared joint],
      "gripper_position": [closure, 0 open … 1 closed] (empty with no gripper),
      "base": { "position_world_m": [x, y, z], "orientation_xyzw": [x, y, z, w],
                "linear_velocity_world_mps": [x, y, z], "angular_velocity_world_radps": [x, y, z] }
    },
    "prompt": "<the job's instruction>"
  }
}
→ { "actions": [[one target per declared joint, then gripper closure], …] }`;

export default function PolicyInterfaceGuide() {
  return (
    <details className="ws-section">
      <summary>How Blueprint calls your policy</summary>
      <p className="ws-note">
        Before integrating, confirm the job and your robot with Blueprint. Today a site job can be
        scored when it involves picking up one rigid object and placing it at another spot on the
        same table, shelf or counter. Container placement, moves between surfaces and opening doors
        or drawers are outside this evaluation path. Any robot form can apply; compatibility depends
        on the exact model, controls, cameras and job.
      </p>
      <ol className="ws-note">
        <li>
          Serve your policy at one HTTPS URL that accepts a bearer token. Blueprint&rsquo;s simulator runs
          the robot and scores every episode; your service only returns actions.
        </li>
        <li>
          Give Blueprint your policy token once, here: under <strong>Policy token</strong> on this page, pick the
          setup saved for that URL (step 3) and enter the token. Blueprint registers the endpoint for you. The
          token is stored encrypted, never shown again, and lasts 30 days: enter a new one before then, or the
          evaluation is refused. An agent can do the same with the team key Blueprint issued you
          (<code>Authorization: Bearer bpk_…</code>): <code>POST /api/agent-team/checkpoints</code> with{" "}
          <code>{`{"label": "…", "runtime": "policy_endpoint", "reference": "https://…"}`}</code>, then{" "}
          <code>POST /api/agent-team/checkpoints/&lt;checkpointId&gt;/credentials</code> with{" "}
          <code>{`{"kind": "bearer", "token": "<your policy token>"}`}</code>.
        </li>
        <li>
          Save a setup here with delivery &ldquo;Hosted endpoint&rdquo; and that same URL as its reference, plus
          your robot manifest to use your own robot.
        </li>
        <li>Request an evaluation from an open job: 200 episodes across the job&rsquo;s variations.</li>
      </ol>
      <h3>Your own robot (<code>blueprint_policy_https.v1</code>)</h3>
      <p className="ws-note">
        An evaluation that can support a pilot recommendation requires your declared robot and its
        exact verified model file. Confirm an approved way to provide a self-contained USD model with
        Blueprint before sharing proprietary files. Keep policy weights on your own server.
      </p>
      <p className="ws-note">
        Before every request Blueprint reads your service&rsquo;s identity with a <code>GET</code> on the same
        URL. It must be identical to this; any difference is refused like an invalid answer:
      </p>
      <pre className="ws-code">{METADATA}</pre>
      <p className="ws-note">
        Then, at your control rate, it sends what your declared cameras see and your robot&rsquo;s state, and
        executes every row you return (1 to <code>action_chunk_rows</code>) before asking again:
      </p>
      <pre className="ws-code">{REQUEST}</pre>
      <p className="ws-note">
        A position joint takes a position target within its limits; a wheel takes a velocity within its{" "}
        <code>max_velocity</code>. JSON only, 1 MB at most, an answer within 30 seconds, no redirects. A
        response with any key other than <code>actions</code>, <code>policy_timing</code> or{" "}
        <code>server_timing</code>, an action out of limits, or no answer counts as that episode&rsquo;s
        failure. A free base (<code>{`"base": {"mode": "free", …}`}</code>) declares its standing height, fall
        height, footprint and ground-contact links instead of <code>reach_m</code>; it starts on the floor facing
        the task, and falling ends the episode as a failure.
      </p>
      <details>
        <summary>Example manifest (a two-joint fixed arm)</summary>
        <pre className="ws-code">{EXAMPLE_MANIFEST}</pre>
      </details>
      <p className="ws-note">For independent tools use <code>blueprint.robot_embodiment.v2</code> and replace
        <code>gripper</code> with the ordered <code>grippers</code> array. Each channel adds its own
        <code>name</code> and <code>tool_link</code> to the same joint, width and contact fields. Two-arm robots
        require two channels. Actions append one closure per channel after all driven joints; state returns
        matching <code>gripper_position</code> and <code>gripper_names</code> arrays. The primary
        <code>tool_link</code> remains the independent scorer's task reference.</p>
      <h3>Blueprint&rsquo;s DROID Franka (<code>openpi_droid_https.v1</code>)</h3>
      <p className="ws-note">
        This preset currently supports diagnostic runs only. Its default model has not been bound to
        the verified model file required for a qualified evaluation, so these runs cannot support a
        pilot recommendation. For that path, use your own declared, verified robot model above.
      </p>
      <p className="ws-note">
        Leave the manifest empty. Your identity is the same as above with schema{" "}
        <code>blueprint.droid_https_policy_metadata.v1</code>, interface <code>openpi_droid_https.v1</code>, an{" "}
        <code>action_chunk_rows</code> of 10 or 15 and no <code>embodiment_id</code>. Requests carry schema{" "}
        <code>blueprint.droid_https_policy_request.v1</code>; the observation is{" "}
        <code>observation/exterior_image_1_left</code> and <code>observation/wrist_image_left</code> (224×224
        PNG), <code>observation/joint_position</code> (7), <code>observation/gripper_position</code> (1) and{" "}
        <code>prompt</code>; each action row is seven joint positions then gripper closure.
      </p>
      <p className="ws-note">
        Reported simulation cycle time includes task execution and settling in the simulator. Policy
        service latency is recorded separately and is excluded from that clock. The physical pilot
        measures actual throughput and performance.
      </p>
    </details>
  );
}
