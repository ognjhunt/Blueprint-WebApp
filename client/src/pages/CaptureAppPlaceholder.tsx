import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Apple,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { SEO } from "@/components/SEO";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";

/* ── Laurel wreath SVG badge ── */
function LaurelBadge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const wreath = (
    <svg
      viewBox="0 0 32 64"
      className="h-14 w-7 text-zinc-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M28 4c-6 4-10 12-12 20" />
      <path d="M26 8c-8 2-12 8-14 14" />
      <path d="M22 14c-6 2-10 8-10 14" />
      <path d="M20 20c-4 4-6 8-6 12" />
      <path d="M16 28c-2 4-2 6-2 8" />
      <path d="M28 4c-2 6-2 10 0 14" />
      <path d="M26 8c-2 4-2 8 0 10" />
      <path d="M22 14c-2 4-1 8 1 8" />
      <path d="M20 20c-1 2 0 6 0 6" />
    </svg>
  );
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {wreath}
      <div>{children}</div>
      <svg
        viewBox="0 0 32 64"
        className="h-14 w-7 -scale-x-100 text-zinc-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M28 4c-6 4-10 12-12 20" />
        <path d="M26 8c-8 2-12 8-14 14" />
        <path d="M22 14c-6 2-10 8-10 14" />
        <path d="M20 20c-4 4-6 8-6 12" />
        <path d="M16 28c-2 4-2 6-2 8" />
        <path d="M28 4c-2 6-2 10 0 14" />
        <path d="M26 8c-2 4-2 8 0 10" />
        <path d="M22 14c-2 4-1 8 1 8" />
        <path d="M20 20c-1 2 0 6 0 6" />
      </svg>
    </div>
  );
}

/* ── Reusable phone frame ── */
function PhoneFrame({
  children,
  className = "",
  tilt,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: "left" | "right";
}) {
  const tiltClass =
    tilt === "left"
      ? "-rotate-[8deg]"
      : tilt === "right"
        ? "rotate-[8deg]"
        : "";
  return (
    <div className={`relative ${tiltClass} ${className}`}>
      <div className="w-[260px] rounded-[2.8rem] border-[5px] border-zinc-800 bg-zinc-900 p-1.5 shadow-2xl shadow-zinc-900/20">
        <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-zinc-800" />
        <div className="overflow-hidden rounded-[2rem] bg-zinc-950">{children}</div>
      </div>
    </div>
  );
}

/* ── Phone screen: Capture Upload ── */
function ScreenUpload() {
  return (
    <div className="px-4 pb-5 pt-10">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-zinc-500">Blueprint Capture</span>
        <div className="h-5 w-5 rounded-full bg-zinc-800" />
      </div>
      <div className="mt-5 flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-semibold text-white">Upload Complete</p>
        <p className="mt-1 text-[10px] text-zinc-500">112.7M / 112.7k</p>
        <div className="mt-3 h-1.5 w-32 rounded-full bg-zinc-800">
          <div className="h-full w-full rounded-full bg-emerald-400" />
        </div>
        <p className="mt-1 text-[9px] text-emerald-400">100%</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
          <p className="text-[9px] text-zinc-500">Duration</p>
          <p className="text-[11px] font-medium text-white">18 min</p>
        </div>
        <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
          <p className="text-[9px] text-zinc-500">Coverage</p>
          <p className="text-[11px] font-medium text-white">94%</p>
        </div>
        <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
          <p className="text-[9px] text-zinc-500">Quality</p>
          <p className="text-[11px] font-medium text-emerald-400">High</p>
        </div>
        <div className="rounded-xl bg-zinc-800/60 px-3 py-2">
          <p className="text-[9px] text-zinc-500">LiDAR</p>
          <p className="text-[11px] font-medium text-emerald-400">Active</p>
        </div>
      </div>
    </div>
  );
}

/* ── Phone screen: Tasks ── */
function ScreenTasks() {
  return (
    <div className="px-4 pb-5 pt-10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white">Available Tasks</span>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] text-emerald-400">3 nearby</span>
      </div>
      {[
        { name: "Target - Brier Creek", pay: "$55", tags: ["Retail", "LiDAR bonus"], distance: "2.1 mi" },
        { name: "Planet Fitness - Cary", pay: "$40", tags: ["Gym", "Featured"], distance: "4.3 mi" },
        { name: "Marriott - RTP", pay: "$60", tags: ["Hotel", "Multi-floor"], distance: "6.7 mi" },
      ].map((task) => (
        <div key={task.name} className="mt-3 rounded-2xl bg-zinc-800/60 p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium text-white">{task.name}</p>
              <p className="mt-0.5 text-[9px] text-zinc-500">{task.distance}</p>
            </div>
            <span className="text-[12px] font-bold text-emerald-400">{task.pay}</span>
          </div>
          <div className="mt-2 flex gap-1">
            {task.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-700/60 px-2 py-0.5 text-[8px] font-medium text-zinc-300">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Phone screen: Dashboard ── */
function ScreenDashboard() {
  return (
    <div className="px-4 pb-5 pt-10">
      <p className="text-xs font-semibold text-white">Your Dashboard</p>
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-indigo-900/60 to-zinc-800 p-3">
        <p className="text-[9px] uppercase tracking-wider text-zinc-400">Capturer Rank</p>
        <p className="mt-1 text-lg font-bold text-white">#1,854</p>
        <p className="text-[9px] text-indigo-300">Top 15%</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-zinc-800/60 p-3">
          <p className="text-[9px] text-zinc-500">Total Captures</p>
          <p className="text-base font-bold text-white">26</p>
          <p className="text-[9px] text-zinc-500">18 photos + 8 video</p>
        </div>
        <div className="rounded-xl bg-zinc-800/60 p-3">
          <p className="text-[9px] text-zinc-500">Leaderboard</p>
          <div className="mt-1 flex -space-x-2">
            {["bg-indigo-400", "bg-emerald-400", "bg-amber-400"].map((c, i) => (
              <div key={i} className={`h-6 w-6 rounded-full ${c} border-2 border-zinc-900`} />
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-800/60 p-3">
          <p className="text-[9px] text-zinc-500">Earnings</p>
          <p className="text-base font-bold text-white">$832.57</p>
          <p className="text-[9px] text-zinc-500">8 payouts</p>
        </div>
        <div className="rounded-xl bg-zinc-800/60 p-3">
          <p className="text-[9px] text-zinc-500">Member Since</p>
          <p className="text-base font-bold text-white">Mar 2026</p>
        </div>
      </div>
    </div>
  );
}

/* ── Phone screen: Earnings / Wallet ── */
function ScreenEarnings() {
  return (
    <div className="px-4 pb-5 pt-10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">Earnings</span>
        <div className="h-5 w-5 rounded-lg bg-zinc-800" />
      </div>
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Balance</p>
        <p className="mt-1 text-2xl font-bold text-white">$536.50</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[9px] text-zinc-500">12 captures approved</span>
          <button className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-zinc-900">
            Cash out
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {["Payouts", "Cashouts", "Ledger"].map((tab, i) => (
          <span
            key={tab}
            className={`rounded-xl px-3 py-1.5 text-[10px] font-medium ${i === 2 ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Transactions</span>
          <span className="text-zinc-500">75</span>
        </div>
        {[
          { name: "Payout No. 13", amount: "+$18.50" },
          { name: "Payout No. 12", amount: "+$42.00" },
        ].map((tx) => (
          <div key={tx.name} className="mt-2 flex items-center justify-between rounded-xl bg-zinc-800/60 px-3 py-2.5">
            <p className="text-[11px] font-medium text-white">{tx.name}</p>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              {tx.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Phone screen: Multi-device ── */
function ScreenDevices() {
  return (
    <div className="px-4 pb-5 pt-10">
      <p className="text-xs font-semibold text-white">Supported Devices</p>
      <p className="mt-1 text-[9px] text-zinc-500">Connect and manage your capture hardware</p>
      {[
        { name: "iPhone 16 Pro", status: "Connected", icon: "bg-emerald-400", detail: "LiDAR + ARKit" },
        { name: "Meta Ray-Ban", status: "Available", icon: "bg-sky-400", detail: "720p + IMU" },
        { name: "iPad Pro", status: "Not connected", icon: "bg-amber-400", detail: "LiDAR + ARKit" },
        { name: "Android XR", status: "Coming 2026", icon: "bg-zinc-500", detail: "Camera + IMU" },
      ].map((d) => (
        <div key={d.name} className="mt-2.5 flex items-center gap-3 rounded-xl bg-zinc-800/60 px-3 py-2.5">
          <div className={`h-8 w-8 rounded-xl ${d.icon}/20 flex items-center justify-center`}>
            <div className={`h-4 w-4 rounded-md ${d.icon}`} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-medium text-white">{d.name}</p>
            <p className="text-[9px] text-zinc-500">{d.detail}</p>
          </div>
          <span className={`text-[9px] font-medium ${d.status === "Connected" ? "text-emerald-400" : "text-zinc-500"}`}>
            {d.status}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Hero phone (main capture list view) ── */
function HeroPhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[320px]">
      <div className="rounded-[3rem] border-[6px] border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-zinc-900/30">
        <div className="absolute left-1/2 top-3 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-zinc-800" />
        <div className="overflow-hidden rounded-[2.2rem] bg-zinc-950">
          <div className="flex items-center justify-between px-8 pb-1 pt-8 text-[10px] font-semibold text-white">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-3 rounded-sm border border-white/60" />
            </div>
          </div>
          <div className="px-5 pb-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-500/20 p-1">
                  <div className="h-full w-full rounded-sm bg-emerald-400" />
                </div>
                <span className="text-xs font-medium text-zinc-400">Captures</span>
              </div>
              <div className="h-6 w-6 rounded-full bg-zinc-800" />
            </div>
          </div>
          <div className="mx-4 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Earnings</p>
            <p className="mt-1 text-2xl font-bold text-white">$536.50</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-medium text-emerald-400">12 captures approved</span>
              <button className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-zinc-900">Cash out</button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 px-4">
            {["Payouts", "Captures", "Tasks"].map((tab, i) => (
              <div key={tab} className={`rounded-xl px-3 py-2 text-[10px] font-medium ${i === 1 ? "bg-zinc-800 text-white" : "text-zinc-500"}`}>
                {tab}
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-2 px-4 pb-6">
            <p className="text-[10px] font-medium text-zinc-500">Recent</p>
            {[
              { name: "Whole Foods - Durham", amount: "$45.00", status: "Approved" },
              { name: "WeWork - RTP", amount: "$38.50", status: "Approved" },
              { name: "Planet Fitness - Cary", amount: "Pending", status: "In review" },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-3 py-2.5">
                <div>
                  <p className="text-[11px] font-medium text-white">{item.name}</p>
                  <p className="text-[9px] text-zinc-500">{item.status}</p>
                </div>
                <span className={`text-[11px] font-semibold ${item.amount === "Pending" ? "text-amber-400" : "text-emerald-400"}`}>
                  {item.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 left-1/2 h-8 w-[90%] -translate-x-1/2 rounded-[50%] bg-zinc-200/30 blur-xl" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════════════════ */

export default function CaptureAppPlaceholder() {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const shouldReduce = useReducedMotion();

  const captureAppUrl = useMemo(() => getCaptureAppPlaceholderUrl(), []);

  useEffect(() => {
    let active = true;
    async function generateQrCode() {
      try {
        const qrcode = await import("qrcode");
        const dataUrl = await qrcode.toDataURL(captureAppUrl, {
          width: 320,
          margin: 1,
          color: { dark: "#18181b", light: "#ffffff" },
        });
        if (active) setQrCodeUrl(dataUrl);
      } catch (error) {
        console.error("Failed to generate capture access QR code:", error);
      }
    }
    void generateQrCode();
    return () => { active = false; };
  }, [captureAppUrl]);

  return (
    <>
      <SEO
        title="Blueprint Capture App - Your Mobile Gateway"
        description="Download the Blueprint Capture app to start earning by capturing indoor spaces. Available for iOS."
        canonical="/capture-app"
      />

      <main className="min-h-screen bg-[#fafaf8]">
        {/* ═══════════════ HERO ═══════════════ */}
        <section className="relative overflow-hidden pb-20 pt-16 sm:pb-28 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto_auto] lg:gap-8">
              {/* Left — headline */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-lg"
              >
                <p className="text-sm font-medium tracking-wide text-zinc-400">
                  Blueprint Mobile App
                </p>
                <div className="mt-3 h-px w-12 bg-zinc-300" />
                <h1 className="mt-6 text-4xl font-semibold leading-[1.15] tracking-tight text-zinc-900 sm:text-5xl">
                  Your Mobile Gateway to Blueprint's Capture Network
                </h1>
                <p className="mt-5 text-base leading-7 text-zinc-500">
                  Everything you need to capture indoor spaces, complete tasks, and
                  monitor earnings, right from your phone. Available for iOS.
                </p>
                <a
                  href={captureAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex items-center gap-2.5 text-sm font-medium text-zinc-900 transition hover:text-zinc-600"
                >
                  <Apple className="h-4 w-4" />
                  View App Store
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </a>
              </motion.div>

              {/* Center — phone */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="flex justify-center"
              >
                <HeroPhoneMockup />
              </motion.div>

              {/* Right — badges + QR */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col items-center gap-6 lg:items-end"
              >
                {qrCodeUrl && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
                    <img src={qrCodeUrl} alt="QR code for Blueprint Capture access" className="h-20 w-20" />
                  </div>
                )}
                <LaurelBadge>
                  <p className="text-base font-bold text-zinc-700">Capture & Earn</p>
                  <p className="text-xs text-zinc-400">$20 - $60 Per Session</p>
                </LaurelBadge>
                <div className="flex gap-6">
                  <LaurelBadge>
                    <p className="text-base font-bold text-zinc-700">15-30 Min</p>
                    <p className="text-xs text-zinc-400">Average Session</p>
                  </LaurelBadge>
                  <LaurelBadge>
                    <p className="text-base font-bold text-zinc-700">4 Devices</p>
                    <p className="mt-0.5 flex items-center gap-0.5">
                      {[1, 2, 3, 4].map((i) => (
                        <svg key={i} viewBox="0 0 20 20" className="h-3 w-3 fill-amber-400">
                          <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.69l5.34-.78L10 1z" />
                        </svg>
                      ))}
                      <svg viewBox="0 0 20 20" className="h-3 w-3 fill-amber-400/40">
                        <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.69l5.34-.78L10 1z" />
                      </svg>
                    </p>
                  </LaurelBadge>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ FEATURE 1 — Full-width: Capture & Upload ═══════════════ */}
        <section className="py-4 sm:py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden rounded-3xl bg-zinc-100 p-8 sm:p-12 lg:min-h-[480px]"
            >
              <div className="relative z-10 max-w-md">
                <div className="h-px w-10 bg-zinc-400" />
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                  Capture and Upload in Seconds
                </h2>
                <p className="mt-4 text-sm leading-6 text-zinc-500">
                  Walk through any indoor space with your phone. Track upload progress,
                  check quality scores, and submit captures with the simplest
                  workflow possible.
                </p>
              </div>
              {/* Phone — positioned to the right, tilted */}
              <div className="mt-8 flex justify-center lg:absolute lg:bottom-[-40px] lg:right-12 lg:mt-0">
                <PhoneFrame tilt="right">
                  <ScreenUpload />
                </PhoneFrame>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ FEATURE 2+3 — Two-column ═══════════════ */}
        <section className="py-4 sm:py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Browse Capture Tasks */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center rounded-3xl bg-zinc-100 p-8 text-center sm:p-10"
              >
                <div className="h-px w-10 bg-zinc-400" />
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900">
                  Browse High-Value Capture Tasks
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  Access curated capture tasks near you. See payout rates upfront,
                  get guidance, and track your progress in real time.
                </p>
                <div className="mt-8">
                  <PhoneFrame>
                    <ScreenTasks />
                  </PhoneFrame>
                </div>
              </motion.div>

              {/* Multi-Device Support */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="flex flex-col items-center rounded-3xl bg-zinc-100 p-8 text-center sm:p-10"
              >
                <div className="h-px w-10 bg-zinc-400" />
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900">
                  Multi-Device Capture Support
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  Connect your iPhone, iPad, or smart glasses. Better devices earn higher
                  payouts. A clean device hub shows status and capabilities.
                </p>
                <div className="mt-8">
                  <PhoneFrame>
                    <ScreenDevices />
                  </PhoneFrame>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ FEATURE 4+5 — Two-column ═══════════════ */}
        <section className="py-4 sm:py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Dashboard */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center rounded-3xl bg-zinc-100 p-8 text-center sm:p-10"
              >
                <div className="h-px w-10 bg-zinc-400" />
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900">
                  Your Personal Dashboard
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  View personal metrics, capture history, and quality trends.
                  See how you rank on the leaderboard and keep improving with a
                  transparent performance dashboard.
                </p>
                <div className="mt-8">
                  <PhoneFrame>
                    <ScreenDashboard />
                  </PhoneFrame>
                </div>
              </motion.div>

              {/* Earnings */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="flex flex-col items-center rounded-3xl bg-zinc-100 p-8 text-center sm:p-10"
              >
                <div className="h-px w-10 bg-zinc-400" />
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900">
                  Track Earnings and Cash Out Anytime
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  Monitor your balance, view detailed payout history, and withdraw
                  securely through PayPal or bank transfer — all inside one clean
                  wallet interface.
                </p>
                <div className="mt-8">
                  <PhoneFrame>
                    <ScreenEarnings />
                  </PhoneFrame>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════ */}
        <section className="border-t border-zinc-200 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                Start Earning With Your Captures Today.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-500">
                Currently on iOS. Android and smart glasses support coming soon.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href={captureAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  <Apple className="h-4 w-4" />
                  Download for iOS
                </a>
                <a
                  href="/capture"
                  className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
                >
                  Learn about capture
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </>
  );
}
