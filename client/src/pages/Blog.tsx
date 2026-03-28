import { SEO } from "@/components/SEO";

const updates = [
  {
    title: "Why the product starts with one real site",
    body:
      "The buyer side only works when the site itself is real. Capture quality is what makes the catalog credible.",
  },
  {
    title: "Why scene packages matter before deployment",
    body:
      "The goal is not to replace the final site visit. The goal is to stop showing up blind.",
  },
  {
    title: "Why hosted evaluation should survive backend swaps",
    body:
      "Runtimes will change. Buyers still need one clean path to the exact site, the exact task lane, and the exact outputs that matter.",
  },
];

export default function Blog() {
  return (
    <>
      <SEO
        title="Blog | Blueprint"
        description="Short product notes from Blueprint on capture supply, world-model packages, hosted access, and buyer workflow."
        canonical="/blog"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Blog
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Notes on how Blueprint is being packaged.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              This page is for short notes on the product surface: real capture, scene packages,
              hosted evaluation, and the buyer workflow around them.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {updates.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
              >
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/world-models"
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Explore world models
            </a>
            <a
              href="/sample-deliverables"
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              See deliverables
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
