import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Start with a real manipulation task. Compare compatible robots and policies, then use the evidence to decide what deserves a physical pilot.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" image="https://tryblueprint.io/images/site-led/embodiments/humanoid.webp" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>Start with the task.<br />Find the right fit.</h1><p>Different robots. Different policies. One question: what will work for your site?</p></header>
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Define the work.</h2><p>Share the task, a video, and your pilot plans. Together, we define success, capture the relevant site conditions, and agree the evaluation scope and price.</p><span className="ms-how-result">A clear task, budget, and test plan.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Compare the candidates.</h2><p>We assess the embodiment and policy together. Two compatible candidates are evaluated against the same task and conditions, with the assumptions and limits made explicit.</p><span className="ms-how-result">A comparison you can inspect.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Run a pilot with a purpose.</h2><p>Get a recommendation, expected failure points, and the physical tests needed to check the prediction—or a clear reason to pause. Your site and selected robot team own installation and operation.</p><span className="ms-how-result">A next step grounded in evidence.</span></div></section>
      </div>
      <aside className="ms-how-open"><h2>The task comes first.<br />The embodiment follows.</h2><p>Fixed arms, humanoids, wheeled humanoids, mobile manipulators—and the policies that run them. All robotics teams can apply. Participation depends on task fit, available interfaces, and site approval.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Discuss your site <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply as a robot team <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
