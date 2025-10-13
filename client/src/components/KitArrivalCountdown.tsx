"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const KIT_DELIVERY_LEAD_TIME_BUSINESS_DAYS = 3;
export const DEFAULT_KIT_TRACKING_URL = "https://blueprint.build/track-kits";

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
};

type KitArrivalCountdownProps = {
  targetDate: Date | null;
  trackingUrl?: string | null;
  context?: "dashboard" | "onboarding";
  className?: string;
};

function getCountdownParts(targetDate: Date | null): CountdownParts | null {
  if (!targetDate) {
    return null;
  }

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const isPast = diffMs <= 0;
  const absoluteMs = Math.abs(diffMs);

  const minutes = Math.floor(absoluteMs / (1000 * 60));
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes - days * 60 * 24) / 60);
  const remainingMinutes = minutes - days * 60 * 24 - hours * 60;

  return {
    days: Math.max(days, 0),
    hours: Math.max(hours, 0),
    minutes: Math.max(remainingMinutes, 0),
    isPast,
  };
}

export function KitArrivalCountdown({
  targetDate,
  trackingUrl = DEFAULT_KIT_TRACKING_URL,
  context = "dashboard",
  className,
}: KitArrivalCountdownProps) {
  const [countdown, setCountdown] = useState<CountdownParts | null>(() =>
    getCountdownParts(targetDate),
  );

  useEffect(() => {
    setCountdown(getCountdownParts(targetDate));

    if (!targetDate) {
      return;
    }

    const interval = window.setInterval(() => {
      setCountdown(getCountdownParts(targetDate));
    }, 60000);

    return () => window.clearInterval(interval);
  }, [targetDate]);

  const formattedDate = useMemo(() => {
    if (!targetDate) {
      return null;
    }

    return targetDate.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [targetDate]);

  const baseClassName =
    "relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-cyan-500/10 p-6 text-slate-100 shadow-lg";

  const containerClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName;

  const title =
    context === "dashboard"
      ? "Activation kits en route"
      : "QR activation kits ship next";

  const description =
    context === "dashboard"
      ? "We’ll email you tracking details the moment your package leaves our warehouse."
      : "Once you complete checkout we’ll dispatch your QR kits within three business days.";

  const footnote =
    context === "dashboard"
      ? "Your subscription will activate as soon as the kits are delivered and activated on site."
      : "We’ll also start your subscription once you scan the QR kits at your venue.";

  return (
    <div className={containerClassName}>
      <div className="absolute inset-0 opacity-40">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
              Blueprint logistics
            </p>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <p className="text-sm text-emerald-100/90">{description}</p>
          </div>
        </div>

        {countdown ? (
          <div className="mt-2 grid grid-cols-3 gap-3 text-center sm:grid-cols-3">
            {[
              { label: "Days", value: countdown.days },
              { label: "Hours", value: countdown.hours },
              { label: "Minutes", value: countdown.minutes },
            ].map((segment) => (
              <div
                key={segment.label}
                className="rounded-xl border border-emerald-400/30 bg-white/5 py-4"
              >
                <div className="text-3xl font-bold text-white">
                  {segment.value.toString().padStart(2, "0")}
                </div>
                <div className="text-xs uppercase tracking-wide text-emerald-100/80">
                  {segment.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <Clock className="h-4 w-4 text-emerald-200" />
            <span>We’ll confirm your ship date as soon as checkout is complete.</span>
          </div>
        )}

        {formattedDate && (
          <p className="text-sm text-emerald-100/80">
            Estimated arrival: <span className="font-semibold text-white">{formattedDate}</span>
          </p>
        )}

        <p className="text-xs text-emerald-100/70">{footnote}</p>

        {context === "dashboard" && countdown && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              className="bg-white/10 text-white hover:bg-white/20"
              onClick={() => {
                if (trackingUrl) {
                  window.open(trackingUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Track package
            </Button>
            <p className="text-xs text-emerald-100/70">
              We’ll nudge you when it’s time to activate the QR markers.
            </p>
          </div>
        )}

        {context === "dashboard" && countdown?.isPast && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Your kits should have arrived. Once you’ve placed them on site, head to the Activation checklist to start your subscription.
          </div>
        )}
      </div>
    </div>
  );
}

export default KitArrivalCountdown;
