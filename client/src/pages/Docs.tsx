import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "Stable contract",
    body:
      "These parts of the product stay the same regardless of which site or hosted backend is used.",
    bullets: [
      "Capture truth: walkthrough media, timestamps, poses, and device metadata",
      "Rights, privacy, consent, and provenance metadata",
      "Package manifests and hosted-session contracts",
      "Buyer-facing licensing, export, and access rules",
    ],
  },
  {
    title: "Site package contents",
    body:
      "The site package gives your team everything it needs to run its own world model stack on that facility.",
    bullets: [
      "Walkthrough video, timestamps, and camera poses tied to one real facility",
      "Intrinsics, depth, and geometry files when the source capture supports them",
      "Site notes, provenance, privacy, and rights metadata",
      "Package manifest and reference material for building your own world model",
    ],
  },
  {
    title: "Hosted evaluation outputs",
    body:
      "Hosted evaluation is a Blueprint-managed hosted session on one exact site. Your team can run, review, and export without moving data into your own stack first.",
    bullets: [
      "Repeatable runs on the same exact site",
      "Rollout video, failure review, and checkpoint comparison",
      "Dataset, raw bundle, and export generation tied to the listing",
      "A browser-accessible hosted session — no local setup required",
    ],
  },
  {
    title: "What varies by listing",
    body:
      "Not every site has the same files or export options. Check the listing before assuming every workflow supports the same depth of work.",
    bullets: [
      "Depth and geometry coverage",
      "Available scenario variations and start states",
      "Robot assumptions and sensor requirements",
      "Export set, freshness state, and any restricted zones",
    ],
  },
];

const exportSchemaRows = [
  ["site_id", "Stable identifier for the exact site or sample listing."],
  ["capture_basis", "Public demo, operator-approved, request-scoped, or metadata-only."],
  ["freshness_state", "Current, stale, sample, or pending recapture."],
  ["rights_class", "What can be inspected, shared, exported, or commercialized."],
  ["privacy_state", "Redaction status, raw-media retention, and buyer-visible limits."],
  ["file_set", "Manifest, rights sheet, hosted report, export bundle, route notes."],
];

const bundleTree = [
  "/manifest/site_package_manifest.json",
  "/rights/site_rights_sheet.md",
  "/capture/route_notes.md",
  "/media/review_filmstrip/",
  "/hosted/session_report.md",
  "/exports/buyer_bundle_index.json",
];

const assumptions = [
  {
    title: "Robot profile",
    body: "Hosted review scopes one robot class, sensor posture, task, and scenario set. Blueprint does not assume every robot can use every export.",
  },
  {
    title: "Sensors and geometry",
    body: "Camera, pose, depth, LiDAR, and geometry files depend on the capture method and listing. The manifest should say what exists before export access.",
  },
  {
    title: "Hosted-session limits",
    body: "Hosted sessions are review environments. They can expose route behavior, observations, and comparison notes; they are not deployment certification.",
  },
  {
    title: "Versioning",
    body: "Packages should carry capture date, package version, freshness state, and export state so buyers can tell which exact site snapshot they are reviewing.",
  },
];

const limits = [
  "No blanket export rights unless the listing or order form says so.",
  "No unrestricted raw media export from public-facing capture by default.",
  "No private or restricted-zone capture without explicit authority.",
  "No guarantee that a sample or hosted run predicts deployment performance.",
];

export default function Docs() {
  return (
    <>
      <SEO
        title="Compatibility and Exports | Blueprint"
        description="The stable Blueprint product contract, the site package structure, the hosted evaluation path, and the listing details that can vary."
        canonical="/docs"
      />
      <div className="min-h-screen bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.52fr_0.48fr] lg:px-10 lg:py-16">
            <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Compatibility and exports
            </p>
            <h1 className="font-editorial mt-5 text-[3.8rem] leading-[0.9] tracking-[-0.06em] text-slate-950 sm:text-[5rem]">
              Technical shape before the sales call.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              This page is for technical buyers. It separates the stable product contract from the
              listing-specific details so your team can tell what is safe to assume and what should
              be checked on the exact site.
            </p>
            </div>
            <div className="bg-slate-950 p-6 text-white lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Sample bundle tree</p>
              <div className="mt-6 space-y-3 font-mono text-[12px] leading-6 text-white/70">
                {bundleTree.map((item) => (
                  <div key={item} className="border border-white/10 bg-white/5 px-4 py-3">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="border border-black/10 bg-white p-6"
              >
                <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em] text-slate-950">{section.title}</h2>
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
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 sm:px-8 lg:grid-cols-[0.36fr_0.64fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Export schema</p>
              <h2 className="font-editorial mt-4 text-[2.7rem] leading-[0.94] tracking-[-0.05em]">
                Fields a buyer should see before export access.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-600">
                This is the public compatibility contract. Real listings can add deeper files, but these labels keep provenance, privacy, rights, and freshness readable.
              </p>
            </div>
            <div className="divide-y divide-black/10 border border-black/10 bg-white">
              {exportSchemaRows.map(([field, meaning]) => (
                <div key={field} className="grid gap-3 p-4 text-sm leading-6 text-slate-700 md:grid-cols-[0.24fr_0.76fr]">
                  <span className="font-mono text-[12px] text-slate-950">{field}</span>
                  <span>{meaning}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-[0.58fr_0.42fr]">
            <div className="grid gap-4 md:grid-cols-2">
              {assumptions.map((item) => (
                <div key={item.title} className="border border-black/10 bg-white p-6">
                  <h2 className="font-editorial text-[2rem] leading-[0.95] tracking-[-0.04em]">{item.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-950 p-6 text-white lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Limits</p>
              <h2 className="font-editorial mt-4 text-[2.6rem] leading-[0.94] tracking-[-0.05em]">
                What the docs do not imply.
              </h2>
              <div className="mt-6 space-y-4 text-sm leading-7 text-white/70">
                {limits.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
