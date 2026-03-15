import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  DollarSign,
  Glasses,
  MapPin,
  Share2,
  Smartphone,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const earningTiers = [
  {
    device: "iPhone / iPad",
    rate: "$35 - $60",
    unit: "per capture",
    multiplier: "4x",
    detail: "ARKit camera poses plus LiDAR depth on supported models. Highest payout tier.",
  },
  {
    device: "Meta Ray-Ban",
    rate: "$20 - $30",
    unit: "per capture",
    multiplier: "1x",
    detail: "720p video + IMU data via DAT SDK",
  },
  {
    device: "Android XR Glasses",
    rate: "$25 - $35",
    unit: "per capture",
    multiplier: "2x",
    detail: "Camera, IMU, touchpad, location. Coming 2026.",
  },
  {
    device: "Apple Glasses",
    rate: "$30 - $45",
    unit: "per capture",
    multiplier: "3x",
    detail: "Expected to support richer capture than current smart glasses. Coming 2027.",
  },
];

const locationTypes = [
  "Grocery stores",
  "Warehouses",
  "Offices",
  "Retail stores",
  "Restaurants",
  "Gyms & fitness",
  "Hotels & lobbies",
  "Universities",
  "Medical clinics",
  "Coworking spaces",
  "Libraries",
  "Apartment buildings",
];

const howCaptureWorks = [
  {
    step: "1",
    title: "Pick a location",
    description:
      "Open the Blueprint app, browse available capture tasks near you, or walk into any indoor space and start a new capture.",
    icon: <MapPin className="h-6 w-6" />,
  },
  {
    step: "2",
    title: "Walk through the space",
    description:
      "Just walk naturally. Your device captures video, depth, and sensor data automatically. A typical session is 15-30 minutes.",
    icon: <Camera className="h-6 w-6" />,
  },
  {
    step: "3",
    title: "Upload & get paid",
    description:
      "Upload your capture. Our quality pipeline scores it automatically. Most approved captures land around $40, with higher payouts for stronger device data and better coverage. Cash out at $25 via PayPal or bank transfer.",
    icon: <DollarSign className="h-6 w-6" />,
  },
];

const qualityBonuses = [
  { label: "Complete coverage", bonus: "+25%", description: "Capture all zones in the space" },
  { label: "Multi-pass", bonus: "+50%", description: "Multiple angles of the same area" },
  { label: "LiDAR depth", bonus: "+100%", description: "Use a LiDAR-equipped iPhone or iPad" },
  { label: "Steady walkthrough", bonus: "+20%", description: "Stable pacing with fewer rescans and dropouts" },
];

const referralBenefits = [
  "Earn 10% of your referrals' capture earnings for life",
  "No cap on referral earnings",
  "Referrals also get a bonus on their first capture",
  "Share your unique link via text, social, or email",
];

export default function Capture() {
  return (
    <>
      <SEO
        title="Earn Money Capturing Indoor Spaces | Blueprint"
        description="Get paid to walk through indoor spaces with your phone or smart glasses. Capture grocery stores, offices, warehouses, and more. No robotics knowledge needed."
        canonical="/capture"
      />

      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-zinc-200 bg-white pb-16 pt-20 text-zinc-950 sm:pb-24 sm:pt-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-700">
                  <DollarSign className="h-3 w-3" />
                  Earn With Blueprint
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                  Get paid to walk through buildings.
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                  Use your phone or smart glasses to capture indoor spaces. Grocery stores,
                  offices, warehouses, gyms -- any indoor location. No robotics knowledge
                  needed. Just walk, capture, earn.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/signup?role=capturer"
                    className="inline-flex items-center justify-center rounded-lg bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Start capturing
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                  >
                    See how it works
                  </a>
                </div>
              </div>

              {/* Stats card */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Platform Stats
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-2xl font-bold text-zinc-950">$20-$60</p>
                    <p className="text-xs text-zinc-500">Per capture session</p>
                    <p className="mt-1 text-xs text-zinc-500">Most approved captures land around $40</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-2xl font-bold text-zinc-950">15-30</p>
                    <p className="text-xs text-zinc-500">Minutes per session</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-2xl font-bold text-zinc-950">10%</p>
                    <p className="text-xs text-zinc-500">Lifetime referral share</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-2xl font-bold text-zinc-950">$25</p>
                    <p className="text-xs text-zinc-500">Minimum cashout</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
              Three steps to your first payout
            </h2>
            <p className="mt-2 text-zinc-600">
              No training required. No special access. Just your device and an indoor space.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {howCaptureWorks.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                    {item.step}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                    {item.icon}
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-bold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Earning tiers */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                Better devices earn more
              </h2>
              <p className="mt-2 text-zinc-600">
                LiDAR-equipped iPhone and iPad captures earn the highest rates. We pay more for
                stronger geometry, cleaner coverage, and higher-confidence capture data.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {earningTiers.map((tier) => (
                <div
                  key={tier.device}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    {tier.device.includes("iPhone") ? (
                      <Smartphone className="h-5 w-5 text-zinc-700" />
                    ) : (
                      <Glasses className="h-5 w-5 text-zinc-700" />
                    )}
                    <h3 className="font-semibold text-zinc-900">{tier.device}</h3>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900">{tier.rate}</p>
                  <p className="text-xs text-zinc-500">{tier.unit}</p>
                  <div className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {tier.multiplier} multiplier
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">{tier.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quality bonuses */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-900">Quality bonuses</h2>
            <p className="mt-2 text-zinc-600">
              Higher quality captures earn bonus payouts on top of your base rate.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {qualityBonuses.map((bonus) => (
              <div key={bonus.label} className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-zinc-900">{bonus.label}</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    {bonus.bonus}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-500">{bonus.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Location types */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900">Any indoor space counts</h2>
              <p className="mt-2 text-zinc-600">
                Robot teams need world models of every kind of indoor environment. The more
                diverse the locations you capture, the more valuable the marketplace becomes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {locationTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
                >
                  {type}
                </span>
              ))}
              <span className="rounded-full border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-500">
                + any indoor location
              </span>
            </div>
          </div>
        </section>

        {/* Referral program */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                <Share2 className="h-3 w-3" />
                Referral Program
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                Invite friends. Earn 10% of their captures. Forever.
              </h2>
              <p className="mt-4 text-zinc-600">
                Share your referral link. When your friends capture spaces, you earn 10% of
                their earnings for as long as they use Blueprint. No cap, no expiry.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <ul className="space-y-3">
                {referralBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-sm text-zinc-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Gamification preview */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900">Level up as you capture</h2>
              <p className="mt-2 text-zinc-600">
                Build your reputation, unlock higher-paying tasks, and climb the leaderboard.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { level: "Novice", icon: <Zap className="h-5 w-5" />, requirement: "First capture" },
                { level: "Verified", icon: <CheckCircle2 className="h-5 w-5" />, requirement: "10 captures, 80%+ quality" },
                { level: "Expert", icon: <Star className="h-5 w-5" />, requirement: "50 captures, 90%+ quality" },
                { level: "Master", icon: <Trophy className="h-5 w-5" />, requirement: "200+ captures, top 10% quality" },
              ].map((tier) => (
                <div
                  key={tier.level}
                  className="rounded-xl border border-zinc-200 bg-white p-5 text-center"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                    {tier.icon}
                  </div>
                  <p className="mt-3 font-bold text-zinc-900">{tier.level}</p>
                  <p className="mt-1 text-xs text-zinc-500">{tier.requirement}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-indigo-950 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Your daily routine is worth money.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-indigo-200">
              Every indoor space you walk through could become a world model that helps robots
              deploy. Sign up, start capturing, and get paid.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/signup?role=capturer"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Create your account
              </a>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-indigo-700 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-900"
              >
                Learn more about Blueprint
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
