import { SEO } from "@/components/SEO";
import { Cpu, ArrowRight, CheckCircle2, Shield, Target } from "lucide-react";

export default function Sim2RealFidelity() {
  return (
    <>
      <SEO
        title="Sim-to-Real Fidelity Matrix | Blueprint - Transfer Validation"
        description="Physics, visual, sensor, and contact fidelity validation. A-F grades for each dimension with transfer confidence scores. Reduce sim-to-real transfer risk by $100K+."
        canonical="/analytics/sim2real-fidelity"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
                <Cpu className="h-4 w-4 text-zinc-700" />
                Premium Analytics
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Sim-to-Real Fidelity Matrix
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Comprehensive physics validation with A-F grades across friction, mass, dynamics, visual accuracy, sensor fidelity, and contact physics. Generate a trust matrix that tells labs exactly which aspects of simulation they can rely on for training.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">$100K+</div>
                <p className="mt-2 text-sm text-zinc-600">Savings in avoided failed deployments</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">5 Dims</div>
                <p className="mt-2 text-sm text-zinc-600">Physics, visual, sensor, contact, randomization</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">0-100%</div>
                <p className="mt-2 text-sm text-zinc-600">Transfer confidence per aspect</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=sim2real-fidelity"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/analytics"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                View All Modules
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Fidelity Dimensions</h2>
                <p className="mt-2 text-zinc-600">
                  Six aspects of simulation graded on quality and transferability
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Physics Accuracy",
                    description: "Friction coefficients, mass distribution, joint dynamics compared to real hardware",
                  },
                  {
                    title: "Visual Realism",
                    description: "Texture accuracy, material properties (PBR), lighting, and rendering fidelity",
                  },
                  {
                    title: "Sensor Simulation",
                    description: "Camera distortion models, depth accuracy, proprioception drift and noise",
                  },
                  {
                    title: "Contact Dynamics",
                    description: "Force response accuracy, deformation modeling, impact behavior",
                  },
                  {
                    title: "Robot Fidelity",
                    description: "Kinematics, dynamics, control frequency, sensor suite matching",
                  },
                  {
                    title: "Domain Randomization",
                    description: "Coverage analysis of randomization parameters and variations",
                  },
                ].map((feature, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{feature.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Use Cases</h2>
              <p className="mt-2 text-zinc-600">
                Who benefits from sim-to-real fidelity validation
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: <Shield className="h-6 w-6 text-zinc-700" />,
                  title: "Pre-Deployment Validation",
                  description: "De-risk real-world robot deployments with transfer confidence scores",
                },
                {
                  icon: <Target className="h-6 w-6 text-zinc-700" />,
                  title: "Fine-Tuning Strategy",
                  description: "Identify which simulation aspects need real-world adaptation",
                },
                {
                  icon: <CheckCircle2 className="h-6 w-6 text-zinc-700" />,
                  title: "Stakeholder Proof",
                  description: "Show boards and customers why simulation data is trustworthy",
                },
                {
                  icon: <Cpu className="h-6 w-6 text-zinc-700" />,
                  title: "Cross-Robot Validation",
                  description: "Verify fidelity consistency across multiple robot embodiments",
                },
              ].map((useCase, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      {useCase.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-950">{useCase.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{useCase.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Why This Matters</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Save $100K+ in Deployments</h3>
                  <p className="mt-3 text-zinc-600">
                    Failed real-robot experiments cost labs hundreds of thousands. Know your transfer risk before deploying.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">A-F Confidence Grades</h3>
                  <p className="mt-3 text-zinc-600">
                    Easy-to-understand grades for each physics aspect. No ambiguity about which parts to trust.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Targeted Fine-Tuning</h3>
                  <p className="mt-3 text-zinc-600">
                    Know exactly where to focus real-world adaptation. Only refine the high-risk simulation aspects.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Investor Confidence</h3>
                  <p className="mt-3 text-zinc-600">
                    Prove your data quality and transfer success rates to investors and board members.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-950">
              Sim-to-Real Fidelity Matrix
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Enterprise and Foundation tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$15,000</p>
              <p className="mt-2 text-sm text-zinc-600">per dataset</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=sim2real-fidelity&tier=enterprise"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Enterprise Bundle
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=sim2real-fidelity"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
