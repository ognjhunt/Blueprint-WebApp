import { SEO } from "@/components/SEO";
import { ArrowRight, Briefcase, Code2, PenTool } from "lucide-react";

const roles = [
  {
    title: "3D Artist",
    type: "Contract",
    location: "Remote",
    summary:
      "Turn raw capture and reference material into clean, usable site assets with disciplined geometry, good judgment, and fast iteration.",
    description:
      "This role is for someone who can take messy real-world inputs and make them legible. We care about accuracy, clean topology, and a practical eye for what a robot team actually needs back.",
    href: "mailto:apply+artist@tryblueprint.io?subject=Blueprint%203D%20Artist",
    icon: PenTool,
  },
  {
    title: "USD Tools Engineer",
    type: "Full-time",
    location: "Remote",
    summary:
      "Build the tooling that turns capture inputs into production-ready world-model packages without burying the team in manual cleanup.",
    description:
      "You would work on the asset and packaging pipeline itself: validation, structure, repeatability, and the parts of the workflow that have to stay boring because buyers depend on them.",
    href: "mailto:apply+usd@tryblueprint.io?subject=Blueprint%20USD%20Tools%20Engineer",
    icon: Code2,
  },
];

export default function Careers() {
  return (
    <>
      <SEO
        title="Careers | Blueprint"
        description="Open roles at Blueprint across asset production and tooling for site-specific world-model delivery."
        canonical="/careers"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Careers
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Build the product layer between raw site capture and a buyer who needs clarity.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Blueprint is trying to make one thing less messy: taking a real facility and turning
              it into a world-model package a robotics team can actually evaluate. That means the
              work sits somewhere between asset production, tooling, and product judgment.
            </p>
          </div>

          <div className="mt-12 grid gap-4">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <article key={role.title} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-4">
                      <div className="rounded-2xl bg-white p-3 text-slate-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-slate-900">{role.title}</h2>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-4 w-4" />
                            {role.type}
                          </span>
                          <span>{role.location}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={role.href}
                      className="inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Apply by email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                  <p className="mt-6 text-base leading-7 text-slate-600">{role.summary}</p>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{role.description}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-12 rounded-[2rem] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            Don&apos;t see the right fit? Send a note and portfolio to{" "}
            <a href="mailto:careers@tryblueprint.io" className="font-semibold text-slate-900">
              careers@tryblueprint.io
            </a>
            . If the work is relevant, we will read it.
          </div>
        </div>
      </div>
    </>
  );
}
