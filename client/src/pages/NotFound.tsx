import { SEO } from "@/components/SEO";

export default function NotFound() {
  return (
    <>
      <SEO
        title="Page Not Found"
        description="The page you're looking for has moved. Return home to explore Blueprint's certified scene and dataset catalog."
        noIndex={true}
      />
      <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">404</p>
      <h1 className="text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-md text-sm text-slate-600">
        The page you’re looking for has moved. Return home to explore the certified scene and dataset catalog.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Back to home
      </a>
    </div>
    </>
  );
}
