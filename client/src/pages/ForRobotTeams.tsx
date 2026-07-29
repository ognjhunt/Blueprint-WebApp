import { ArrowRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Button, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { EditorialCtaBand, EditorialSectionIntro, MonochromeMedia } from "@/components/site/editorial";
import { TileGrid } from "@/components/site/TileGrid";
import { robotPolicyComparisonUseCases, robotPolicyEvaluationBoundary } from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const flow = [
  ["Describe the decision", "Bring the prospective site-task, candidates or checkpoints, thresholds, false-safe consequence, budget, deadline, and evidence constraints."],
  ["Maintain the testbed", "Blueprint links the request to an exact captured Site-Task Testbed version and digest."],
  ["Route claims", "Pipeline chooses the least expensive currently qualified evidence for each question and escalates only when needed."],
  ["Read the envelope", "See supported, rejected, unresolved, and abstained claims—not one undifferentiated score."],
  ["Choose field work", "Use the claim ceiling and next cheapest experiment to decide whether physical robot time is justified."],
] as const;

export default function ForRobotTeams() {
  return (
    <>
      <SEO title="Task Evaluation Runs for robot teams | Blueprint" description="Compare internal policies or checkpoints, test real-task compatibility, discover failure conditions, and decide whether field time is justified." canonical="/for-robot-teams" jsonLd={[webPageJsonLd({ path: "/for-robot-teams", name: "Task Evaluation Runs for robot teams", description: "One decision-oriented evaluation service for robot teams." }), breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "For robot teams", path: "/for-robot-teams" }])]} />
      <section className="bg-canvas">
        <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-10 lg:py-24">
          <div><Eyebrow tone="brass" rule>Task Evaluation Run · robot-team use case</Eyebrow><h1 className="mt-5 font-display text-[clamp(2.7rem,5vw,4.8rem)] font-medium leading-[1.01] tracking-[-0.05em] text-ink-900">Decide what deserves scarce robot time.</h1><p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-ink-500">Evaluate internal policies or checkpoints against a prospective real-site task, expose failure conditions, and learn whether the current evidence supports field testing—or requires a stronger experiment.</p><div className="mt-8"><Button asChild variant="brass" size="lg"><a href="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-robot-teams">Request a Task Evaluation Run <ArrowRight className="h-4 w-4" /></a></Button></div></div>
          <MonochromeMedia src="/redesign/pov/warehouse-tote.jpg" alt="Robot arm working near crates at a real site" loading="eager" radius="lg" overlay="soft" className="aspect-[16/11] border border-line"><span className="absolute left-3 top-3"><StatusChip tone="ink" square dot={false}>Illustrative workflow</StatusChip></span></MonochromeMedia>
        </div>
      </section>
      <section className="border-y border-line bg-paper"><div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24"><EditorialSectionIntro eyebrow="Robot-team wedge" title="Bring candidates when they matter. A ranking is not guaranteed." description="The run is organized around the decision and claims, not a tournament. A candidate can be supported, rejected, eliminated as incompatible, left unresolved, or included in an explicit abstention." /><TileGrid cols={3} className="mt-10">{robotPolicyComparisonUseCases.map((item) => <article key={item.title} className="bg-white p-6"><h2 className="text-title-m font-semibold text-ink-900">{item.title}</h2><p className="mt-3 text-sm leading-7 text-ink-500">{item.body}</p></article>)}</TileGrid></div></section>
      <section className="bg-canvas"><div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24"><EditorialSectionIntro eyebrow="One lifecycle" title="From site-task to decision or abstention." description="You describe the decision. Blueprint maintains the substrate and Pipeline owns scientific routing and verdicts." /><ol className="mt-10 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-5">{flow.map(([title, body], index) => <li key={title} className="bg-white p-5"><span className="font-mono text-xs text-brass">0{index + 1}</span><h2 className="mt-3 font-semibold text-ink-900">{title}</h2><p className="mt-2 text-sm leading-6 text-ink-500">{body}</p></li>)}</ol><div className="mt-8 grid gap-5 lg:grid-cols-2"><ProofBoundary level="info" title="Router in plain language">Blueprint uses the least expensive evidence that is trustworthy enough for each question, and asks for stronger evidence only when needed.</ProofBoundary><ProofBoundary level="warn" title="Evidence boundary">{robotPolicyEvaluationBoundary}</ProofBoundary></div></div></section>
      <section className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-20"><EditorialCtaBand eyebrow="Start with the decision" title="Request a Task Evaluation Run." description="Tell us the site-task, candidates, claims, thresholds, consequences, evidence, budget, deadline, and restrictions. The method plan is Blueprint’s responsibility." imageSrc="/redesign/pov/packing-cell.jpg" imageAlt="Warehouse task environment" primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=for-robot-teams-cta" primaryLabel="Request a Task Evaluation Run" secondaryHref="/pricing" secondaryLabel="See engagement model" /></section>
    </>
  );
}
