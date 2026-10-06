type PilotImageProps = {
  src: string;
  alt: string;
  caption: string;
};

function PilotImage({ src, alt, caption }: PilotImageProps) {
  return (
    <figure className="ms-pilot-image">
      <img src={src} alt={alt} width={1672} height={941} loading="lazy" decoding="async" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

const contents = [
  ["warehouse-task", "The task"],
  ["task-capture", "Capture the task"],
  ["workspace-reconstruction", "Reconstruct the workspace"],
  ["task-objects", "Prepare the objects"],
  ["robot-comparison", "Compare robot setups"],
  ["on-site-testing", "Test on site"],
  ["pilot-decision", "Decide what comes next"],
] as const;

export function WarehousePilotSequence() {
  return (
    <div className="ms-pilot-layout">
      <nav className="ms-pilot-contents" aria-label="Warehouse walkthrough contents">
        <p className="ms-eyebrow">On this page</p>
        <ol>{contents.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
        <a className="ms-pilot-next" href="#matching">How matching works ↓</a>
      </nav>

      <div className="ms-pilot-story">
        <section id="warehouse-task" aria-labelledby="warehouse-task-title">
          <p className="ms-eyebrow">Warehouse walkthrough</p>
          <h2 id="warehouse-task-title">One task, from phone video to a pilot.</h2>
          <p>A worker moves blue cases from a supply tote into a three-pocket tray. Here is how that job becomes a robot evaluation and an on-site trial.</p>
          <p className="ms-pilot-caption">Illustrative warehouse pilot: from task capture to on-site testing.</p>
          <p className="ms-pilot-disclosure">These images illustrate the process. The robot configurations, policy labels and outcomes are examples, not measured customer results.</p>
          <dl className="ms-pilot-task">
            <div><dt>Task</dt><dd>Pick a case from the tote and place it in an empty tray pocket.</dd></div>
            <div><dt>Workspace</dt><dd>The warehouse bench, supply tote, blue cases and three-pocket tray.</dd></div>
            <div><dt>Success</dt><dd>The case sits flat in the correct pocket, supported by the tray, with the grippers released.</dd></div>
          </dl>
        </section>

        <section className="ms-pilot-step" id="task-capture" aria-labelledby="task-capture-title">
          <p className="ms-eyebrow">01 · Capture</p>
          <h3 id="task-capture-title">Show us the task as it happens.</h3>
          <p>Film a worker doing the job. Keep the hands, objects and work area in view. Agree what a completed task looks like and which exceptions matter.</p>
          <PilotImage src="/illustrations/warehouse-pilot/01-task-capture.webp" alt="A warehouse worker in a lime reflective vest films horizontally on a phone while another worker places a blue case above the empty tray pocket; her body and feet are clear of the bench." caption="A phone recording captures the worker’s hands, the cases and the placement task." />
        </section>

        <section className="ms-pilot-step" id="workspace-reconstruction" aria-labelledby="workspace-reconstruction-title">
          <p className="ms-eyebrow">02 · Reconstruction</p>
          <h3 id="workspace-reconstruction-title">Recreate the same work area.</h3>
          <p>Blueprint turns the visual references into a digital workspace. The bench, shelving and surrounding equipment give robot teams the layout they need to test reach and clearance.</p>
          <PilotImage src="/illustrations/warehouse-pilot/02-workspace-reconstruction.webp" alt="A point-cloud-style reconstruction of the same warehouse, with the bench, supply tote, blue cases, tray and shelving preserved." caption="The warehouse becomes a digital workspace for preparing the task." />
        </section>

        <section className="ms-pilot-step" id="task-objects" aria-labelledby="task-objects-title">
          <p className="ms-eyebrow">03 · Objects</p>
          <h3 id="task-objects-title">Prepare the objects the robot will handle.</h3>
          <p>The case, tote and tray become separate task objects. Teams can set up pickup and placement, adjust their positions and check the contacts needed for the job.</p>
          <PilotImage src="/illustrations/warehouse-pilot/03-task-objects.webp" alt="The supply tote, a blue case with an orange latch, and the three-pocket tray shown separately against a dark background." caption="The same case, supply tote and tray, prepared as individual task objects." />
        </section>

        <section className="ms-pilot-step" id="robot-comparison" aria-labelledby="robot-comparison-title">
          <p className="ms-eyebrow">04 · Comparison</p>
          <h3 id="robot-comparison-title">Compare robot setups on the same task.</h3>
          <p>Robot teams test their configuration and policy—the software that controls the robot—against the same placement criteria. Review completed attempts, missed placements and the conditions each setup can handle.</p>
          <p className="ms-pilot-disclosure">The three comparisons below use illustrative policy labels and outcomes. They do not establish a winning robot or real performance.</p>
          <div className="ms-pilot-comparison">
            <h4>A · Fixed arm</h4>
            <PilotImage src="/illustrations/warehouse-pilot/04-fixed-arm.webp" alt="Illustrative fixed-arm setup A, labeled Policy A-01 with a cross; one blue case remains on the bench outside the empty tray pocket." caption="Example A: the case remains outside the pocket, so the placement criterion is not met." />
          </div>
          <div className="ms-pilot-comparison">
            <h4>B · Wheeled robot</h4>
            <PilotImage src="/illustrations/warehouse-pilot/05-wheeled-robot.webp" alt="Illustrative wheeled dual-arm setup B, labeled Policy B-01 with a check; all three blue cases lie flat in the tray." caption="Example B: all three cases sit flat in their pockets, illustrating a completed placement." />
          </div>
          <div className="ms-pilot-comparison">
            <h4>C · Biped robot</h4>
            <PilotImage src="/illustrations/warehouse-pilot/06-biped-robot.webp" alt="Illustrative biped setup C, labeled Policy C-01 with a cross; the left blue case stands upright in the tray instead of lying flat." caption="Example C: one case stands upright, so the placement criterion is not met." />
          </div>
        </section>

        <section className="ms-pilot-step" id="on-site-testing" aria-labelledby="on-site-testing-title">
          <p className="ms-eyebrow">05 · On-site trial</p>
          <h3 id="on-site-testing-title">Test the approach at the real bench.</h3>
          <p>Once a team matches, you agree the pilot directly with them. The provider brings the robot to the site and tests the task under supervision. Measure completed placements, cycle time and interventions against the agreed criteria.</p>
          <PilotImage src="/illustrations/warehouse-pilot/07-on-site-testing.webp" alt="Illustrative on-site test: a wheeled robot supports a blue case in its grippers above an empty tray pocket while a technician supervises from a laptop beside the bench." caption="Illustrative on-site trial: the grippers support the case above the empty pocket before placement." />
        </section>

        <section className="ms-pilot-step" id="pilot-decision" aria-labelledby="pilot-decision-title">
          <h3 id="pilot-decision-title">Decide what comes next.</h3>
          <p>Use the physical trial results to decide whether to expand, change the setup or pause. Simulation helps choose what to test; the on-site trial measures how it works in your warehouse.</p>
        </section>
      </div>
    </div>
  );
}
