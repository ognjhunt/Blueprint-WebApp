import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { MinimalSiteLayout } from "@/components/site/MinimalSiteLayout";

export default function NotFound() {
  return <MinimalSiteLayout>
    <SEO title="Page not found | Blueprint" description="This page could not be found. Go back to Blueprint to start a job or apply as a deployment company." noIndex />
    <section className="ms-not-found ms-container">
      <p className="ms-eyebrow">404</p>
      <h1>That page isn’t here.</h1>
      <a className="ms-button" href="/">Back to Blueprint <ArrowRight size={18} aria-hidden="true" /></a>
    </section>
  </MinimalSiteLayout>;
}
