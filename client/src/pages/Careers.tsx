import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionLabel,
  MonochromeMedia,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
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

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10">
          <MonochromeMedia
            src={editorialGeneratedAssets.careersStudio}
            alt="Careers hero"
            className="min-h-[38rem] rounded-none"
            loading="eager"
            imageClassName="min-h-[38rem]"
            overlayClassName="bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_78%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto h-full max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="flex h-full max-w-[36rem] flex-col justify-end">
                <EditorialSectionLabel light>Careers</EditorialSectionLabel>
                <h1 className="font-editorial mt-6 text-[3.7rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5rem]">
                  Build the product layer between raw site capture and a buyer who needs a straight answer.
                </h1>
                <p className="mt-6 text-base leading-8 text-white/72">
                  The work sits between asset production, tooling, and product judgment. It should feel like a serious craft company, not a jobs board.
                </p>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <div
                  key={role.title}
                  className={index === 1 ? "bg-slate-950 p-6 text-white" : "bg-white p-6 text-slate-950"}
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-4">
                      <div className={index === 1 ? "border border-white/14 bg-white/6 p-3 text-white" : "border border-black/10 bg-[#f5f3ef] p-3 text-slate-950"}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-editorial text-[2.3rem] leading-[0.95] tracking-[-0.04em]">
                          {role.title}
                        </h2>
                        <div className={`mt-2 flex flex-wrap gap-3 text-sm ${index === 1 ? "text-white/54" : "text-slate-500"}`}>
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
                      className={index === 1 ? "inline-flex items-center bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100" : "inline-flex items-center bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"}
                    >
                      Apply by email
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                  <p className={`mt-6 text-base leading-7 ${index === 1 ? "text-white/72" : "text-slate-600"}`}>{role.summary}</p>
                  <p className={`mt-4 text-sm leading-7 ${index === 1 ? "text-white/66" : "text-slate-600"}`}>{role.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
          <EditorialCtaBand
            eyebrow="Open line"
            title="If the work is relevant, send the note."
            description="Don’t see the exact fit? Send a short note and portfolio. If the work maps to the product, it will get read."
            imageSrc={editorialGeneratedAssets.careersStudio}
            imageAlt="Blueprint careers studio"
            primaryHref="mailto:careers@tryblueprint.io"
            primaryLabel="careers@tryblueprint.io"
            dark={false}
          />
        </section>
      </div>
    </>
  );
}
