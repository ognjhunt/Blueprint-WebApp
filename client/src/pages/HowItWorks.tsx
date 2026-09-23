import { ArrowRight } from "lucide-react";
import { EvaluationExample } from "@/components/site/EvaluationExample";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "How Blueprint turns one site task into a fair comparison of robot teams, a practical shortlist, and a pilot recommendation.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>How we find the robot that fits your task.</h1><p>Robots differ, and so do the policies that run them. We test the candidates against your actual task, so you know which one is worth a physical pilot before anyone commits to one.</p></header>
      <div className="ms-how-steps ms-how-preparation">
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Define the task.</h2><p>Describe the task and share photos or a video, along with your pilot plans. We work out what success looks like, check the site and task suit a robot, and rebuild the work area as a simulated scene.</p><span className="ms-how-result">A task brief you approve, and a scene robots can be tested in.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Bring in the right robot teams.</h2><p>With your approval, robot teams see a card for your task, never your footage. They can test several robots, policies, and checkpoints against the same task and the same pass mark, and we run every entry the same way so the results can be compared.</p><span className="ms-how-result">Every candidate measured the same way.</span></div></section>
      </div>
      <EvaluationExample />
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Get a clear pilot recommendation.</h2><p>Get a practical shortlist, a recommended configuration, expected failure points, and a physical test plan—or a clear reason to pause. Your site and selected robot team own installation and operation.</p><span className="ms-how-result">A clear next step for your site.</span></div></section>
      </div>
      <aside className="ms-how-open"><h2>Any robot that fits the task can take part.</h2><p>Fixed arms, humanoids, wheeled humanoids, mobile manipulators, and the policies that run them. All robotics teams can apply, and a single team can evaluate multiple checkpoints. How many candidates a task gets depends on the task and the robots available for it.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
