/** One illustrative job, with the capture and simulation stages kept visible together. */
export function TaskEvaluationPair() {
  return (
    <div className="ms-task-example">
      <div className="ms-task-pair">
        <figure>
          <figcaption><span>01 · Show us the work</span><strong>A short phone video of your job.</strong></figcaption>
          <img
            src="/illustrations/task-evaluation/01-task-capture.webp"
            srcSet="/illustrations/task-evaluation/01-task-capture-840.webp 840w, /illustrations/task-evaluation/01-task-capture.webp 1672w"
            sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1200px) calc((100vw - 76px) / 2), (max-width: 1536px) calc((100vw - 128px) / 2), 704px"
            width={1672}
            height={941}
            fetchPriority="high"
            alt="Illustrative task capture: a worker films an operator holding a blue case above the empty left pocket of a three-pocket tray, with a supply tote behind it."
          />
        </figure>
        <figure>
          <figcaption><span>02 · Evaluate robot fit</span><strong>The same task, in simulation.</strong></figcaption>
          <img
            src="/illustrations/task-evaluation/02-arm-evaluation.webp"
            srcSet="/illustrations/task-evaluation/02-arm-evaluation-840.webp 840w, /illustrations/task-evaluation/02-arm-evaluation.webp 1671w"
            sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1200px) calc((100vw - 76px) / 2), (max-width: 1536px) calc((100vw - 128px) / 2), 704px"
            width={1671}
            height={941}
            alt="Illustrative simulation view: a fixed robot arm supports the same blue case above the outlined empty tray pocket in a digital cutaway of the warehouse workstation."
          />
        </figure>
      </div>
      <p className="ms-imagery-caption">Illustrative workflow · Capture and simulation views of the same job. Physical performance is tested in the on-site pilot.</p>
      <div className="ms-task-example-test">
        <h2>Can the robot take a case from the tote and place it flat in the empty pocket?</h2>
        <p><strong>Your criteria:</strong> cycle-time target · successful-placement target · allowed manual assistance</p>
      </div>
    </div>
  );
}
