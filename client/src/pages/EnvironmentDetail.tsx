import { scenes } from "@/data/content";
import { InteractionBadges } from "@/components/site/InteractionBadges";
import { SpecList } from "@/components/site/SpecList";
import { SceneCard } from "@/components/site/SceneCard";

interface EnvironmentDetailProps {
  params: {
    slug: string;
  };
}

export default function EnvironmentDetail({ params }: EnvironmentDetailProps) {
  const scene = scenes.find((item) => item.slug === params.slug);

  if (!scene) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-semibold text-slate-900">
          Scene not found
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          The environment you are looking for isn’t in our network yet. Browse other scenes or contact us to request a custom build.
        </p>
        <a
          href="/environments"
          className="mt-6 inline-flex rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
        >
          Back to environments
        </a>
      </div>
    );
  }

  const related = scenes
    .filter((item) => item.slug !== scene.slug && item.categories.some((category) => scene.categories.includes(category)))
    .slice(0, 3);

  const specItems = [
    { label: "USD version", value: scene.usdVersion },
    { label: "Units", value: scene.units },
    { label: "Material model", value: scene.materials },
    { label: "Tested with", value: scene.testedWith },
    { label: "Lead time", value: scene.leadTime },
    { label: "Colliders", value: scene.colliders },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
      <header className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {scene.tags.join(" • ")}
          </p>
          <h1 className="text-4xl font-semibold text-slate-900">{scene.title}</h1>
          <p className="text-sm text-slate-600">{scene.seo}</p>
          <div className="space-y-4">
            <h2 className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Interaction coverage
            </h2>
            <InteractionBadges
              types={scene.interactions.map((interaction) => interaction.type)}
            />
            <div className="grid gap-3 text-sm text-slate-600">
              {scene.interactions.map((interaction) => (
                <div key={interaction.component} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      {interaction.component}
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {interaction.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Axis {interaction.axis || "—"} • Limits {interaction.limits || "N/A"}
                  </p>
                  {interaction.notes ? (
                    <p className="mt-2 text-xs text-slate-500">{interaction.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {scene.ctaText}
            </a>
            {scene.download ? (
              <a
                href={scene.download}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
              >
                Download sample
              </a>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4">
          {scene.gallery.map((src) => (
            <div key={src} className="overflow-hidden rounded-3xl border border-slate-200">
              <img src={src} alt="Scene preview" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">What’s included</h2>
          <ul className="space-y-3 text-sm text-slate-600">
            <li>USD stage referencing articulated assets with validated limits.</li>
            <li>Texture set (albedo, normal, roughness) and OpenPBR material definitions.</li>
            <li>Collision package ({scene.colliders}) tuned for robotics simulation.</li>
            <li>Optional Replicator annotations: {scene.replicator ?? "available on request"}.</li>
          </ul>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            <h3 className="text-sm font-semibold text-slate-900">Delivery</h3>
            <p className="mt-2">
              Standard lead time: {scene.leadTime}. Rush delivery available pending scope. Scenes are shipped via secure link with release notes and Isaac validation checklists.
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Specs</h2>
          <SpecList items={specItems} />
        </div>
      </section>

      {related.length ? (
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            Related environments
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <SceneCard key={item.slug} scene={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
