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
} from "lucide-react";

import { SEO } from "@/components/SEO";
import { withCsrfHeader } from "@/lib/csrf";
import { getCaptureAppPlaceholderUrl } from "@/lib/client-env";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
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
            dark: "#111827",
            light: "#f8fafc",
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
      setMessage("Request received. We’ll send the right capture access instructions for your market.");
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
        title="Blueprint Capture App"
        description="Download the Blueprint Capture app, scan the QR code, or request launch access for your market."
        canonical="/capture-app"
      />
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                <Smartphone className="h-3.5 w-3.5" />
                Blueprint Capture App
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Your mobile gateway to Blueprint's capture network.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Capturers do not create web accounts. Download the app on the phone that will do
                the work, scan the QR code from another device, or request launch access for your
                market.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
                  <Shield className="h-5 w-5 text-emerald-300" />
                  <p className="mt-4 text-sm font-semibold text-white">Capture and upload fast</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Start sessions from your phone, upload on the move, and keep every submission
                    tied to the right device flow.
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
                  <MessageSquareShare className="h-5 w-5 text-sky-300" />
                  <p className="mt-4 text-sm font-semibold text-white">Task feed and payouts</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Browse available work, monitor approval status, and keep payout activity in one
                    mobile workflow.
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
                  <QrCode className="h-5 w-5 text-amber-300" />
                  <p className="mt-4 text-sm font-semibold text-white">QR and link handoff</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Open the app listing directly, text yourself the link, or keep a scannable
                    download path live for recruiting and ops.
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Current mobile app link
                </p>
                <p className="mt-4 break-all rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                  {captureAppUrl}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
                  >
                    <Copy className="mr-2 h-4 w-4" />
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
                    className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                  >
                    Download the app
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href={smsHref}
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
                  >
                    Text to phone
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              </div>
            </section>

            <section className="grid gap-6">
              <div className="rounded-[2rem] border border-slate-800 bg-white p-6 text-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Early access
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  Request launch access
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tell us where you are and which device you plan to use. We’ll route the right
                  instructions when your market is active.
                </p>

                <form onSubmit={handleWaitlistSubmit} className="mt-6 space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-slate-950"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Home market</span>
                    <input
                      value={market}
                      onChange={(event) => setMarket(event.target.value)}
                      placeholder="Raleigh-Durham, NC"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-slate-950"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Phone</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="(919) 555-0123"
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none transition focus:border-slate-950"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Primary capture device</span>
                    <select
                      value={device}
                      onChange={(event) => setDevice(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-950"
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
                    className="inline-flex h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending request
                      </>
                    ) : (
                      <>
                        Request launch access
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                {message ? (
                  <p
                    className={`mt-4 text-sm ${
                      status === "error" ? "text-rose-600" : "text-emerald-700"
                    }`}
                  >
                    {message}
                  </p>
                ) : null}
              </div>

              <div className="rounded-[2rem] border border-slate-800 bg-slate-900 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Scan QR
                </p>
                <div className="mt-5 flex items-center justify-center rounded-3xl border border-slate-800 bg-white p-4">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR code for Blueprint Capture access"
                      className="h-44 w-44 rounded-2xl"
                    />
                  ) : (
                    <div className="py-16 text-sm text-slate-500">Generating QR code...</div>
                  )}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  Keep this route stable. It gives recruiting, ops, and public capturer traffic one
                  shareable destination even as the downstream app link changes.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/capture"
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
                  >
                    Learn about capture
                  </a>
                  <a
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
                  >
                    Web portal sign in
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
