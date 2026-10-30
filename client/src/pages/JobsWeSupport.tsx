import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";

const examples = [
  { title: "Move known objects", body: "Pick a defined range of rigid items from a tote and place them into a tray or fixture." },
  { title: "Load and unload a workstation", body: "Move parts between the same start and finish positions, cycle after cycle. We check reach, payload and the machine interfaces involved." },
  { title: "Open, close or reposition", body: "One repeatable action on a known object or mechanism, such as a drawer, door or lid, with a clear point where the task is complete." },
];

export default function JobsWeSupport() {
  return <>
    <SEO title="Jobs we support | Blueprint" description="Start with one recurring job, known objects and a clear outcome. Blueprint tests robots and policies on it in a simulation of your site and shows you an estimate of what's likely to work." canonical="/jobs-we-support" />
    <section className="ms-container ms-supported-page" aria-labelledby="supported-title">
      <p className="ms-eyebrow">Jobs we support</p>
      <h1 id="supported-title">Start with one repeatable job.</h1>
      <p className="ms-supported-intro">A stable workstation, known objects and a clear result make a useful starting point. Show the work as it happens today on video; you do not need to choose a robot.</p>
      <div className="ms-supported-examples">{examples.map(example => <article key={example.title}><h2>{example.title}</h2><p>{example.body}</p></article>)}</div>
      <section className="ms-supported-detail" aria-labelledby="fit-title">
        <h2 id="fit-title">We check the job before choosing the equipment.</h2>
        <ul><li>What a good result looks like, and how often the work happens.</li><li>Object variation, weight, reach, space and site restrictions.</li><li>Required quality, speed, human assistance and total operating cost.</li><li>Which deployment companies can supply, install and support the approach that wins.</li></ul>
        <p>We check task fit and compatibility for every job. Robot form alone doesn&apos;t show that a setup can do the work. These examples are starting points, not completed deployments.</p>
      </section>
      <section className="ms-supported-detail" aria-labelledby="different-title"><h2 id="different-title">Your job is different?</h2><p>Show us the work on video. We do not turn a job away because of its type. If we can&apos;t simulate yours yet, we accept it and hold it while we prepare its evaluation. If information is missing, we tell you what. If no robot or policy suits your job, we explain why. You don&apos;t need a confirmed budget to start.</p></section>
      <a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={18} aria-hidden="true" /></a>
    </section>
  </>;
}
