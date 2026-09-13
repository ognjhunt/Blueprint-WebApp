import { useEffect, useRef, useState } from "react";

const variations = [
  { id: "position", label: "Starting position", detail: "Move the cup within the agreed work area. Both policies start from the same position on each attempt.", compare: "Does the policy still reach, grasp, and place the cup when its starting position changes?" },
  { id: "lighting", label: "Lighting", detail: "Change the brightness and direction of light within the agreed range. Keep the task and object placement fixed.", compare: "Does the policy still recognize and handle the cup when its appearance changes?" },
  { id: "camera", label: "Camera view", detail: "Vary the camera view within the robot’s supported setup. Give both policies the same view for each attempt.", compare: "Does the policy still complete the task when the cup appears from a different angle?" },
] as const;

type Variation = (typeof variations)[number]["id"];

/** A schematic of test inputs, never a generated episode or measured outcome. */
function TaskDiagram({ variation }: { variation: Variation }) {
  const cupX = variation === "position" ? 155 : 215;
  return (
    <svg viewBox="0 0 500 280" role="img" aria-label={`Illustrative cup-to-target task with varied ${variations.find(v => v.id === variation)?.label.toLowerCase()}`}>
      <rect width="500" height="280" fill={variation === "lighting" ? "#e3e4d9" : "#eeeee6"} />
      <g transform={variation === "camera" ? "translate(22 -10) skewY(3)" : undefined}>
        <path d="M40 192 368 174 464 235 119 256Z" fill="#d4d6ca" stroke="#93998a" />
        <path d="M119 256v24M449 238v42M48 199v81" stroke="#93998a" strokeWidth="9" />
        <path d="m280 208 65-4 31 20-67 5Z" fill="#90a78c" stroke="#45634c" />
        <path d="M350 178v-31" stroke="#4f584b" strokeWidth="38" />
        <path d="m350 146-29-60-72-34-48 60" fill="none" stroke="#6f7868" strokeWidth="28" strokeLinejoin="round" />
        <path d="m350 146-29-60-72-34-48 60" fill="none" stroke="#fafaf5" strokeWidth="21" strokeLinejoin="round" />
        <circle cx="321" cy="86" r="13" fill="#d0d4c6" stroke="#6f7868" />
        <circle cx="249" cy="52" r="13" fill="#d0d4c6" stroke="#6f7868" />
        <path d="M201 112v16m-10 12v-12h20v12" stroke="#4f584b" strokeWidth="7" fill="none" />
        <g transform={`translate(${cupX} 184)`}>
          <path d="M-13-23v29c0 10 26 10 26 0v-29" fill="#fafaf5" stroke="#858c7d" />
          <ellipse cy="-23" rx="13" ry="4" fill="#e0e2d7" stroke="#858c7d" />
          <path d="M13-16c17-3 17 19 0 17" fill="none" stroke="#858c7d" strokeWidth="3" />
        </g>
      </g>
      <text x="25" y="260" fontSize="11" fill="#62645d">Illustration · not an episode</text>
    </svg>
  );
}

export function EvaluationExample() {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === "#evaluation-example") {
      const frame = requestAnimationFrame(() => section.current?.scrollIntoView());
      return () => cancelAnimationFrame(frame);
    }
  }, []);
  const [selected, setSelected] = useState<Variation>("position");
  const variation = variations.find(item => item.id === selected)!;
  return (
    <section ref={section} className="ms-eval-example" id="evaluation-example" aria-labelledby="evaluation-example-title">
      <p className="ms-eyebrow">An evaluation, explained</p>
      <h2 id="evaluation-example-title">Same task. Different policies.</h2>
      <p className="ms-eval-lede">Move a cup to the target. Keep the robot and task fixed; change the policy—the software that controls the robot.</p>
      <div className="ms-eval-toolbar">
        <span>Illustrative walkthrough</span>
        <div className="ms-eval-options" role="group" aria-label="Explore evaluation variations">
          {variations.map(item => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}
        </div>
      </div>
      <div className="ms-eval-pair">
        {["Policy A", "Policy B"].map(policy => <figure key={policy}>
          <figcaption>{policy}<span>Same robot · same task</span></figcaption>
          <TaskDiagram variation={selected} />
        </figure>)}
      </div>
      <div className="ms-eval-explanation" aria-live="polite" aria-atomic="true">
        <div><h3>What changes</h3><p>{variation.detail}</p></div>
        <div><h3>What we learn</h3><p>{variation.compare}</p></div>
      </div>
      <p className="ms-eval-boundary">Each episode is one attempt. Repeat the agreed variations to compare task completion, cycle time, and failure points. These illustrations explain the test; they do not show measured results.</p>
      <details className="ms-eval-details"><summary>What the results tell you</summary><p>Review the episode videos alongside success rate, cycle time, and the conditions where a candidate struggles. Compare results against the site’s targets to decide what deserves a physical pilot—or whether to pause. Simulation results guide that decision; the physical pilot checks real performance.</p></details>
      <details className="ms-eval-details"><summary>How results stay private</summary><p>The site reviews anonymized candidate results. Robot teams see their own results against the site’s targets, without competitor scores. Site identity and detailed access follow the site’s permissions; public examples require separate permission to share.</p></details>
    </section>
  );
}
