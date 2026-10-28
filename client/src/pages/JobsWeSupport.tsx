import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";

const examples = [
  { title: "Move known objects", body: "Pick a defined range of rigid items from a tote and place them into a tray or fixture." },
  { title: "Load and unload a workstation", body: "Repeat a bounded transfer between known start and finish positions. We check reach, payload and the interfaces involved." },
  { title: "Open, close or reposition", body: "Assess one repeatable interaction with a known object or mechanism, with a clear completion rule." },
];

export default function JobsWeSupport() {
  return <>
    <SEO title="Jobs we support | Blueprint" description="Start with one recurring job, known objects and a clear outcome. Blueprint runs candidate robots and policies on it in a simulation of your site and shows you a bounded estimate of what works." canonical="/jobs-we-support" />
    <section className="ms-container ms-supported-page" aria-labelledby="supported-title">
      <p className="ms-eyebrow">Jobs we support</p>
      <h1 id="supported-title">Start with one repeatable job.</h1>
      <p className="ms-supported-intro">A stable workstation, known objects and a clear result make a useful starting point. Show the work as it happens today on video; you do not need to choose a robot.</p>
      <div className="ms-supported-examples">{examples.map(example => <article key={example.title}><h2>{example.title}</h2><p>{example.body}</p></article>)}</div>
      <section className="ms-supported-detail" aria-labelledby="fit-title">
        <h2 id="fit-title">We check the job before choosing the equipment.</h2>
        <ul><li>What a good result looks like, and how often the work happens.</li><li>Object variation, weight, reach, space and site restrictions.</li><li>Required quality, speed, human assistance and total operating cost.</li><li>Which deployment companies can supply, install and support the approach that wins.</li></ul>
        <p>Task fit and compatibility are checked for each job. Robot form alone does not establish that a setup can perform the work. Examples are starting points, not claims of completed deployments.</p>
      </section>
      <section className="ms-supported-detail" aria-labelledby="different-title"><h2 id="different-title">Your job is different?</h2><p>Show us the work on video. We do not turn a job away because of its type: if we cannot score yours in simulation yet, we accept it and hold it while we prepare its evaluation. If information is missing, we tell you what; if no candidate suits your job, we explain why. You do not need a confirmed budget to start.</p></section>
      <a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={18} aria-hidden="true" /></a>
    </section>
  </>;
}
