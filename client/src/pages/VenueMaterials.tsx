// ===============================================
// FILE: src/pages/VenueMaterials.tsx
// PURPOSE: Public page for Blueprint "Venue Kit & Signage"
// NOTES:
// - Explains Starter Kit (what’s inside, how it works, free for first location)
// - Lets venues re-order materials or buy add-ons (pricing table)
// - Matches site aesthetic: dark aurora, emerald→cyan accents, glass cards
// - Copy written to be crisp, sales-ready, and self-serve friendly
// - Uses existing components: Nav, Footer, shadcn/ui Card & Button, wouter Link
// ===============================================

import React, { useMemo } from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Truck,
  Sparkles,
  MapPin,
  QrCode,
  PanelsTopLeft,
  ImageIcon,
  Tags,
  Hand,
  Info,
  HelpCircle,
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  ScanLine,
  Sticker,
  Square,
  Landmark,
} from "lucide-react";

type KitItem = {
  qty: number | string;
  name: string;
  blurb: string;
  icon?: React.ReactNode;
};

type AddOn = {
  sku: string;
  name: string;
  price: string;
  unit?: string;
  blurb: string;
  bestFor?: string;
  icon?: React.ReactNode;
};

type Step = {
  title: string;
  blurb: string;
  icon: React.ReactNode;
};

export default function VenueMaterials() {
  // --- Content model ---
  const starterKitItems: KitItem[] = [
    {
      qty: 2,
      name: 'Small Window Clings (6" round)',
      blurb:
        "Inside-glass static clings for entrance or secondary doors. Double-sided print with dynamic QR into your venue’s Blueprint.",
      icon: <ImageIcon className="w-4 h-4" />,
    },
    {
      qty: 1,
      name: 'Entrance Cling (8" × 10")',
      blurb:
        "High-visibility door cling to drive scans from foot traffic. Peel, place, reposition.",
      icon: <PanelsTopLeft className="w-4 h-4" />,
    },
    {
      qty: 10,
      name: 'Vinyl QR Stickers (3" × 3")',
      blurb:
        "For host stand, registers, elevators, and display cases. Durable matte laminate.",
      icon: <Sticker className="w-4 h-4" />,
    },
    {
      qty: 2,
      name: 'Acrylic Sign Holders (5" × 7") + Cards',
      blurb:
        "Countertop ‘Scan to enter Blueprint’ signs with printed inserts. Easy swap for new campaigns.",
      icon: <Square className="w-4 h-4" />,
    },
    {
      qty: "200–250",
      name: 'Take-home Promo Cards (4" × 6")',
      blurb:
        "Short ‘What is Blueprint?’ explainer with your venue link. Great for concierge, takeaway, or exhibits.",
      icon: <Tags className="w-4 h-4" />,
    },
    {
      qty: "Install pack",
      name: "Wipes + placement diagram",
      blurb:
        "Everything needed for clean install and a quick walkthrough for staff.",
      icon: <Hand className="w-4 h-4" />,
    },
  ];

  const addOns: AddOn[] = [
    {
      sku: "AFR-2436",
      name: 'A-Frame Sidewalk Sign (24" × 36")',
      price: "$129",
      blurb:
        "Street-side capture with two weather-resistant inserts. Perfect for museums, hotels, and retail on busy corridors.",
      bestFor: "High-foot-traffic streets",
      icon: <Landmark className="w-4 h-4" />,
    },
    {
      sku: "FLR-1212-2PK",
      name: 'Floor Decals (12" × 12", 2-pack)',
      price: "$24",
      blurb:
        "Slip-resistant decals for queue zones — ‘Stand here & scan’. Removable adhesive.",
      bestFor: "Queues & lobbies",
      icon: <ScanLine className="w-4 h-4" />,
    },
    {
      sku: "CLG-0606-2PK",
      name: 'Small Window Clings (6" round, 2-pack)',
      price: "$7",
      blurb:
        "Replacements for additional doors or showcases. Inside-glass static cling.",
      bestFor: "Secondary entrances",
      icon: <ImageIcon className="w-4 h-4" />,
    },
    {
      sku: "STK-0303-20PK",
      name: 'QR Stickers (3" × 3", 20-pack)',
      price: "$18",
      blurb:
        "Extra stickers for counters, cases, and guest touchpoints. Matte, scuff-resistant.",
      bestFor: "Counters & displays",
      icon: <Sticker className="w-4 h-4" />,
    },
    {
      sku: "ENT-0810",
      name: 'Entrance Cling (8" × 10")',
      price: "$9",
      blurb:
        "Swap with seasonal creative or replace wear-and-tear. Static cling, removable.",
      bestFor: "Main door",
      icon: <PanelsTopLeft className="w-4 h-4" />,
    },
    {
      sku: "ACR-5X7-SET",
      name: 'Acrylic Holder + Insert (5" × 7")',
      price: "$8",
      blurb: "Durable sign holder with a fresh printed card for new campaigns.",
      bestFor: "Counters",
      icon: <Square className="w-4 h-4" />,
    },
  ];

  const steps: Step[] = [
    {
      title: "Sign up & verify",
      blurb:
        "Create your location, confirm shipping details, and choose mapping: self-scan or white-glove.",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-300" />,
    },
    {
      title: "We generate your dynamic QR",
      blurb:
        "Each code is unique per placement, so you can track scans and update destinations later — no reprints.",
      icon: <QrCode className="w-5 h-5 text-cyan-300" />,
    },
    {
      title: "Kit ships or rides with mapper",
      blurb:
        "First Starter Kit is free. We ship ahead of time, or your mapper brings it to install on day-of.",
      icon: <Truck className="w-5 h-5 text-emerald-300" />,
    },
    {
      title: "Place, scan, and go live",
      blurb:
        "Scan each QR once to register installation. Your Blueprint opens instantly for guests and staff.",
      icon: <Sparkles className="w-5 h-5 text-cyan-300" />,
    },
  ];

  const faqs = useMemo(
    () => [
      {
        q: "Is the Starter Kit really free?",
        a: "Yes — your first kit per activated location is included. Re-orders or additional kits are billed at the prices below.",
      },
      {
        q: "How do the QR codes work?",
        a: "They’re dynamic links. Each placement has its own code for analytics and can be repointed later without reprinting.",
      },
      {
        q: "Can the mapper install everything?",
        a: "Yes. If mapping is scheduled within ~3 business days, the mapper brings your kit and installs during the visit.",
      },
      {
        q: "What if we need more materials?",
        a: "Order à la carte below or choose an extra Starter Kit. Multi-site chains can bulk-order from our team.",
      },
      {
        q: "How fast is shipping?",
        a: "Most kits ship in 2–3 business days. Standard ground 3–5 days in the U.S.; expedited options at checkout.",
      },
      {
        q: "Can we customize the art?",
        a: "Yes — co-branding and translated variants are available. Talk to us for templates and print specs.",
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100">
      {/* BACKGROUND: subtle dot grid + emerald→cyan aurora wash */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
      </div>

      <Nav />

      <main className="flex-1 pt-24 px-4 md:px-8">
        {/* HERO */}
        <section className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black leading-[1.12]">
              <span
                className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 pb-[0.08em]"
                style={{ WebkitTextFillColor: "transparent" }}
              >
                Venue Kit & Signage
              </span>
            </h1>
            <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
              Everything you need to launch and promote your Blueprint on-site —
              QR codes that just work, clear signage, and a simple install flow.
              Your first Starter Kit is{" "}
              <span className="text-emerald-300 font-semibold">free</span>.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                Dynamic links, privacy-safe
              </span>
              <span className="opacity-40">•</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                Per-placement analytics
              </span>
              <span className="opacity-40">•</span>
              <span className="inline-flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-emerald-300" />
                2–3 day handling
              </span>
            </div>
          </div>

          {/* HOW IT WORKS */}
          <div className="grid gap-4 md:grid-cols-4 mb-12">
            {steps.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  {s.icon}
                  <h3 className="font-semibold text-white">{s.title}</h3>
                </div>
                <p className="text-sm text-slate-300">{s.blurb}</p>
              </div>
            ))}
          </div>

          {/* STARTER KIT CARD */}
          <Card className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm shadow-xl mb-12">
            <CardHeader className="md:flex md:items-center md:justify-between">
              <div className="mb-4 md:mb-0">
                <CardTitle className="text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-300" />
                  Starter Kit
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Ships free on your first location — or delivered and installed
                  by your mapper.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  First kit: Free
                </Badge>
                <Badge className="bg-white/10 text-slate-100 border border-white/15">
                  Re-order: $79
                </Badge>
              </div>
            </CardHeader>

            <div className="px-6 pb-6">
              <div className="grid md:grid-cols-3 gap-4">
                {starterKitItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-slate-400">
                        Qty: <span className="text-slate-200">{it.qty}</span>
                      </div>
                      <div className="text-emerald-300">{it.icon}</div>
                    </div>
                    <div className="font-semibold text-white">{it.name}</div>
                    <p className="text-sm text-slate-300">{it.blurb}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-300" />
                  Includes dynamic QR codes for each placement, so you can
                  update destinations later without reprinting.
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/signup" className="inline-block">
                    <Button className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white h-10">
                      Claim your free kit
                    </Button>
                  </Link>
                  <Link href="/materials-order" className="inline-block">
                    <Button
                      variant="outline"
                      className="rounded-xl h-10 border-white/20 text-white"
                    >
                      Re-order ($79)
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          {/* ADD-ONS / RE-ORDER GRID */}
          <section className="mb-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                Add-ons & Re-orders
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-300" />
                Bulk or custom branding?{" "}
                <a
                  href="/contact"
                  className="text-emerald-300 hover:text-cyan-300 underline underline-offset-4"
                >
                  Talk to us
                </a>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {addOns.map((a) => (
                <div
                  key={a.sku}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-400">SKU: {a.sku}</div>
                    <div className="text-cyan-300">{a.icon}</div>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{a.name}</h3>
                  <p className="text-sm text-slate-300 mt-1">{a.blurb}</p>
                  {a.bestFor && (
                    <div className="mt-3 text-xs text-slate-400">
                      Best for:{" "}
                      <span className="text-slate-200">{a.bestFor}</span>
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div className="text-xl font-extrabold text-white">
                      {a.price}
                      {a.unit ? (
                        <span className="text-sm text-slate-400 font-medium ml-1">
                          {a.unit}
                        </span>
                      ) : null}
                    </div>
                    <Link href={`/materials-order?sku=${a.sku}`}>
                      <Button className="rounded-xl h-10 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white">
                        Add
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Shipping & fulfillment note */}
            <div className="mt-4 text-xs text-slate-400 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-300" />
              Most items ship in 2–3 business days. Standard ground 3–5 days
              (US). Expedited options at checkout.
            </div>
          </section>

          {/* WHY THIS WORKS */}
          <section className="mb-16">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
                <div className="flex items-center gap-2 mb-1">
                  <QrCode className="w-5 h-5 text-emerald-300" />
                  <h3 className="font-semibold text-white">
                    Frictionless entry
                  </h3>
                </div>
                <p className="text-sm text-slate-300">
                  Guests and staff scan once and land in your Blueprint — no app
                  download required. Dynamic links route to the best experience
                  for each device.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-5 h-5 text-cyan-300" />
                  <h3 className="font-semibold text-white">
                    Placement-level analytics
                  </h3>
                </div>
                <p className="text-sm text-slate-300">
                  Each QR is unique. See which doors, counters, or exhibits
                  drive the most entries — and optimize where you place signage.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-emerald-300" />
                  <h3 className="font-semibold text-white">Easy to evolve</h3>
                </div>
                <p className="text-sm text-slate-300">
                  Update campaigns without reprinting: retarget links, swap
                  creative, or A/B test placements over time.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-20">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-cyan-300" />
              <h2 className="text-2xl font-bold text-white">FAQ</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {faqs.map((f, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"
                >
                  <h3 className="font-semibold text-white mb-1">{f.q}</h3>
                  <p className="text-sm text-slate-300">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="mb-24">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-6 md:p-10 text-center relative overflow-hidden">
              <div className="pointer-events-none absolute -top-1/2 left-1/2 h-[120%] w-[60%] -translate-x-1/2 rotate-12 bg-gradient-to-b from-white/10 to-transparent blur-2xl" />
              <h3 className="text-2xl md:text-4xl font-black text-white">
                Ready to put Blueprint in your space?
              </h3>
              <p className="mt-3 text-slate-300 max-w-2xl mx-auto">
                Claim your free Starter Kit at signup, or re-order materials
                anytime. We’ll ship it or bring it with your mapper — whatever
                gets you live fastest.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup">
                  <Button className="rounded-xl h-12 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white">
                    Claim Free Starter Kit
                  </Button>
                </Link>
                <Link href="/materials-order">
                  <Button
                    variant="outline"
                    className="rounded-xl h-12 border-white/20 text-white"
                  >
                    Re-order or Add-ons
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* LEGAL / TINY PRINT */}
          <section className="mb-10">
            <div className="text-[11px] leading-relaxed text-slate-400">
              <p className="mb-1">
                <strong>Pricing:</strong> First Starter Kit is free for the
                initial location activation. Re-orders and add-ons are billed as
                listed above. Taxes and shipping may apply to re-orders.
                Co-brand and custom language variants available upon request.
              </p>
              <p className="mb-1">
                <strong>Fulfillment:</strong> Typical handling time 2–3 business
                days. Ground shipping 3–5 business days for most U.S. addresses;
                expedited options available during checkout.
              </p>
              <p>
                <strong>Installation:</strong> If a mapper visit is scheduled
                within ~3 business days, your kit may be delivered and installed
                on-site by the mapper. Otherwise, we ship ahead of time with a
                quick install guide.
              </p>
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}
