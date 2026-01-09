import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import {
  Check,
  Sparkles,
  Users,
  Target,
  Zap,
  Rocket,
  Shield,
  TrendingUp,
  FlaskConical,
  Heart,
  Star,
  ChevronRight,
} from "lucide-react";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern)"
      />
    </svg>
  );
}

export default function PartnerProgram() {
  return (
    <>
      <SEO
        title="Partner Program - Join Our Early Access Partners"
        description="Partner with Blueprint to validate and shape the future of robotics simulation and synthetic data. Get free access to our full suite of services during the validation phase."
        canonical="/partners"
      />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero Header */}
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-emerald-700 backdrop-blur-sm">
              <Rocket className="h-4 w-4" />
              Early Partner Program
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
              Everything free. Help us prove it works.
            </h1>
            <p className="mx-auto max-w-3xl text-xl leading-relaxed text-zinc-600">
              We're an early-stage startup building a robotics data platform. Our pipeline is ready,
              but we need <span className="font-semibold text-indigo-600">real labs like yours</span> to
              validate that our data actually helps train better robots. In exchange, you get
              <span className="font-semibold text-emerald-600"> everything free</span> — no commitments, no risk.
            </p>
          </div>

          {/* What We're Building */}
          <div className="mb-16 rounded-3xl border border-zinc-200 bg-gradient-to-br from-indigo-50/50 to-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <FlaskConical className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-900">What you'll get (completely free)</h2>
            </div>
            <p className="mb-8 text-lg text-zinc-600">
              We've built a platform that generates training data for robots. Think of it as a complete data factory —
              from realistic 3D environments to thousands of robot training examples with analytics that tell you
              if your data is actually good. We need a few labs to use it and tell us what works and what doesn't.
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Service Card 1 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  3D Training Environments
                </h3>
                <p className="mb-2 text-sm text-zinc-500">Worth $5,000-$25,000</p>
                <p className="text-sm text-zinc-600">
                  Realistic 3D scenes (kitchens, offices, warehouses) where your robot can practice tasks.
                  Hundreds of variations so your AI learns to handle different situations.
                </p>
              </div>

              {/* Service Card 2 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Training Data Generation
                </h3>
                <p className="mb-2 text-sm text-zinc-500">Worth $115,000-$260,000</p>
                <p className="text-sm text-zinc-600">
                  Thousands of robot training examples automatically generated. Includes everything your AI needs:
                  camera views, robot positions, success/failure data, and quality checks.
                </p>
              </div>

              {/* Service Card 3 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Data Quality Reports
                </h3>
                <p className="mb-2 text-sm text-zinc-500">Worth $15,000-$35,000</p>
                <p className="text-sm text-zinc-600">
                  Automatic reports that tell you: "Is my training data actually good?"
                  We analyze coverage, identify gaps, and recommend what data to collect next.
                </p>
              </div>

              {/* Service Card 4 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Multi-Robot Support
                </h3>
                <p className="mb-2 text-sm text-zinc-500">Worth $20,000-$100,000</p>
                <p className="text-sm text-zinc-600">
                  Works with multiple robot types (arms, mobile robots, humanoids).
                  We analyze if training data from one robot can help train another.
                </p>
              </div>

              {/* Service Card 5 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Real Robot Testing
                </h3>
                <p className="mb-2 text-sm text-zinc-500">Worth $20,000-$50,000</p>
                <p className="text-sm text-zinc-600">
                  We help you test if training in simulation actually works on your real robot.
                  We'll work with you to measure and improve the transfer from sim to real.
                </p>
              </div>

              {/* Service Card 6 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Everything Else
                </h3>
                <p className="mb-2 text-sm text-zinc-500">Worth $50,000+</p>
                <p className="text-sm text-zinc-600">
                  Natural language instructions for tasks, audio descriptions, performance benchmarks,
                  and more. Our entire platform, yours to use.
                </p>
              </div>
            </div>

            {/* Total Value */}
            <div className="mt-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-6 text-center">
              <p className="mb-2 text-sm font-bold uppercase tracking-widest text-emerald-700">
                Everything Above, Completely Free
              </p>
              <p className="text-4xl font-bold text-emerald-900">$235,000 - $605,000</p>
              <p className="mt-2 text-sm font-medium text-emerald-700">
                All services included • No payment required • No commitments • Keep all your data
              </p>
            </div>
          </div>

          {/* Why Partner With Us */}
          <div className="mb-16">
            <div className="mb-8 text-center">
              <h2 className="mb-4 text-3xl font-bold text-zinc-900">Why we need partners</h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-600">
                Our platform works great in testing, but we need real labs using it for real projects
                to make sure it actually delivers value. That's where you come in.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Benefit Card 1 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Heart className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">You help shape it</h3>
                </div>
                <p className="text-zinc-600">
                  Tell us what works, what doesn't, and what features you actually need.
                  We'll build exactly what helps you train better robots. Early partners
                  get to influence the product direction.
                </p>
              </div>

              {/* Benefit Card 2 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <Star className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">Special pricing forever</h3>
                </div>
                <p className="text-zinc-600">
                  After the free validation period, early partners get discounted pricing for life,
                  priority support, and early access to new features. We take care of the people
                  who helped us get started.
                </p>
              </div>

              {/* Benefit Card 3 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">Zero risk</h3>
                </div>
                <p className="text-zinc-600">
                  No payment. No contract. No commitment. Use everything free, keep all the data
                  we generate, and walk away anytime if it's not helpful. You literally cannot lose.
                </p>
              </div>

              {/* Benefit Card 4 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">Prove it works</h3>
                </div>
                <p className="text-zinc-600">
                  We claim our simulated data helps train real robots. We need labs with actual
                  hardware to test this. If you have robots, we'll work with you to validate
                  that our data actually transfers to the real world.
                </p>
              </div>
            </div>
          </div>

          {/* What We're Looking For */}
          <div className="mb-16 rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-8 shadow-sm">
            <h2 className="mb-6 text-3xl font-bold text-zinc-900">Who should apply</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">Labs or companies with robots</p>
                  <p className="text-sm text-zinc-600">
                    Whether you're working on robot arms, mobile robots, or humanoids — if you have actual hardware, we want to work with you
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">Teams that need training data</p>
                  <p className="text-sm text-zinc-600">
                    Training AI models for robots? Need more diverse scenarios? Want to test if simulation helps? This is for you
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">People willing to give honest feedback</p>
                  <p className="text-sm text-zinc-600">
                    We need to know what works and what doesn't. Regular check-ins (probably 30 minutes every 2 weeks) to share your experience
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">Anyone curious to try it</p>
                  <p className="text-sm text-zinc-600">
                    Even if you don't fit the above perfectly — if you're interested in better robotics data, apply anyway. Worst case: free access to our platform
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-16">
            <h2 className="mb-8 text-center text-3xl font-bold text-zinc-900">How the partnership works</h2>
            <div className="grid gap-6 md:grid-cols-4">
              {/* Step 1 */}
              <div className="relative rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">
                  1
                </div>
                <h3 className="mb-2 font-semibold text-zinc-900">Apply & Connect</h3>
                <p className="text-sm text-zinc-600">
                  Fill out the form below and we'll schedule a call to understand your needs
                </p>
                {/* Arrow */}
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-zinc-300 md:block">
                  <ChevronRight className="h-6 w-6" />
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">
                  2
                </div>
                <h3 className="mb-2 font-semibold text-zinc-900">Scope & Setup</h3>
                <p className="text-sm text-zinc-600">
                  We'll define a pilot project tailored to your research goals (2-4 weeks)
                </p>
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-zinc-300 md:block">
                  <ChevronRight className="h-6 w-6" />
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl font-bold text-white">
                  3
                </div>
                <h3 className="mb-2 font-semibold text-zinc-900">Build Together</h3>
                <p className="text-sm text-zinc-600">
                  We'll deliver data and work alongside you to ensure quality meets expectations
                </p>
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-zinc-300 md:block">
                  <ChevronRight className="h-6 w-6" />
                </div>
              </div>

              {/* Step 4 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl font-bold text-white">
                  4
                </div>
                <h3 className="mb-2 font-semibold text-zinc-900">Validate & Scale</h3>
                <p className="text-sm text-zinc-600">
                  Test on real robots, provide feedback, and help us prove the value
                </p>
              </div>
            </div>
          </div>

          {/* Apply Form Section */}
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
            {/* Left Column - Form */}
            <div className="space-y-8">
              <div>
                <h2 className="mb-4 text-3xl font-bold text-zinc-900">Apply to partner</h2>
                <p className="text-lg text-zinc-600">
                  Ready to help us build the future of robotics data? Fill out the form and
                  our team will reach out within 24 hours.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                <ContactForm />
              </div>
            </div>

            {/* Right Column - Info Cards */}
            <div className="flex flex-col justify-start space-y-6 lg:pl-8">
              {/* Limited Spots */}
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900">Limited Partner Spots</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      We're looking for 5-10 validation partners to work closely with during Q1 2026.
                      Priority given to labs with real robot hardware and active research programs.
                    </p>
                  </div>
                </div>
              </div>

              {/* What Happens Next */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-zinc-400">
                  What Happens Next
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-sm text-zinc-700">
                      <span className="font-semibold">Day 1:</span> Our team reviews your application
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-sm text-zinc-700">
                      <span className="font-semibold">Day 2-3:</span> 30-min intro call to discuss your needs
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-sm text-zinc-700">
                      <span className="font-semibold">Week 1:</span> We draft a pilot scope document together
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="text-sm text-zinc-700">
                      <span className="font-semibold">Week 2+:</span> You get access to our full platform, free
                    </span>
                  </li>
                </ul>
              </div>

              {/* Questions Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="mb-4 font-semibold text-zinc-900">Have questions?</h3>
                <p className="mb-4 text-sm text-zinc-600">
                  Not sure if this is right for you? Reach out and let's talk.
                </p>
                <a
                  href="mailto:partners@tryblueprint.io"
                  className="inline-block font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline"
                >
                  partners@tryblueprint.io
                </a>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="mt-16 rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-8 text-center shadow-sm">
            <Rocket className="mx-auto mb-4 h-12 w-12 text-indigo-600" />
            <h2 className="mb-4 text-2xl font-bold text-zinc-900">
              Let's build the future of robotics together
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-zinc-600">
              Blueprint is backed by top investors and advisors in the robotics and AI space.
              Join our early partners and help us democratize access to high-quality robotics training data.
            </p>
            <a
              href="#apply"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: document.querySelector('form')?.offsetTop || 0, behavior: 'smooth' });
              }}
            >
              Apply Now
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
