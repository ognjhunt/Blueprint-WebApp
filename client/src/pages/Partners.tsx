import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Partners() {
  return <>
    <SEO title="Partners | Blueprint" description="Help deliver real work. Join Blueprint as a deployment partner, or make your robot hardware, policies or model APIs available for assessment." canonical="/partners" />
    <section className="ms-partner-intro ms-container" aria-labelledby="partners-title">
      <p className="ms-eyebrow">For partners</p>
      <h1 id="partners-title">Help deliver real work.</h1>
      <p className="ms-partner-lead">Connect your capabilities to a customer's job. Tell us what you can provide, where it fits and who takes responsibility for delivery.</p>
    </section>
    <section className="ms-partner-paths ms-container" aria-label="Choose your partner role">
      <a className="ms-partner-path" href="/partners/deployment">
        <p className="ms-eyebrow">Install, commission and support</p>
        <h2>Deployment partners</h2>
        <p>Review scoped jobs, propose a delivery plan and support the systems your team installs or operates.</p>
        <span className="ms-text-link">Apply as a deployment partner <ArrowRight size={19} aria-hidden="true" /></span>
      </a>
      <a className="ms-partner-path" href="/partners/technology">
        <p className="ms-eyebrow">Hardware, policies and model APIs</p>
        <h2>Robot technology providers</h2>
        <p>Make your system available for assessment on compatible jobs, with a defined interface and clear evidence.</p>
        <span className="ms-text-link">Make your system available <ArrowRight size={19} aria-hidden="true" /></span>
      </a>
    </section>
    <section className="ms-partner-footer ms-container" aria-label="How partnerships work">
      <p>A company can do both. Choose your main role and describe the other in your application. Applications and approved evaluations are free during the beta; job invitations and access follow review.</p>
      <p>Already approved? <a href="/sign-in">Sign in to your workspace</a>. Have work at your own site? <a href="/contact/site-operator">Submit a job</a>.</p>
    </section>
  </>;
}
