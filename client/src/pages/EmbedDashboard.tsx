type Metric = {
  label: string;
  value: string;
};

type Section = {
  title: string;
  metrics: Metric[];
};

const sections: Section[] = [
  {
    title: "Daily Pulse",
    metrics: [
      { label: "Avg CAC", value: "$42" },
      { label: "Retention / Churn", value: "96% / 4%" },
      {
        label: "Avg Onboarding Time / Cost",
        value: "65 mins / $190",
      },
      {
        label: "Ops Throughput (venues/day)",
        value: "5",
      },
      {
        label: "Users / Sessions (total)",
        value: "1,200 / 4,300",
      },
      {
        label: "Onboarded (today / last week)",
        value: "3 / 21",
      },
      {
        label: "Planned Onboardings (today / next week)",
        value: "5 / 35",
      },
    ],
  },
  {
    title: "Unit Economics",
    metrics: [
      { label: "Gross Margin", value: "88%" },
      { label: "CAC per Venue", value: "$42" },
      { label: "CAC Payback", value: "9 mo" },
      { label: "LTV", value: "$9,500" },
      { label: "LTV : CAC", value: "30.2x" },
      { label: "Burn Multiple", value: "1.9" },
      {
        label: "Price/hr realized vs list",
        value: "$95 / $100",
      },
      {
        label: "Hours/venue/month (p50/p75/p90)",
        value: "42 / 60 / 80",
      },
      {
        label: "COGS/hr (storage/CDN/inference/obs)",
        value: "$0.01 / $0.03 / $0.01 / $0.02",
      },
      {
        label: "Contribution margin/venue",
        value: "$1,800",
      },
    ],
  },
  {
    title: "Retention & Expansion",
    metrics: [
      { label: "GRR", value: "91%" },
      { label: "NRR", value: "108%" },
      { label: "Logo Retention", value: "89%" },
      { label: "Cohort Retention (6 mo)", value: "85%" },
      { label: "Quick Ratio", value: "4.2" },
      { label: "Magic Number", value: "0.9" },
    ],
  },
  {
    title: "Onboarding & Ops",
    metrics: [
      {
        label: "Time to go-live (median/p90)",
        value: "7d / 12d",
      },
      {
        label: "Cost to onboard/venue",
        value: "$190",
      },
      {
        label: "Onboarding capacity (actual/plan)",
        value: "5 / 6 per day",
      },
      { label: "Install success rate", value: "96%" },
      {
        label: "Support minutes per venue/month",
        value: "12",
      },
      { label: "AE ramp time", value: "5.5 mo" },
    ],
  },
  {
    title: "Usage & Engagement",
    metrics: [
      {
        label: "Sessions / Users per venue (monthly)",
        value: "320 / 140",
      },
      { label: "Minutes per session", value: "12" },
      { label: "Hours/venue/month", value: "64" },
      { label: "QR funnel completion", value: "45%" },
      { label: "Wearer participation", value: "70%" },
      { label: "Staff-triggered activation", value: "55%" },
    ],
  },
  {
    title: "Pipeline & Forecasting",
    metrics: [
      {
        label: "Lead → Demo → Pilot → Paid",
        value: "30% → 60% → 50% → 40%",
      },
      {
        label: "Avg venues per closed-won",
        value: "3",
      },
      {
        label: "Bookings per pod/month",
        value: "12",
      },
      { label: "Forecast accuracy (60d)", value: "85%" },
    ],
  },
  {
    title: "Board Metrics",
    metrics: [
      { label: "Rule of 40", value: "45%" },
      { label: "MRR / ARR", value: "$75k / $900k" },
      { label: "GM%", value: "78%" },
      { label: "CAC Payback", value: "14 mo" },
      { label: "Burn Multiple", value: "1.9" },
      { label: "Magic Number", value: "0.9" },
    ],
  },
];

export default function EmbedDashboard() {
  return (
    <div className="min-h-screen bg-white p-4 md:p-8 text-slate-800">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Blueprint Metrics Dashboard
      </h1>
      {sections.map((section) => (
        <div key={section.title} className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {section.metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border bg-slate-50 p-4 shadow-sm"
              >
                <div className="text-sm text-slate-500">{m.label}</div>
                <div className="text-2xl font-semibold">{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

