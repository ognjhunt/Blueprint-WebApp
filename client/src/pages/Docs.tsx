import { SEO } from "@/components/SEO";
import {
  hostedEvaluationDefinition,
  hostedEvaluationOutputs,
  listingVariationItems,
  sitePackageDefinition,
  sitePackageIncludes,
  stableContractItems,
} from "@/data/marketingDefinitions";

const sections = [
  {
    title: "Stable contract",
    body:
      "These are the parts of the product that should survive runtime swaps and product iteration.",
    bullets: stableContractItems,
  },
  {
    title: "Site package",
    body: sitePackageDefinition,
    bullets: sitePackageIncludes,
  },
  {
    title: "Hosted evaluation",
    body: hostedEvaluationDefinition,
    bullets: hostedEvaluationOutputs,
  },
  {
    title: "What varies by listing",
    body:
      "Not every site has the same artifacts, export surface, or robot fit. Buyers should check the listing instead of assuming every lane supports the same depth of work.",
    bullets: listingVariationItems,
  },
];

export default function Docs() {
  return (
    <>
      <SEO
        title="Compatibility and Exports | Blueprint"
        description="The stable Blueprint product contract, the site package structure, the hosted evaluation path, and the listing details that can vary."
        canonical="/docs"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Compatibility and exports
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              What stays stable, what the package contains, and what can vary by site.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              This page is for technical buyers. It separates the stable product contract from the
              listing-specific details so your team can tell what is safe to assume and what should
              be checked on the exact site.
            </p>
          </div>

          <div className="mt-12 grid gap-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <h2 className="text-2xl font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                  {section.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
