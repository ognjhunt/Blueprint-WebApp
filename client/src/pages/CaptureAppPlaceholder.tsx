import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquareShare,
  QrCode,
  Shield,
  Smartphone,
  Apple,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { SEO } from "@/components/SEO";
import { withCsrfHeader } from "@/lib/csrf";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

/* Laurel wreath SVG — mirrors Kled's badge style */
function LaurelBadge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
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

/* Stylized phone mockup showing Blueprint Capture UI */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[320px]">
      {/* Phone frame */}
      <div className="rounded-[3rem] border-[6px] border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-zinc-900/30">
        {/* Notch */}
        <div className="absolute left-1/2 top-3 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-zinc-800" />
        {/* Screen */}
        <div className="overflow-hidden rounded-[2.2rem] bg-zinc-950">
          {/* Status bar */}
          <div className="flex items-center justify-between px-8 pb-1 pt-8 text-[10px] font-semibold text-white">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-3 rounded-sm border border-white/60" />
            </div>
          </div>

          {/* App header */}
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

          {/* Balance card */}
          <div className="mx-4 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Earnings
            </p>
            <p className="mt-1 text-2xl font-bold text-white">$536.50</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                12 captures approved
              </span>
              <button className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-zinc-900">
                Cash out
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-3 flex gap-2 px-4">
            {["Payouts", "Captures", "Tasks"].map((tab, i) => (
              <div
                key={tab}
                className={`rounded-xl px-3 py-2 text-[10px] font-medium ${
                  i === 1
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500"
                }`}
              >
                {tab}
              </div>
            ))}
          </div>

          {/* Capture list */}
          <div className="mt-2 space-y-2 px-4 pb-6">
            <p className="text-[10px] font-medium text-zinc-500">Recent</p>
            {[
              { name: "Whole Foods - Durham", amount: "$45.00", status: "Approved" },
              { name: "WeWork - RTP", amount: "$38.50", status: "Approved" },
              { name: "Planet Fitness - Cary", amount: "Pending", status: "In review" },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-3 py-2.5"
              >
                <div>
                  <p className="text-[11px] font-medium text-white">{item.name}</p>
                  <p className="text-[9px] text-zinc-500">{item.status}</p>
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    item.amount === "Pending" ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {item.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Reflection */}
      <div className="absolute -bottom-8 left-1/2 h-8 w-[90%] -translate-x-1/2 rounded-[50%] bg-zinc-200/30 blur-xl" />
    </div>
  );
}

export default function CaptureAppPlaceholder() {
  const [email, setEmail] = useState("");
  const [market, setMarket] = useState("");
  const [phone, setPhone] = useState("");
  const [device, setDevice] = useState("iphone");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const shouldReduce = useReducedMotion();

  const captureAppUrl = useMemo(() => getCaptureAppPlaceholderUrl(), []);
  const smsBody = useMemo(
    () =>
      `Blueprint Capture access link:\n${captureAppUrl}\n\nOpen this link on your phone for the latest capturer access flow.`,
    [captureAppUrl],
  );
  const smsHref = useMemo(
    () => `sms:?&body=${encodeURIComponent(smsBody)}`,
    [smsBody],
  );

  useEffect(() => {
    let active = true;

    async function generateQrCode() {
      try {
        const qrcode = await import("qrcode");
        const dataUrl = await qrcode.toDataURL(captureAppUrl, {
          width: 320,
          margin: 1,
          color: {
            dark: "#18181b",
            light: "#ffffff",
          },
        });

        if (active) {
          setQrCodeUrl(dataUrl);
        }
      } catch (error) {
        console.error("Failed to generate capture access QR code:", error);
      }
    }

    void generateQrCode();

    return () => {
      active = false;
    };
  }, [captureAppUrl]);

  const handleWaitlistSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    if (!market.trim()) {
      setStatus("error");
      setMessage("Tell us your home market.");
      return;
    }

    if (!isValidPhone(phone)) {
      setStatus("error");
      setMessage("Enter a valid phone number.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          email: email.trim(),
          locationType: `Blueprint Capture beta - ${market.trim()}`,
          market: market.trim(),
          role: "capturer",
          device,
          phone: phone.trim(),
        }),
      });

      const responseBody = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseBody?.error || "Failed to join the capturer access list.");
      }

      setStatus("success");
      setMessage("Request received. We'll send the right capture access instructions for your market.");
      setEmail("");
      setMarket("");
      setPhone("");
      setDevice("iphone");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(captureAppUrl);
      setCopyState("copied");
    } catch (error) {
      console.error("Failed to copy capture access link:", error);
      setCopyState("failed");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  };

  return (
    <>
      <SEO
        title="Blueprint Capture App - Your Mobile Gateway"
        description="Download the Blueprint Capture app to start earning by capturing indoor spaces. Available for iOS."
        canonical="/capture-app"
      />

      <main className="min-h-screen bg-[#fafaf8]">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pb-20 pt-16 sm:pb-28 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto_auto] lg:gap-8">
              {/* Left — headline + CTA */}
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

              {/* Center — phone mockup */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="flex justify-center"
              >
                <PhoneMockup />
              </motion.div>

              {/* Right — stat badges + QR */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col items-center gap-6 lg:items-end"
              >
                {/* QR code — top right like Kled */}
                {qrCodeUrl && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
                    <img
                      src={qrCodeUrl}
                      alt="QR code for Blueprint Capture access"
                      className="h-20 w-20"
                    />
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

        {/* ── Features row ── */}
        <section className="border-y border-zinc-200 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                {
                  icon: <Shield className="h-5 w-5 text-zinc-600" />,
                  title: "Capture and upload fast",
                  desc: "Start sessions from your phone, upload on the move, and keep every submission tied to the right device flow.",
                },
                {
                  icon: <MessageSquareShare className="h-5 w-5 text-zinc-600" />,
                  title: "Task feed and payouts",
                  desc: "Browse available work, monitor approval status, and keep payout activity in one mobile workflow.",
                },
                {
                  icon: <QrCode className="h-5 w-5 text-zinc-600" />,
                  title: "QR and link handoff",
                  desc: "Open the app listing directly, text yourself the link, or keep a scannable download path live for recruiting.",
                },
              ].map((feature) => (
                <motion.div
                  key={feature.title}
                  initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="group"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 transition group-hover:border-zinc-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Download + Access section ── */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2">
              {/* Download / link card */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  Get the app
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900">
                  Download Blueprint Capture
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  Capturers do not create web accounts. Download the app on the phone
                  that will do the work, scan the QR code from another device, or
                  request launch access for your market.
                </p>

                <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
                  <p className="text-xs font-medium text-zinc-400">Current app link</p>
                  <p className="mt-3 break-all rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-600">
                    {captureAppUrl}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copyState === "copied"
                        ? "Copied"
                        : copyState === "failed"
                          ? "Copy failed"
                          : "Copy link"}
                    </button>
                    <a
                      href={captureAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                    >
                      Download
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={smsHref}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Text to phone
                    </a>
                  </div>
                </div>

                {/* QR section */}
                <div className="mt-6 flex items-start gap-5">
                  {qrCodeUrl && (
                    <div className="shrink-0 rounded-xl border border-zinc-200 bg-white p-3">
                      <img
                        src={qrCodeUrl}
                        alt="QR code for Blueprint Capture"
                        className="h-28 w-28"
                      />
                    </div>
                  )}
                  <div className="pt-2">
                    <p className="text-sm font-medium text-zinc-700">Scan to download</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Point your phone camera at this QR code to open the app listing
                      directly. Works for recruiting and field ops too.
                    </p>
                    <div className="mt-3 flex gap-3">
                      <a
                        href="/capture"
                        className="text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition hover:decoration-zinc-900"
                      >
                        Learn about capture
                      </a>
                      <a
                        href="/login"
                        className="text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition hover:decoration-zinc-900"
                      >
                        Web portal
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Early access form */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  Early access
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
                  Request launch access
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Tell us where you are and which device you plan to use. We'll route
                  the right instructions when your market is active.
                </p>

                <form onSubmit={handleWaitlistSubmit} className="mt-6 space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="mt-1.5 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Home market</span>
                    <input
                      value={market}
                      onChange={(event) => setMarket(event.target.value)}
                      placeholder="Raleigh-Durham, NC"
                      className="mt-1.5 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Phone</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="(919) 555-0123"
                      className="mt-1.5 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Primary capture device</span>
                    <select
                      value={device}
                      onChange={(event) => setDevice(event.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    >
                      <option value="iphone">iPhone</option>
                      <option value="ipad">iPad</option>
                      <option value="smart_glasses">Smart glasses</option>
                      <option value="android">Android phone</option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending request
                      </>
                    ) : (
                      <>
                        Request launch access
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                {message ? (
                  <p
                    className={`mt-4 text-sm ${
                      status === "error" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {message}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
