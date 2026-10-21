type PilotImageProps = {
  src: string;
  alt: string;
  caption: string;
  width?: number;
  height?: number;
};

function PilotImage({ src, alt, caption, width = 1672, height = 941 }: PilotImageProps) {
  return (
    <figure className="ms-pilot-image">
      <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

const contents = [
  ["warehouse-task", "The task"],
  ["task-capture", "Capture the task"],
  ["workspace-reconstruction", "Reconstruct the workspace"],
  ["task-objects", "Prepare the objects"],
  ["robot-comparison", "Compare robots and policies"],
  ["recommendation", "Choose a deployment partner"],
  ["on-site-testing", "Test on site"],
  ["pilot-decision", "Decide what comes next"],
] as const;

export function WarehousePilotSequence() {
  return (
    <div className="ms-pilot-layout">
      <nav className="ms-pilot-contents" aria-label="Warehouse walkthrough contents">
        <p className="ms-eyebrow">On this page</p>
        <ol>{contents.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
        <a className="ms-pilot-next" href="#job-fit">Is your job a fit? ↓</a>
      </nav>

      <div className="ms-pilot-story">
        <section id="warehouse-task" aria-labelledby="warehouse-task-title">
          <p className="ms-eyebrow">Warehouse walkthrough</p>
          <h2 id="warehouse-task-title">One task, from phone video to a pilot.</h2>
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
          <p>Upload a video or record a worker doing the job. Keep the hands, objects and work area in view. Blueprint analyzes the video and drafts the job description for you to review. The video is required to reconstruct and evaluate your site.</p>
          <PilotImage src="/illustrations/warehouse-pilot/01-task-capture.webp" width={1448} height={1086} alt="A close view of a warehouse worker in a lime reflective vest filming horizontally on a phone while another worker holds a blue case above the empty tray pocket." caption="A phone recording captures the worker’s hands, the cases and the placement task." />
        </section>

        <section className="ms-pilot-step" id="workspace-reconstruction" aria-labelledby="workspace-reconstruction-title">
          <p className="ms-eyebrow">02 · Reconstruction</p>
          <h3 id="workspace-reconstruction-title">Recreate the same work area.</h3>
          <p>Blueprint reconstructs your work area from the video. The bench, shelving and surrounding equipment become a site-specific simulation for testing robot reach, clearance and task performance.</p>
          <PilotImage src="/illustrations/warehouse-pilot/02-workspace-reconstruction.webp" alt="A point-cloud-style reconstruction of the same warehouse, with the bench, supply tote, blue cases, tray and shelving preserved." caption="The warehouse becomes a digital workspace for preparing the task." />
        </section>

        <section className="ms-pilot-step" id="task-objects" aria-labelledby="task-objects-title">
          <p className="ms-eyebrow">03 · Objects</p>
          <h3 id="task-objects-title">Prepare the objects the robot will handle.</h3>
          <p>The case, tote and tray become separate task objects. We prepare pickup and placement, object variations and the contacts needed for the job, with a clear definition of success.</p>
          <PilotImage src="/illustrations/warehouse-pilot/03-task-objects.webp" alt="The supply tote, a blue case with an orange latch, and the three-pocket tray shown separately against a dark background." caption="The same case, supply tote and tray, prepared as individual task objects." />
        </section>

        <section className="ms-pilot-step" id="robot-comparison" aria-labelledby="robot-comparison-title">
          <p className="ms-eyebrow">04 · Evaluation</p>
          <h3 id="robot-comparison-title">Compare suitable robots and policies in simulation.</h3>
          <p>Blueprint runs compatible robots and policies—the software that controls a robot—in the reconstructed work area, using APIs or other supported access. When a system needs its team to take part, we work with them. We shortlist configurations that can be supplied and supported at your site, then compare them against the same placement criteria.</p>
          <p>You see the tested conditions, completed placements and failures for each option, so the recommendation is grounded in your job.</p>
          <p className="ms-pilot-disclosure">The three evaluations below use illustrative policy labels and outcomes. A simulated pass is an estimate, not proof of real performance or safety.</p>
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

        <section className="ms-pilot-step" id="recommendation" aria-labelledby="recommendation-title">
          <p className="ms-eyebrow">05 · Recommendation</p>
          <h3 id="recommendation-title">Compare delivery proposals and choose your partner.</h3>
          <p>Blueprint explains which tested setup best fits the job: in this example, setup B. Suitable deployment partners quote against the same brief, covering equipment, installation, ongoing cost, timing and support. You choose the partner and agree the pilot price and terms directly.</p>
          <p>No approved budget is needed to start. Blueprint assessment, evaluations, recommendations and coordination are free during the beta, with no cut of the pilot.</p>
        </section>

        <section className="ms-pilot-step" id="on-site-testing" aria-labelledby="on-site-testing-title">
          <p className="ms-eyebrow">06 · On-site trial</p>
          <h3 id="on-site-testing-title">Test the approach at the real bench.</h3>
          <p>Once you and the deployment partner agree the pilot, the partner supplies and integrates the system, trains operators and provides the support you agree. Test the task at your site and measure completed placements, cycle time and human interventions against the agreed criteria.</p>
          <PilotImage src="/illustrations/warehouse-pilot/07-on-site-testing.webp" width={1448} height={1086} alt="A close view of an illustrative on-site test: a wheeled robot supports a blue case in its grippers above an empty tray pocket while a technician supervises from a laptop beside the bench." caption="Illustrative on-site trial: the grippers support the case above the empty pocket before placement." />
        </section>

        <section className="ms-pilot-step" id="pilot-decision" aria-labelledby="pilot-decision-title">
          <h3 id="pilot-decision-title">Decide what comes next.</h3>
          <p>Record the physical trial results and decide whether to expand, change the setup or pause. Simulation helps choose what to test; the on-site trial measures how it works in your warehouse. A simulated pass does not establish physical performance or safety.</p>
        </section>
      </div>
    </div>
  );
}
