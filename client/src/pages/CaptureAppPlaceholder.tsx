"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquareShare,
  QrCode,
  Shield,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      `Blueprint Capture private beta link:\n${captureAppUrl}\n\nUse this link for invite-only access and install instructions.`,
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
          width: 360,
          margin: 1,
          color: {
            dark: "#111418",
            light: "#fbf8ef",
          },
        });

        if (active) {
          setQrCodeUrl(dataUrl);
        }
      } catch (error) {
        console.error("Failed to generate placeholder QR code:", error);
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
        throw new Error(responseBody?.error || "Failed to join the private beta list.");
      }

      setStatus("success");
      setMessage("Private beta request received. We’ll send access instructions when your market opens.");
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
      console.error("Failed to copy placeholder link:", error);
      setCopyState("failed");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  };

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#f2ebde] px-4 py-8 text-[#15181a] sm:py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 12%, rgba(92, 143, 79, 0.18), transparent 24%), radial-gradient(circle at 82% 18%, rgba(223, 168, 58, 0.22), transparent 22%), linear-gradient(180deg, #f6f0e5 0%, #efe5d7 100%)",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34 }}
          className="overflow-hidden rounded-[2.25rem] border border-[#d9c9ae] bg-[#fbf8ef] shadow-[0_30px_120px_rgba(77,57,24,0.11)]"
        >
          <div className="grid lg:grid-cols-[1.04fr_0.96fr]">
            <section className="relative border-b border-[#e6d9c4] p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,_rgba(92,143,79,0.2),_transparent_64%)]" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c9ae] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4a7045]">
                  <Compass className="h-3.5 w-3.5" />
                  Invite-Only Beta
                </div>

                <div className="mt-7 max-w-xl">
                  <p className="text-sm uppercase tracking-[0.22em] text-[#7d6f5d]">
                    Blueprint Capture
                  </p>
                  <h1 className="mt-3 text-[clamp(3rem,8vw,5.5rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-[#111418]">
                    Download flow now.
                    <br />
                    Native app next.
                  </h1>
                  <p className="mt-5 max-w-lg text-base leading-7 text-[#5b5145] sm:text-lg">
                    This page acts like an app-store handoff before the store exists. Join the
                    private beta, scan the QR, or text the link to yourself so capturers move from
                    web signup into an app-first funnel.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3 text-sm">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c9ae] bg-white px-4 py-2 text-[#40382f]">
                    <CheckCircle2 className="h-4 w-4 text-[#4a7045]" />
                    Indoor capture only
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c9ae] bg-white px-4 py-2 text-[#40382f]">
                    <Smartphone className="h-4 w-4 text-[#4a7045]" />
                    iPhone-first beta
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c9ae] bg-white px-4 py-2 text-[#40382f]">
                    <Shield className="h-4 w-4 text-[#4a7045]" />
                    Market-by-market rollout
                  </div>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[1.8rem] border border-[#d9c9ae] bg-[#12181c] p-5 text-[#f7f2e7]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d8c9b0]">
                        Beta access
                      </p>
                      <Sparkles className="h-4 w-4 text-[#d8b14d]" />
                    </div>
                    <p className="mt-5 text-2xl font-semibold tracking-[-0.04em]">
                      Join the list and we’ll route you when your market opens.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#d7c9b5]">
                      Current site usage is placeholder-first: invite handling, install instructions,
                      and a stable link for QR scans.
                    </p>
                  </div>

                  <div className="rounded-[1.8rem] border border-[#d9c9ae] bg-[#efe3cf] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c6d58]">
                      Handoff pattern
                    </p>
                    <p className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.04em] text-[#1a1d1f]">
                      Website for signup.
                      <br />
                      Capture app for work.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#5e5448]">
                      Same split used by the strongest worker funnels: brief web onboarding, then an
                      app-first operating surface.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-[#fcf9f2] p-7 sm:p-10">
              <div className="grid gap-6">
                <div className="rounded-[2rem] border border-[#ded1bb] bg-white p-6">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d6f5d]">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Request access
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#131619]">
                    Join the private beta
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#5b5145]">
                    Leave your email and market. We’ll use this to send invite instructions and
                    prioritize cities where capturers are already ready to go.
                  </p>

                  <form onSubmit={handleWaitlistSubmit} className="mt-6 space-y-4">
                    <div>
                      <Label htmlFor="capture-beta-email" className="text-[#1f2326]">
                        Email
                      </Label>
                      <Input
                        id="capture-beta-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="mt-2 h-12 rounded-2xl border-[#d8cab3] bg-[#fbf8ef]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="capture-beta-market" className="text-[#1f2326]">
                        Home market
                      </Label>
                      <Input
                        id="capture-beta-market"
                        value={market}
                        onChange={(event) => setMarket(event.target.value)}
                        placeholder="Raleigh-Durham, NC"
                        className="mt-2 h-12 rounded-2xl border-[#d8cab3] bg-[#fbf8ef]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="capture-beta-phone" className="text-[#1f2326]">
                        Phone
                      </Label>
                      <Input
                        id="capture-beta-phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="(919) 555-0123"
                        className="mt-2 h-12 rounded-2xl border-[#d8cab3] bg-[#fbf8ef]"
                      />
                    </div>
                    <div>
                      <Label className="text-[#1f2326]">Capture device</Label>
                      <Select value={device} onValueChange={setDevice}>
                        <SelectTrigger className="mt-2 h-12 rounded-2xl border-[#d8cab3] bg-[#fbf8ef]">
                          <SelectValue placeholder="Select your primary device" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iphone">iPhone</SelectItem>
                          <SelectItem value="ipad">iPad</SelectItem>
                          <SelectItem value="smart_glasses">Smart glasses</SelectItem>
                          <SelectItem value="android">Android phone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-[1.4rem] border border-[#e6d9c4] bg-[#fbf8ef] px-4 py-3 text-sm text-[#5b5145]">
                      Role: <span className="font-semibold text-[#1f2326]">Capturer applicant</span>
                    </div>
                    <Button
                      type="submit"
                      disabled={status === "loading"}
                      className="h-12 w-full rounded-full bg-[#111418] text-white hover:bg-[#4a7045]"
                    >
                      {status === "loading" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending request
                        </>
                      ) : (
                        <>
                          Request beta access
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  {message ? (
                    <p
                      className={`mt-4 text-sm ${
                        status === "error" ? "text-[#b6423c]" : "text-[#316c46]"
                      }`}
                    >
                      {message}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[2rem] border border-[#ded1bb] bg-[#f4ebdc] p-6">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d6f5d]">
                    <MessageSquareShare className="h-3.5 w-3.5" />
                    SMS handoff
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#131619]">
                    Send the link to your phone
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#5b5145]">
                    Useful before distribution is public. Open the placeholder link on mobile, then
                    swap the destination later when TestFlight or the App Store is ready.
                  </p>

                  <div className="mt-5 rounded-[1.5rem] border border-[#d8cab3] bg-white p-4">
                    <p className="break-all text-sm leading-6 text-[#2d3134]">{captureAppUrl}</p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyLink}
                      className="rounded-full border-[#cbb99b] bg-white"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copyState === "copied"
                        ? "Copied"
                        : copyState === "failed"
                          ? "Copy failed"
                          : "Copy link"}
                    </Button>
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      className="rounded-full border-[#cbb99b] bg-white"
                    >
                      <a href={smsHref}>
                        Start SMS draft
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[0.84fr_1.16fr]">
                  <div className="rounded-[2rem] border border-[#ded1bb] bg-white p-5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d6f5d]">
                      <QrCode className="h-3.5 w-3.5" />
                      Scan
                    </div>
                    <div className="mt-4 flex items-center justify-center rounded-[1.5rem] border border-[#e4d8c6] bg-[#fbf8ef] p-3">
                      {qrCodeUrl ? (
                        <img
                          src={qrCodeUrl}
                          alt="QR code for Blueprint Capture private beta landing page"
                          className="h-40 w-40 rounded-xl"
                        />
                      ) : (
                        <div className="py-16 text-xs text-[#7d6f5d]">Generating QR...</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-[#ded1bb] bg-[#111418] p-6 text-[#f7f2e7]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d7c8b2]">
                      Before launch
                    </p>
                    <div className="mt-4 space-y-4 text-sm leading-6 text-[#d7c8b2]">
                      <p>
                        Keep this page live during private beta. It gives you a stable destination
                        for signup handoff, QR scans, and outbound invites before mobile
                        distribution exists.
                      </p>
                      <p>
                        Once the native app is ready, update the env placeholder URL and this whole
                        flow becomes your real download surface without changing the capturer signup
                        route again.
                      </p>
                    </div>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Button asChild className="rounded-full bg-[#f7f2e7] text-[#131619] hover:bg-white">
                        <a href="/signup/capturer">Capturer signup</a>
                      </Button>
                      <Button asChild variant="outline" className="rounded-full border-[#7e6e58] text-[#f7f2e7] hover:bg-white/5">
                        <a href="/capture">Capture overview</a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
