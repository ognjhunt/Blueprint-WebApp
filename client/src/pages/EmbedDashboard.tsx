import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
<<<<<<< HEAD
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
=======
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
>>>>>>> e34d672 (real onboarding cost)

type Metric = {
  label: string;
  value: string;
};

type Section = {
  title: string;
  metrics: Metric[];
};

/** Formats today's date in the given timezone and updates right after local midnight. */
function useFormattedDate(
  timeZone: string = "America/New_York",
  locale: string = "en-US",
  options: Intl.DateTimeFormatOptions = { dateStyle: "full" },
): string {
  const fmt = new Intl.DateTimeFormat(locale, { timeZone, ...options });

  const [today, setToday] = useState<string>(() => fmt.format(new Date()));

  useEffect(() => {
    // Refresh once per minute; inexpensive and guarantees we cross midnight correctly even if tab stays open.
    const id = setInterval(() => {
      setToday(fmt.format(new Date()));
    }, 60 * 1000);

    return () => clearInterval(id);
  }, [timeZone, locale, options]);

  return today;
}

const BASE_SECTIONS: Section[] = [
  {
    title: "Daily Pulse",
    metrics: [
      { label: "Avg CAC", value: "$6.72 + 10 mins of meeting time" },
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
        value: "$0.00",
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
  const today = useFormattedDate("America/New_York");
  const [onboardingCost, setOnboardingCost] = useState("$0.00");

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const q = query(
          collection(db, "bookings"),
          where("createdAt", ">=", Timestamp.fromDate(past30)),
        );
        const snap = await getDocs(q);
        let total = 0;
        let count = 0;
        snap.forEach((doc) => {
          const d = doc.data() as any;
<<<<<<< HEAD
          const design = Number(d.estimatedDesignPayout) || 0;
          const mapping = Number(d.estimatedMappingPayout) || 0;
          total += design + mapping + 25; // 15 + 10 additional costs
          count++;
=======

          // Treat missing/blank as N/A (exclude from average)
          const designRaw = d?.estimatedDesignPayout;
          const mappingRaw = d?.estimatedMappingPayout;

          const hasDesignField =
            designRaw !== undefined && designRaw !== null && designRaw !== "";
          const hasMappingField =
            mappingRaw !== undefined &&
            mappingRaw !== null &&
            mappingRaw !== "";

          if (hasDesignField && hasMappingField) {
            const design = Number(designRaw);
            const mapping = Number(mappingRaw);

            if (Number.isFinite(design) && Number.isFinite(mapping)) {
              // Only include in average when BOTH fields are present and numeric
              total += design + mapping + 25; // 15 + 10 additional costs
              count++;
            }
          }
>>>>>>> e34d672 (real onboarding cost)
        });
        if (count > 0) {
          setOnboardingCost(`$${(total / count).toFixed(2)}`);
        }
      } catch (err) {
        console.error("Error calculating onboarding cost", err);
      }
    })();
  }, []);

  const sections = useMemo(() => {
    return BASE_SECTIONS.map((section) => {
<<<<<<< HEAD
      if (section.title !== "Onboarding & Ops") return section;
      return {
        ...section,
        metrics: section.metrics.map((m) =>
          m.label === "Cost to onboard/venue" ? { ...m, value: onboardingCost } : m,
        ),
=======
      return {
        ...section,
        metrics: section.metrics.map((m) => {
          if (m.label === "Cost to onboard/venue") {
            return { ...m, value: onboardingCost };
          }
          if (m.label === "Avg Onboarding Time / Cost") {
            // Preserve the time portion (e.g., "65 mins") and swap in the live cost
            const [timePart] = (m.value ?? "").split("/");
            const time = (timePart ?? "").trim(); // "65 mins"
            return { ...m, value: `${time} / ${onboardingCost}` };
          }
          return m;
        }),
>>>>>>> e34d672 (real onboarding cost)
      };
    });
  }, [onboardingCost]);

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-30">
        <div className="absolute top-24 left-10 w-80 h-80 bg-gradient-to-r from-cyan-300 to-emerald-300 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-gradient-to-r from-blue-300 to-teal-300 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <header className="mb-8 flex flex-col items-center gap-2 md:flex-row md:items-end md:justify-between">
          <h1 className="text-center md:text-left text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Blueprint Metrics Dashboard (last 30 days)
          </h1>
          <div className="text-sm text-slate-400">{today}</div>
        </header>

        {/* Sections */}
        {sections.map((section) => (
          <section key={section.title} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-200">
                {section.title}
              </h2>
              <div className="h-px flex-1 ml-4 bg-gradient-to-r from-white/10 to-transparent" />
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {section.metrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-4 shadow-2xl transition-colors hover:bg-white/[0.08]"
                >
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    {m.label}
                  </div>
                  <div className="mt-1 text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
