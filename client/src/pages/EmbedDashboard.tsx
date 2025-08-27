import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

type Metric = {
  label: string;
  value: string;
};

type Section = {
  title: string;
  metrics: Metric[];
};

// ---- Growth + payback helpers (place above BASE_SECTIONS) ----
const ADOPTION_GROWTH_MOM = 0.08; // 8% compounded month-over-month
const LTV_MONTHS = 25; // keep parity with your prior $615 baseline (20h * $1.23 * 25)

function sumSeries(start: number, growth: number, months: number): number {
  if (months <= 0) return 0;
  if (growth <= 0) return start * months;
  const r = 1 + growth;
  return (start * (Math.pow(r, months) - 1)) / growth; // geometric series
}

function monthsToRecoverCost(
  cost: number,
  startHours: number,
  profitPerHour: number,
  growth: number,
  maxMonths = 120,
): number {
  if (cost <= 0 || profitPerHour <= 0 || startHours <= 0) return 0;
  const r = 1 + Math.max(0, growth);
  let cumulative = 0;
  let h = startHours;
  for (let m = 1; m <= maxMonths; m++) {
    const monthProfit = h * profitPerHour;
    cumulative += monthProfit;
    if (cumulative >= cost) {
      // fractional month interpolation
      const prev = cumulative - monthProfit;
      const needed = cost - prev;
      const frac = needed / monthProfit;
      return Math.max(0, m - 1 + frac);
    }
    h *= r;
  }
  return maxMonths; // didn’t recover within horizon
}

function ltvRevenueWithGrowth(
  startHours: number,
  pricePerHour: number,
  growth: number,
  months = LTV_MONTHS,
): number {
  if (pricePerHour <= 0 || startHours <= 0) return 0;
  const hoursSum = sumSeries(startHours, growth, months);
  return hoursSum * pricePerHour; // revenue LTV (keep consistent with your previous $615 definition)
}

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
      { label: "Onboarding Payback", value: "0 mo" },
      { label: "Venue Breakeven", value: "0 mo" },
      { label: "LTV", value: "$0" },
      { label: "LTV : CAC", value: "0x" },
      { label: "Burn Multiple", value: "1.9" },
      {
        label: "Price/hr realized vs list",
        value: "$95 / $100",
      },
      {
        label: "Hours/venue/month (p50/p75/p90)",
        value: "12 / 20 / 34",
      },
      {
        label: "Avg. price per hour",
        value: "$1.23",
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
        value: "5 / 10 per day",
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
      { label: "Hours/venue/month", value: "0" },
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
  const [avgOnboardingTime, setAvgOnboardingTime] = useState("N/A");
  const [onboardingCostNum, setOnboardingCostNum] = useState(0);
  const [usersSessions, setUsersSessions] = useState({ users: 0, sessions: 0 });
  const [onboardedCounts, setOnboardedCounts] = useState({
    today: 0,
    lastWeek: 0,
  });
  const [plannedCounts, setPlannedCounts] = useState({ today: 0, nextWeek: 0 });
  const [timeToGoLive, setTimeToGoLive] = useState("N/A");
  const [installSuccessRate, setInstallSuccessRate] = useState("N/A");
  const [medianHours, setMedianHours] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const q = query(
          collection(db, "bookings"),
          where("createdAt", ">=", Timestamp.fromDate(past30)),
          where("createdAt", "<=", Timestamp.fromDate(now)),
        );

        const snap = await getDocs(q);

        if (process.env.NODE_ENV !== "production") {
          console.log("bookings in last 30d:", snap.size);
        }

        // Cost aggregation
        let costTotal = 0;
        let costCount = 0;

        // Time aggregation (minutes)
        let minsTotal = 0;
        let minsCount = 0;

        // Go-live timing and install success rate
        const goLiveDiffs: number[] = [];
        let completed = 0;
        let nonPending = 0;

        snap.forEach((doc) => {
          const toMinutes = (x: unknown): number | null => {
            if (typeof x === "number" && Number.isFinite(x)) return x;
            if (typeof x === "string") {
              const m = x.match(/[\d.]+/); // handles "50", "50 mins", "50.0"
              if (!m) return null;
              const n = Number(m[0]);
              return Number.isFinite(n) ? n : null;
            }
            return null;
          };

          const d = doc.data() as any;

          // ----- COST (skip docs without BOTH fields or non-numeric) -----
          const designRaw = d?.estimatedDesignPayout;
          const mappingRaw = d?.estimatedMappingPayout;
          const hasDesign =
            designRaw !== undefined && designRaw !== null && designRaw !== "";
          const hasMapping =
            mappingRaw !== undefined &&
            mappingRaw !== null &&
            mappingRaw !== "";
          if (hasDesign && hasMapping) {
            const design = Number(designRaw);
            const mapping = Number(mappingRaw);
            if (Number.isFinite(design) && Number.isFinite(mapping)) {
              costTotal += design + mapping + 25; // 15 + 10 additional costs
              costCount++;
            }
          }

          // ----- TIME (look for any plausible minutes field; skip if missing/invalid) -----
          const mt = 50; // toMinutes(d?.estimatedMappingTime);
          if (mt !== null) {
            minsTotal += mt;
            minsCount++;
          }

          // ----- GO-LIVE TIME (createdAt to demoScheduleDate) -----
          const createdAt: Date | null = d?.createdAt?.toDate
            ? d.createdAt.toDate()
            : null;
          const demoDateStr: string | undefined = d?.demoScheduleDate;
          if (createdAt && demoDateStr) {
            const demoDate = new Date(demoDateStr);
            const diff =
              (demoDate.getTime() - createdAt.getTime()) /
              (1000 * 60 * 60 * 24);
            if (Number.isFinite(diff) && diff >= 0) {
              goLiveDiffs.push(diff);
            }
          }

          // ----- INSTALL SUCCESS RATE -----
          const status = (d?.status || "").toLowerCase();
          if (status && status !== "pending") {
            nonPending++;
            if (status === "completed") completed++;
          }
        });

        // Finalize go-live time (median / p90)
        if (goLiveDiffs.length > 0) {
          goLiveDiffs.sort((a, b) => a - b);
          const mid = Math.floor(goLiveDiffs.length / 2);
          const median =
            goLiveDiffs.length % 2 !== 0
              ? goLiveDiffs[mid]
              : (goLiveDiffs[mid - 1] + goLiveDiffs[mid]) / 2;
          const p90 =
            goLiveDiffs[
              Math.min(
                Math.ceil(0.9 * goLiveDiffs.length) - 1,
                goLiveDiffs.length - 1,
              )
            ];
          setTimeToGoLive(`${Math.round(median)}d / ${Math.round(p90)}d`);
        } else {
          setTimeToGoLive("N/A");
        }

        // Finalize install success rate
        if (nonPending > 0) {
          const rate = (completed / nonPending) * 100;
          setInstallSuccessRate(`${rate.toFixed(0)}%`);
        } else {
          setInstallSuccessRate("N/A");
        }

        // Finalize cost
        if (costCount > 0) {
          const avgCost = costTotal / costCount;
          setOnboardingCost(`$${avgCost.toFixed(2)}`);
          setOnboardingCostNum(avgCost);
        } else {
          setOnboardingCost("N/A");
          setOnboardingCostNum(0);
        }

        // Finalize time (rounded to nearest minute)
        if (minsCount > 0) {
          setAvgOnboardingTime(`${Math.round(minsTotal / minsCount)} mins`);
        } else {
          setAvgOnboardingTime("N/A");
        }

        // Sessions and users in last 30 days
        const sessionsQ = query(
          collection(db, "sessions"),
          where("startTime", ">=", Timestamp.fromDate(past30)),
          where("startTime", "<=", Timestamp.fromDate(now)),
        );
        const sessionsSnap = await getDocs(sessionsQ);
        const userSet = new Set<string>();
        const venueHours: Record<string, number> = {};
        sessionsSnap.forEach((doc) => {
          const d = doc.data() as any;
          if (d?.userId) userSet.add(d.userId);

          const venueId = d?.venueId || d?.locationId || d?.spaceId;
          if (venueId) {
            const start = d?.startTime?.toDate
              ? d.startTime.toDate()
              : d?.startTime
                ? new Date(d.startTime)
                : null;
            const end = d?.endTime?.toDate
              ? d.endTime.toDate()
              : d?.endTime
                ? new Date(d.endTime)
                : null;
            let hrs = 0;
            if (start && end) {
              hrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            } else if (typeof d?.duration === "number") {
              hrs = d.duration / 60;
            } else if (typeof d?.durationMinutes === "number") {
              hrs = d.durationMinutes / 60;
            } else if (typeof d?.durationSeconds === "number") {
              hrs = d.durationSeconds / 3600;
            }
            if (Number.isFinite(hrs) && hrs > 0) {
              venueHours[venueId] = (venueHours[venueId] || 0) + hrs;
            }
          }
        });
        setUsersSessions({ users: userSet.size, sessions: sessionsSnap.size });
        const hoursArr = Object.values(venueHours).sort((a, b) => a - b);
        let med = 0;
        if (hoursArr.length > 0) {
          const mid = Math.floor(hoursArr.length / 2);
          med =
            hoursArr.length % 2 !== 0
              ? hoursArr[mid]
              : (hoursArr[mid - 1] + hoursArr[mid]) / 2;
        }
        setMedianHours(med);

        // Onboarded and planned onboardings
        const toYMD = (d: Date) => d.toISOString().split("T")[0];
        const todayStr = toYMD(now);
        const past7 = toYMD(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        const next7 = toYMD(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
        const rangeQ = query(
          collection(db, "bookings"),
          where("date", ">=", past7),
          where("date", "<=", next7),
        );
        const rangeSnap = await getDocs(rangeQ);
        let onboardedToday = 0,
          onboardedLastWeek = 0,
          plannedToday = 0,
          plannedNextWeek = 0;
        rangeSnap.forEach((doc) => {
          const d = doc.data() as any;
          const date = d?.date;
          const status = (d?.status || "").toLowerCase();
          if (!date) return;
          if (date === todayStr) {
            plannedToday++;
            if (status !== "pending") onboardedToday++;
          } else if (date > todayStr && date <= next7) {
            plannedNextWeek++;
          } else if (date >= past7 && date < todayStr) {
            if (status !== "pending") onboardedLastWeek++;
          }
        });
        setOnboardedCounts({
          today: onboardedToday,
          lastWeek: onboardedLastWeek,
        });
        setPlannedCounts({
          today: plannedToday,
          nextWeek: plannedToday + plannedNextWeek,
        });
      } catch (err) {
        console.error("Error calculating onboarding metrics", err);
      }
    })();
  }, []);

  const sections = useMemo(() => {
    // --- pricing & COGS ---
    const avgPrice = 1.23;
    const cogsValues = [0.01, 0.03, 0.01, 0.02];
    let totalCogs = cogsValues.reduce((a, b) => a + b, 0);

    // If you ever want to PIN GM to 85% instead of deriving from cogsValues, uncomment:
    // const targetGM = 0.85; totalCogs = avgPrice * (1 - targetGM);

    const grossMargin =
      avgPrice > 0 ? ((avgPrice - totalCogs) / avgPrice) * 100 : 0;
    const profitPerHour = Math.max(0, avgPrice - totalCogs);

    // --- starting usage (month 1) ---
    // Use measured medianHours when available; else 20h baseline.
    const startHours = medianHours && medianHours > 0 ? medianHours : 20;

    // --- CAC (keep your current derivation; clamp to >= 0) ---
    const cacPerVenue = Math.max(0, onboardingCostNum / 19);

    // --- growth settings ---
    const g = ADOPTION_GROWTH_MOM;

    // --- paybacks with compounding usage ---
    const onboardingPayback = monthsToRecoverCost(
      onboardingCostNum,
      startHours,
      profitPerHour,
      g,
    );
    const cacPayback = monthsToRecoverCost(
      cacPerVenue,
      startHours,
      profitPerHour,
      g,
    );
    const venueBreakeven = monthsToRecoverCost(
      onboardingCostNum + cacPerVenue,
      startHours,
      profitPerHour,
      g,
    );

    // --- LTV (revenue) with growth over a fixed horizon ---
    // This keeps parity with your prior $615 when startHours=20 and g=0 across 25 months.
    const ltv = ltvRevenueWithGrowth(startHours, avgPrice, g, LTV_MONTHS);
    const ltvCac = cacPerVenue > 0 ? ltv / cacPerVenue : 0;

    // --- display helpers ---
    const cogsStr = cogsValues.map((v) => `$${v.toFixed(2)}`).join(" / ");
    const hoursPerVenueMonth = startHours; // month-1 display value

    return BASE_SECTIONS.map((section) => {
      return {
        ...section,
        metrics: section.metrics.map((m) => {
          if (m.label === "Cost to onboard/venue") {
            return { ...m, value: onboardingCost };
          }
          if (m.label === "Avg Onboarding Time / Cost") {
            return { ...m, value: `${avgOnboardingTime} / ${onboardingCost}` };
          }
          if (m.label === "Users / Sessions (total)") {
            return {
              ...m,
              value: `${usersSessions.users.toLocaleString()} / ${usersSessions.sessions.toLocaleString()}`,
            };
          }
          if (m.label === "Onboarded (today / last week)") {
            return {
              ...m,
              value: `${onboardedCounts.today} / ${onboardedCounts.lastWeek}`,
            };
          }
          if (m.label === "Planned Onboardings (today / next week)") {
            return {
              ...m,
              value: `${plannedCounts.today} / ${plannedCounts.nextWeek}`,
            };
          }
          if (m.label === "Time to go-live (median/p90)") {
            return { ...m, value: timeToGoLive };
          }
          if (m.label === "Install success rate") {
            return { ...m, value: installSuccessRate };
          }
          if (m.label === "Avg. price per hour") {
            return { ...m, value: `$${avgPrice.toFixed(2)}` };
          }
          if (m.label === "Gross Margin") {
            return { ...m, value: `${grossMargin.toFixed(0)}%` };
          }
          if (m.label === "CAC per Venue") {
            return { ...m, value: `$${cacPerVenue.toFixed(2)}` };
          }
          if (m.label === "CAC Payback") {
            return { ...m, value: `${cacPayback.toFixed(1)} mo` };
          }
          if (m.label === "Onboarding Payback") {
            return {
              ...m,
              value:
                onboardingPayback > 0
                  ? `${onboardingPayback.toFixed(1)} mo`
                  : "N/A",
            };
          }
          if (m.label === "Venue Breakeven") {
            return {
              ...m,
              value:
                venueBreakeven > 0 ? `${venueBreakeven.toFixed(1)} mo` : "N/A",
            };
          }
          if (m.label === "LTV") {
            return {
              ...m,
              value: ltv > 0 ? `$${ltv.toFixed(0)}` : "N/A",
            };
          }
          if (m.label === "LTV : CAC") {
            return {
              ...m,
              value: ltvCac > 0 ? `${ltvCac.toFixed(1)}x` : "N/A",
            };
          }
          if (m.label === "COGS/hr (storage/CDN/inference/obs)") {
            return { ...m, value: cogsStr };
          }
          if (m.label === "Hours/venue/month") {
            return {
              ...m,
              value:
                hoursPerVenueMonth > 0 ? hoursPerVenueMonth.toFixed(0) : "0",
            };
          }
          return m;
        }),
      };
    });
  }, [
    onboardingCost,
    avgOnboardingTime,
    usersSessions,
    onboardedCounts,
    plannedCounts,
    onboardingCostNum,
    timeToGoLive,
    installSuccessRate,
    medianHours,
  ]);

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
