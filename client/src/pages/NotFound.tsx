import { SEO } from "@/components/SEO";

export default function NotFound() {
  return (
    <>
      <SEO
        title="Page Not Found"
        description="The page you're looking for has moved. Return home to prepare a site task or evaluate a robot deployment opportunity."
        noIndex={true}
      />
      <div className="mx-auto flex min-h-[60vh] max-w-[44rem] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="runway-eyebrow-muted">404</p>
        <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-bold uppercase leading-[0.96] tracking-[0.005em] text-runway-text">
          Page not found
        </h1>
        <p className="max-w-[44ch] text-[16px] leading-[1.7] text-runway-body">
          The page you’re looking for has moved. Return home to submit a workflow, join as a robot team, or review how Blueprint prepares months 0–2.
        </p>
        <a href="/" className="runway-cta">
          Back to home
        </a>
      </div>
    </>
  );
}
