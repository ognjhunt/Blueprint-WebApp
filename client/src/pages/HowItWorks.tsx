import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Turn a qualified site opportunity into robot-team evaluations, a practical shortlist, and a clear pilot recommendation.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" image="https://tryblueprint.io/images/site-led/embodiments/humanoid.webp" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>Start with the task.<br />Find the right fit.</h1><p>Different robots. Different policies. One question: what will work for your site?</p></header>
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Qualify the opportunity.</h2><p>Share your task, a video, and your pilot plans. We confirm success criteria, site access, ownership, and budget, then prepare a qualified listing and the task environment for evaluation.</p><span className="ms-how-result">A qualified opportunity, ready for the right teams.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Bring in the right robot teams.</h2><p>With your approval, we bring your qualified listing to relevant robot teams. Teams can test multiple embodiments, policies, and checkpoints against the same task and success criteria. Blueprint coordinates the evaluations and makes the results comparable.</p><span className="ms-how-result">Teams evaluate. We make the comparison clear.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Get a clear pilot recommendation.</h2><p>Get a practical shortlist, a recommended configuration, expected failure points, and a physical test plan—or a clear reason to pause. Your site and selected robot team own installation and operation.</p><span className="ms-how-result">A clear next step for your site.</span></div></section>
      </div>
      <aside className="ms-how-open"><h2>The task comes first.<br />The embodiment follows.</h2><p>Fixed arms, humanoids, wheeled humanoids, mobile manipulators—and the policies that run them. All robotics teams can apply, and a single team can evaluate multiple checkpoints. Candidate count follows the task, available systems, and agreed evaluation scope.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Discuss your site <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply as a robot team <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
