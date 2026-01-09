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
              Early Access Partner Program
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
              Build the future of robotics data with us
            </h1>
            <p className="mx-auto max-w-3xl text-xl leading-relaxed text-zinc-600">
              We're an early-stage startup with a vision: making high-quality robotics simulation
              and synthetic data accessible to every lab. Partner with us during our validation phase
              and get <span className="font-semibold text-emerald-600">free access</span> to our entire platform.
            </p>
          </div>

          {/* What We're Building */}
          <div className="mb-16 rounded-3xl border border-zinc-200 bg-gradient-to-br from-indigo-50/50 to-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <FlaskConical className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-900">What we're building</h2>
            </div>
            <p className="mb-8 text-lg text-zinc-600">
              We've built a comprehensive robotics data pipeline powered by NVIDIA's Genie Sim 3.0 and Isaac Lab Arena.
              Our infrastructure is ready, but we need <span className="font-semibold">real-world validation</span> from
              labs like yours to ensure we deliver the quality we promise.
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Service Card 1 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Sim2Real Validation Service
                </h3>
                <p className="mb-2 text-sm text-zinc-500">$5,000-$25,000/study value</p>
                <p className="text-sm text-zinc-600">
                  Comprehensive validation trials with real robots, transfer gap analysis,
                  and quality guarantee certificates (50%/70%/85% success rates).
                </p>
              </div>

              {/* Service Card 2 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Premium Analytics Suite
                </h3>
                <p className="mb-2 text-sm text-zinc-500">$115,000-$260,000 value</p>
                <p className="text-sm text-zinc-600">
                  Per-step telemetry, failure analysis, grasp analytics, trajectory optimality,
                  and parallel evaluation metrics — all captured by default.
                </p>
              </div>

              {/* Service Card 3 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Generalization Analysis
                </h3>
                <p className="mb-2 text-sm text-zinc-500">$15,000-$35,000 value</p>
                <p className="text-sm text-zinc-600">
                  Dataset coverage analysis, learning curve prediction, curriculum
                  recommendations, and data efficiency metrics.
                </p>
              </div>

              {/* Service Card 4 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Embodiment Transfer Analysis
                </h3>
                <p className="mb-2 text-sm text-zinc-500">$20,000-$100,000 value</p>
                <p className="text-sm text-zinc-600">
                  Cross-robot compatibility matrices, multi-robot training strategies,
                  and 3-5x data multiplier calculations.
                </p>
              </div>

              {/* Service Card 5 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Sim2Real Fidelity Matrix
                </h3>
                <p className="mb-2 text-sm text-zinc-500">$20,000-$50,000 value</p>
                <p className="text-sm text-zinc-600">
                  Physics/visual/sensor fidelity scoring, transfer confidence metrics,
                  and deployment readiness trust matrices.
                </p>
              </div>

              {/* Service Card 6 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  Additional Capabilities
                </h3>
                <p className="mb-2 text-sm text-zinc-500">$50,000+ total value</p>
                <p className="text-sm text-zinc-600">
                  Policy leaderboards, tactile sensor simulation, language annotations,
                  audio narration, and more — all included free during validation.
                </p>
              </div>
            </div>

            {/* Total Value */}
            <div className="mt-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-6 text-center">
              <p className="mb-2 text-sm font-bold uppercase tracking-widest text-emerald-700">
                Total Partner Value
              </p>
              <p className="text-4xl font-bold text-emerald-900">$235,000 - $605,000</p>
              <p className="mt-2 text-sm font-medium text-emerald-700">
                FREE during validation phase • No commitments • Keep all data generated
              </p>
            </div>
          </div>

          {/* Why Partner With Us */}
          <div className="mb-16">
            <div className="mb-8 text-center">
              <h2 className="mb-4 text-3xl font-bold text-zinc-900">Why partner with Blueprint?</h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-600">
                We're not just looking for users — we're looking for partners who'll help us
                build something transformative for the robotics community.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Benefit Card 1 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Heart className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">Co-create the future</h3>
                </div>
                <p className="text-zinc-600">
                  Your feedback directly shapes our roadmap. We'll work closely alongside your team
                  to ensure our outputs meet your exact needs. You're not just a customer —
                  you're a founding partner.
                </p>
              </div>

              {/* Benefit Card 2 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <Star className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">Premium benefits forever</h3>
                </div>
                <p className="text-zinc-600">
                  As a validation partner, you'll receive lifetime preferential pricing, priority
                  support, and early access to new features — even after we exit the validation phase.
                </p>
              </div>

              {/* Benefit Card 3 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">No risk, all reward</h3>
                </div>
                <p className="text-zinc-600">
                  Zero financial commitment. Keep all data we generate for you. If our services don't
                  meet your needs, walk away — no strings attached. We only succeed if you succeed.
                </p>
              </div>

              {/* Benefit Card 4 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900">Real-world validation</h3>
                </div>
                <p className="text-zinc-600">
                  We're specifically looking for labs that can help us validate our sim2real transfer claims.
                  If you have real robots, we'll work with you to prove our simulation data works
                  in the real world.
                </p>
              </div>
            </div>
          </div>

          {/* What We're Looking For */}
          <div className="mb-16 rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-8 shadow-sm">
            <h2 className="mb-6 text-3xl font-bold text-zinc-900">What we're looking for</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">Research labs or companies with real robots</p>
                  <p className="text-sm text-zinc-600">
                    Especially those working on manipulation, mobile manipulation, or humanoid tasks
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">Teams willing to provide feedback</p>
                  <p className="text-sm text-zinc-600">
                    Help us understand what's working and what needs improvement through regular check-ins
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">Organizations that need high-quality training data</p>
                  <p className="text-sm text-zinc-600">
                    VLA training, policy learning, simulation benchmarking, or dataset augmentation
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-zinc-900">Partners interested in long-term collaboration</p>
                  <p className="text-sm text-zinc-600">
                    We're building relationships, not just collecting testimonials
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
