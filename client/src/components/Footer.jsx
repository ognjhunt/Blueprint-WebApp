import React from "react";
import { BrandLockup } from "@/components/site/BrandMark";

const productLinks = [
  ["Product", "/product"],
  ["World models", "/world-models"],
  ["Sample proof", "/proof"],
  ["Pricing", "/pricing"],
];

const supportLinks = [
  ["Capture", "/capture"],
  ["Trust", "/governance"],
  ["Contact", "/contact?persona=robot-team"],
  ["Support", "/help"],
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0d0d0b] text-white">
      <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.4fr_0.8fr_0.8fr] lg:px-10">
        <div className="max-w-xl">
          <a href="/" className="inline-flex" aria-label="Blueprint home">
            <BrandLockup tone="paper" compact />
          </a>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/65">
            Capture-backed site-specific world models, hosted review rooms, and package evidence for robot teams.
          </p>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/55">
            Sample proof stays labeled. Rights, freshness, and hosted access stay visible before a buyer commits.
          </p>
        </div>

        <nav className="space-y-3 text-sm text-white/70" aria-label="Product links">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Product
          </p>
          {productLinks.map(([label, href]) => (
            <a key={href} href={href} className="block transition hover:text-white">
              {label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-white/70" aria-label="Support links">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Support
          </p>
          {supportLinks.map(([label, href]) => (
            <a key={href} href={href} className="block transition hover:text-white">
              {label}
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-white/45 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[88rem] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} Blueprint, Inc. All rights reserved.</span>
          <span>Capture first. Exact-site world-model products.</span>
        </div>
      </div>
    </footer>
  );
}
