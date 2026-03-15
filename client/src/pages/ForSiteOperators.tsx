import { SEO } from "@/components/SEO";
import {
  Building2,
  CheckCircle2,
  DollarSign,
  HandCoins,
  Shield,
  TrendingUp,
} from "lucide-react";

const benefits = [
  "Earn 15-25% of every world model sale from your facility",
  "Get a free qualification report of your space's robot-readiness",
  "Attract robot teams who are ready to deploy at your exact location",
  "No upfront cost -- you earn passively from your existing facility",
];

const howItWorks = [
  {
    title: "1. Register your space",
    description:
      "Tell us about your facility -- type, size, hours, and any access restrictions. Takes 5 minutes.",
  },
  {
    title: "2. Approve capture windows",
    description:
      "Choose when capturers can visit. You control the schedule, restricted zones, and privacy rules.",
  },
  {
    title: "3. Earn from world model sales",
    description:
      "When robot teams buy world models built from captures of your space, you earn a revenue share. Every sale, automatically.",
  },
  {
    title: "4. Attract robot deployments",
    description:
      "Robot teams browsing the marketplace discover your facility. When they're ready to deploy, your site is already mapped and qualified.",
  },
];

const facilityTypes = [
  "Warehouse",
  "Retail store",
  "Grocery store",
  "Office building",
  "Restaurant",
  "Gym / fitness center",
  "Hotel / hospitality",
  "University / campus",
  "Medical clinic",
  "Coworking space",
  "Library",
  "Industrial facility",
];

const whatYouControl = [
  { label: "Scheduling", detail: "Choose exact capture windows that don't disrupt operations" },
  { label: "Privacy", detail: "Define restricted zones, camera rules, and data governance" },
  { label: "Permissions", detail: "Approve or decline every capture request" },
  { label: "Revenue share", detail: "Earn automatically on every world model sold from your space" },
];

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Register your facility with Blueprint. Earn passive income from world model sales, get a free qualification report, and attract robot teams to your space."
        canonical="/for-site-operators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <Building2 className="h-3 w-3" />
              For Site Operators
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Your facility is an asset. Earn from it.
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Register your warehouse, store, office, gym, or any indoor space with Blueprint.
              Capturers walk through and map it. Robot teams buy the world models. You earn a
              revenue share on every sale -- automatically.
            </p>
          </div>

          {/* Benefits */}
          <section className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-emerald-700" />
              <h2 className="text-xl font-bold text-slate-900">What you get</h2>
            </div>
            <ul className="space-y-3">
              {benefits.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Revenue highlight */}
          <section className="mt-8 rounded-2xl bg-zinc-900 p-6 text-white sm:p-8">
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                  <DollarSign className="h-4 w-4" />
                  Revenue share
                </p>
                <p className="mt-2 text-3xl font-bold">15-25%</p>
                <p className="mt-1 text-sm text-zinc-400">of every world model sale from your facility</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                  <TrendingUp className="h-4 w-4" />
                  Potential earnings
                </p>
                <p className="mt-2 text-3xl font-bold">$100-$500</p>
                <p className="mt-1 text-sm text-zinc-400">per month for popular location types</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                  <Shield className="h-4 w-4" />
                  Upfront cost
                </p>
                <p className="mt-2 text-3xl font-bold">$0</p>
                <p className="mt-1 text-sm text-zinc-400">free to register, you only earn</p>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="mt-10">
            <h2 className="text-2xl font-bold text-slate-900">How it works</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {howItWorks.map((step) => (
                <article key={step.title} className="rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          {/* What you control */}
          <section className="mt-10 rounded-2xl border border-slate-200 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">You stay in control</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {whatYouControl.map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Facility types */}
          <section className="mt-10">
            <h2 className="text-xl font-bold text-slate-900">Any indoor facility qualifies</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {facilityTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {type}
                </span>
              ))}
              <span className="rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-500">
                + any indoor space
              </span>
            </div>
          </section>

          {/* CTAs */}
          <section className="mt-10 flex flex-wrap gap-3">
            <a
              href="/contact?interest=site-registration"
              className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Register your space
            </a>
            <a
              href="/how-it-works"
              className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              See how Blueprint works
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
