import { SEO } from "@/components/SEO";

export default function NotFound() {
  return (
    <>
      <SEO
        title="Page Not Found"
        description="The page you're looking for has moved. Return home to prepare a site task or evaluate a robot deployment opportunity."
        noIndex={true}
      />
      <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-runway-faint">404</p>
      <h1 className="text-3xl font-semibold text-runway-text">Page not found</h1>
      <p className="max-w-md text-sm text-runway-mute">
        The page you’re looking for has moved. Return home to submit a workflow, join as a robot team, or review how Blueprint prepares months 0–2.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-sm bg-runway-signal px-6 py-3 text-sm font-semibold text-runway-black transition hover:bg-runway-signal-deep"
      >
        Back to home
      </a>
    </div>
    </>
  );
}
