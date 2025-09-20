// ===============================================
// FILE: src/components/sections/Hero.jsx
// PURPOSE: Conversion-optimized hero w/ premium motion & reduced-motion guard (JSX)
// ===============================================

"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { MapPin, Sparkles } from "lucide-react";

export default function Hero({ onPrimaryCta }) {
  // Rotating, plain-English value props for owners/operators.
  const lines = [
    {
      k: "pitch",
      pre: "The simple pitch:",
      highlight: "Turn your location into an AI-powered place people love.",
      sub: "Blueprint adds a ‘glasses concierge’ that answers questions, gives directions, and triggers tasks—without you building an app.",
    },
    {
      k: "how",
      pre: "Fast to pilot:",
      highlight: "Scan today, go live next week.",
      sub: "We capture your space, map common questions & tasks, and deliver a hands-on demo for your team.",
    },
    {
      k: "why",
      pre: "Why now:",
      highlight: "AI + glasses are moving from novelty to normal.",
      sub: "Be ready as staff and visitors start wearing them on-site—Blueprint makes it easy to start, learn, and scale.",
    },
    {
      k: "compat",
      pre: "Built for real hardware:",
      highlight: "Works with today’s smart glasses and phones.",
      sub: "Start on phones and current glasses now—future-proof your space as the next wave ships.",
    },
  ];

  const features = [
    "No app to build",
    "Setup in ~10 days",
    "On-site demo 1–2 hrs",
    "Works with smart glasses & phones",
    "Analytics & insights included",
  ];

  const lines2 = [
    {
      k: "owners",
      pre: "For location owners:",
      highlight: "Bring wearable AI service to your venue in weeks.",
      sub: "Blueprint packages the new device access toolkits into guest-ready pilots for retail, hospitality, attractions, and campuses.",
    },
    {
      k: "how",
      pre: "What we handle:",
      highlight: "Space scans, agent flows, and hardware provisioning.",
      sub: "We capture your layout, map the top questions and tasks, and deliver a guided run-through for your team.",
    },
    {
      k: "why",
      pre: "Why plan now:",
      highlight: "Wearable assistants are arriving from every major platform.",
      sub: "Blueprint keeps your location ready as Meta, Google, Apple, and Samsung release next-gen glasses.",
    },
    {
      k: "proof",
      pre: "Outcomes you can measure:",
      highlight: "On-site pilots tied to staffing, revenue, and guest KPIs.",
      sub: "We integrate with your CRM, LMS, and analytics so you learn what to scale.",
    },
  ];

  const features2 = [
    "Venue scan + AI flows in ~10 days",
    "No custom app required",
    "Works with smart glasses & phones",
    "Staff onboarding + playbooks included",
    "Analytics & privacy controls baked in",
  ];

  const [variant, setVariant] = useState("A");
  const [idx, setIdx] = useState(0);
  const wrapRef = useRef(null);
  const inView = useInView(wrapRef, { once: true, margin: "-10% 0px" });
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const resolveVariant = () => {
      if (typeof window === "undefined") return "A";
      const stored = window.sessionStorage.getItem("heroVariant");
      if (stored === "A" || stored === "B") return stored;
      const generated = Math.random() < 0.5 ? "A" : "B";
      window.sessionStorage.setItem("heroVariant", generated);
      return generated;
    };

    const nextVariant = resolveVariant();
    setVariant(nextVariant);
  }, []);

  const activeLines = variant === "A" ? lines : lines2;
  const activeFeatures = variant === "A" ? features : features2;
  const currentLine = activeLines[idx] ?? activeLines[0];

  useEffect(() => {
    if (shouldReduce) return;
    const id = setInterval(
      () => setIdx((p) => (p + 1) % activeLines.length),
      6500,
    );
    return () => clearInterval(id);
  }, [shouldReduce, activeLines.length, variant]);

  useEffect(() => {
    setIdx(0);
  }, [variant]);

  const handlePrimary = () => {
    if (typeof onPrimaryCta === "function") onPrimaryCta();
    const el = document.getElementById("contactForm");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative overflow-hidden bg-[#0B1220]">
      {/* Background accents */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
        {/* Soft spotlight */}
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_10%,rgba(16,185,129,0.08)_0%,rgba(59,130,246,0.05)_35%,transparent_70%)]" />
        {/* Floating orbs */}
        {!shouldReduce && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 0.35, scale: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="absolute -top-40 -right-20 h-[36rem] w-[36rem] rounded-full blur-3xl bg-gradient-to-br from-emerald-500/30 via-cyan-500/25 to-sky-500/10"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 0.25, scale: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.1 }}
              className="absolute -bottom-40 -left-20 h-[30rem] w-[30rem] rounded-full blur-3xl bg-gradient-to-tr from-sky-500/10 via-emerald-500/15 to-amber-400/10"
            />
          </>
        )}
      </div>

      <div
        ref={wrapRef}
        className="container mx-auto px-4 pt-[88px] md:pt-20 pb-10 md:pb-16"
      >
        {/* Durham badge */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-300" />
          Durham area • AI glasses readiness pilot
        </motion.div>

        {/* Headline block */}
        <div className="mt-4 md:mt-6 min-h-[7.5rem] md:min-h-[9.5rem] pb-1 md:pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentLine?.k ?? "hero-line"}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.55 }}
            >
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black lg:leading-[1.08] md:leading-[1.1] leading-[1.12] text-white">
                <span className="block text-slate-100">{currentLine?.pre}</span>
                <span
                  className="block bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-200 bg-clip-text text-transparent inline-block pb-[0.06em]"
                  style={{ WebkitTextFillColor: "transparent" }}
                >
                  {currentLine?.highlight}
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base md:text-lg text-slate-300">
                {currentLine?.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 10 }}
          transition={{ delay: 0.15 }}
          className="mt-5 flex flex-wrap gap-2"
        >
          {activeFeatures.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
            >
              {t}
            </span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 10 }}
          transition={{ delay: 0.25 }}
          className="mt-6 flex flex-col sm:flex-row gap-3"
        >
          <Button
            onClick={handlePrimary}
            className="h-12 w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 text-base font-semibold text-white shadow-xl border-0 hover:shadow-2xl hover:scale-[1.02] transition"
          >
            Join the Durham AI pilot (Free)
            <ArrowRightIcon className="ml-2 h-5 w-5" />
          </Button>
          <Link href="/pilot-program">
            <Button
              variant="outline"
              className="h-12 w-full sm:w-auto rounded-xl border-white/20 px-6 text-base text-slate-800 hover:bg-white/10"
            >
              <Sparkles className="mr-2 h-5 w-5 text-emerald-500" />
              See AI workflows & how it works
            </Button>
          </Link>
        </motion.div>

        <p className="mt-2 text-xs text-slate-400">
          Pilot includes one on-site demo window; the AI experience is live
          during that session only.
        </p>

        {/* Scroll cue (desktop) */}
        <div className="hidden md:block mt-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-xs text-slate-400"
          >
            Scroll to see Blueprint in action
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// // ===============================================
// // FILE: src/components/sections/Hero.jsx
// // PURPOSE: Conversion-optimized hero w/ premium motion & reduced-motion guard (JSX)
// // ===============================================

// "use client";
// import React, { useEffect, useRef, useState } from "react";
// import {
//   motion,
//   AnimatePresence,
//   useInView,
//   useReducedMotion,
// } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import { Link } from "wouter";
// import { ArrowRightIcon } from "@heroicons/react/24/solid";
// import { MapPin, Sparkles } from "lucide-react";

// export default function Hero({ onPrimaryCta }) {
//   const lines = [
//     {
//       k: "what",
//       pre: "Blueprint in one line:",
//       highlight:
//         "Turn your space into a guided, interactive AR layer—just by scanning a QR code.",
//       sub: "Guests use their headsets (or smart glasses). No app to install. No hardware to buy.",
//     },
//     {
//       k: "how",
//       pre: "We do the heavy lifting:",
//       highlight:
//         "Map your location → design the content → on-site demo in ~10 days.",
//       sub: "Two short visits from us: Day 1 mapping (~60 min), then a demo 1–2 hrs about a week later.",
//     },
//     {
//       k: "pilot",
//       pre: "Now enrolling in Durham:",
//       highlight: "$0 to try Blueprint at your location.",
//       sub: "Free, feedback-only pilot. Two visits: mapping (~60 min) + demo (1–2 hrs). No contract; no purchase option yet.",
//     },
//   ];

//   const [idx, setIdx] = useState(0);
//   const wrapRef = useRef(null);
//   const inView = useInView(wrapRef, { once: true, margin: "-10% 0px" });
//   const shouldReduce = useReducedMotion();

//   useEffect(() => {
//     if (shouldReduce) return;
//     const id = setInterval(() => setIdx((p) => (p + 1) % lines.length), 6500);
//     return () => {
//       clearInterval(id);
//     };
//   }, [shouldReduce, lines.length]);

//   const handlePrimary = () => {
//     if (typeof onPrimaryCta === "function") onPrimaryCta();
//     const el = document.getElementById("contactForm");
//     if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
//   };

//   return (
//     <section className="relative overflow-hidden bg-[#0B1220]">
//       {/* Background accents */}
//       <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
//         {/* Soft spotlight */}
//         <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_10%,rgba(16,185,129,0.08)_0%,rgba(59,130,246,0.05)_35%,transparent_70%)]" />
//         {/* Floating orbs */}
//         {!shouldReduce && (
//           <>
//             <motion.div
//               initial={{ opacity: 0, scale: 0.95, y: -20 }}
//               animate={{ opacity: 0.35, scale: 1, y: 0 }}
//               transition={{ duration: 1 }}
//               className="absolute -top-40 -right-20 h-[36rem] w-[36rem] rounded-full blur-3xl bg-gradient-to-br from-emerald-500/30 via-cyan-500/25 to-sky-500/10"
//             />
//             <motion.div
//               initial={{ opacity: 0, scale: 0.95, y: 20 }}
//               animate={{ opacity: 0.25, scale: 1, y: 0 }}
//               transition={{ duration: 1.1, delay: 0.1 }}
//               className="absolute -bottom-40 -left-20 h-[30rem] w-[30rem] rounded-full blur-3xl bg-gradient-to-tr from-sky-500/10 via-emerald-500/15 to-amber-400/10"
//             />
//           </>
//         )}
//       </div>

//       <div
//         ref={wrapRef}
//         className="container mx-auto px-4 pt-[88px] md:pt-20 pb-10 md:pb-16"
//       >
//         {/* Durham badge */}
//         <motion.div
//           initial={{ y: 10, opacity: 0 }}
//           animate={{ y: 0, opacity: 1 }}
//           transition={{ duration: 0.6 }}
//           className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
//         >
//           <MapPin className="w-3.5 h-3.5 text-emerald-300" />
//           Durham area • Free two-visit pilot
//         </motion.div>

//         {/* Headline block */}
//         {/* Headline block */}
//         <div className="mt-4 md:mt-6 min-h-[7.5rem] md:min-h-[9.5rem] pb-1 md:pb-2">
//           <AnimatePresence mode="wait">
//             <motion.div
//               key={lines[idx].k}
//               initial={{ opacity: 0, y: 18 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -14 }}
//               transition={{ duration: 0.55 }}
//             >
//               <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black lg:leading-[1.08] md:leading-[1.1] leading-[1.12] text-white">
//                 <span className="block text-slate-100">{lines[idx].pre}</span>
//                 <span
//                   className="block bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-200 bg-clip-text text-transparent inline-block pb-[0.06em]"
//                   style={{ WebkitTextFillColor: "transparent" }}
//                 >
//                   {lines[idx].highlight}
//                 </span>
//               </h1>
//               <p className="mt-3 max-w-2xl text-sm sm:text-base md:text-lg text-slate-300">
//                 {lines[idx].sub}
//               </p>
//             </motion.div>
//           </AnimatePresence>
//         </div>

//         {/* Feature chips */}
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 10 }}
//           transition={{ delay: 0.15 }}
//           className="mt-5 flex flex-wrap gap-2"
//         >
//           {[
//             "Two visits (~10 days)",
//             "Mapping ~60 min",
//             "Live demo 1–2 hrs",
//             "Works on headsets & glasses",
//             "Analytics included",
//           ].map((t) => (
//             <span
//               key={t}
//               className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
//             >
//               {t}
//             </span>
//           ))}
//         </motion.div>

//         {/* CTAs */}
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 10 }}
//           transition={{ delay: 0.25 }}
//           className="mt-6 flex flex-col sm:flex-row gap-3"
//         >
//           <Button
//             onClick={handlePrimary}
//             className="h-12 w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 text-base font-semibold text-white shadow-xl border-0 hover:shadow-2xl hover:scale-[1.02] transition"
//           >
//             Join the Durham Pilot (Free)
//             <ArrowRightIcon className="ml-2 h-5 w-5" />
//           </Button>
//           <Link href="/pilot-program">
//             <Button
//               variant="outline"
//               className="h-12 w-full sm:w-auto rounded-xl border-white/20 px-6 text-base text-slate-800 hover:bg-white/10"
//             >
//               <Sparkles className="mr-2 h-5 w-5 text-emerald-500" />
//               See examples & how it works
//             </Button>
//           </Link>
//         </motion.div>

//         <p className="mt-2 text-xs text-slate-400">
//           Pilot includes one on-site demo window; the AR experience is live
//           during that session only.
//         </p>

//         {/* Scroll cue (desktop) */}
//         <div className="hidden md:block mt-10">
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 0.7 }}
//             transition={{ delay: 0.8, duration: 0.8 }}
//             className="text-xs text-slate-400"
//           >
//             Scroll to see Blueprint in action
//           </motion.div>
//         </div>
//       </div>
//     </section>
//   );
// }

// // ===============================================
// // FILE: src/components/sections/Hero.jsx
// // PURPOSE: Conversion-optimized hero w/ premium motion & reduced-motion guard (JSX)
// // ===============================================

// "use client";
// import React, { useEffect, useRef, useState } from "react";
// import {
//   motion,
//   AnimatePresence,
//   useInView,
//   useReducedMotion,
// } from "framer-motion";
// import { Button } from "@/components/ui/button";
// import { Link } from "wouter";
// import { ArrowRightIcon } from "@heroicons/react/24/solid";
// import { MapPin, Sparkles } from "lucide-react";

// export default function Hero({ onPrimaryCta }) {
//   const lines = [
//     {
//       k: "what",
//       pre: "Blueprint in one line:",
//       highlight:
//         "Turn your space into a guided, interactive AR layer—just by scanning a QR code.",
//       sub: "Guests use their headsets (or smart glasses). No app to install. No hardware to buy.",
//     },
//     {
//       k: "how",
//       pre: "We do the heavy lifting:",
//       highlight:
//         "Map your location → design the content → on-site demo in ~10 days.",
//       sub: "Two short visits from us: Day 1 mapping (~60 min), then a demo 1–2 hrs about a week later.",
//     },
//     {
//       k: "pilot",
//       pre: "Now enrolling in Durham:",
//       highlight: "$0 to try Blueprint at your location.",
//       sub: "Free, feedback-only pilot. Two visits: mapping (~60 min) + demo (1–2 hrs). No contract; no purchase option yet.",
//     },
//   ];

//   const [idx, setIdx] = useState(0);
//   const wrapRef = useRef(null);
//   const inView = useInView(wrapRef, { once: true, margin: "-10% 0px" });
//   const shouldReduce = useReducedMotion();

//   useEffect(() => {
//     if (shouldReduce) return;
//     const id = setInterval(() => setIdx((p) => (p + 1) % lines.length), 6500);
//     return () => {
//       clearInterval(id);
//     };
//   }, [shouldReduce, lines.length]);

//   const handlePrimary = () => {
//     if (typeof onPrimaryCta === "function") onPrimaryCta();
//     const el = document.getElementById("contactForm");
//     if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
//   };

//   return (
//     <section className="relative overflow-hidden bg-[#0B1220]">
//       {/* Background accents */}
//       <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
//         {/* Soft spotlight */}
//         <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_10%,rgba(16,185,129,0.08)_0%,rgba(59,130,246,0.05)_35%,transparent_70%)]" />
//         {/* Floating orbs */}
//         {!shouldReduce && (
//           <>
//             <motion.div
//               initial={{ opacity: 0, scale: 0.95, y: -20 }}
//               animate={{ opacity: 0.35, scale: 1, y: 0 }}
//               transition={{ duration: 1 }}
//               className="absolute -top-40 -right-20 h-[36rem] w-[36rem] rounded-full blur-3xl bg-gradient-to-br from-emerald-500/30 via-cyan-500/25 to-sky-500/10"
//             />
//             <motion.div
//               initial={{ opacity: 0, scale: 0.95, y: 20 }}
//               animate={{ opacity: 0.25, scale: 1, y: 0 }}
//               transition={{ duration: 1.1, delay: 0.1 }}
//               className="absolute -bottom-40 -left-20 h-[30rem] w-[30rem] rounded-full blur-3xl bg-gradient-to-tr from-sky-500/10 via-emerald-500/15 to-amber-400/10"
//             />
//           </>
//         )}
//       </div>

//       <div
//         ref={wrapRef}
//         className="container mx-auto px-4 pt-[88px] md:pt-20 pb-10 md:pb-16"
//       >
//         {/* Durham badge */}
//         <motion.div
//           initial={{ y: 10, opacity: 0 }}
//           animate={{ y: 0, opacity: 1 }}
//           transition={{ duration: 0.6 }}
//           className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
//         >
//           <MapPin className="w-3.5 h-3.5 text-emerald-300" />
//           Durham area • Free two-visit pilot
//         </motion.div>

//         {/* Headline block */}
//         {/* Headline block */}
//         <div className="mt-4 md:mt-6 min-h-[7.5rem] md:min-h-[9.5rem] pb-1 md:pb-2">
//           <AnimatePresence mode="wait">
//             <motion.div
//               key={lines[idx].k}
//               initial={{ opacity: 0, y: 18 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -14 }}
//               transition={{ duration: 0.55 }}
//             >
//               <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black lg:leading-[1.08] md:leading-[1.1] leading-[1.12] text-white">
//                 <span className="block text-slate-100">{lines[idx].pre}</span>
//                 <span
//                   className="block bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-200 bg-clip-text text-transparent inline-block pb-[0.06em]"
//                   style={{ WebkitTextFillColor: "transparent" }}
//                 >
//                   {lines[idx].highlight}
//                 </span>
//               </h1>
//               <p className="mt-3 max-w-2xl text-sm sm:text-base md:text-lg text-slate-300">
//                 {lines[idx].sub}
//               </p>
//             </motion.div>
//           </AnimatePresence>
//         </div>

//         {/* Feature chips */}
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 10 }}
//           transition={{ delay: 0.15 }}
//           className="mt-5 flex flex-wrap gap-2"
//         >
//           {[
//             "Two visits (~10 days)",
//             "Mapping ~60 min",
//             "Live demo 1–2 hrs",
//             "Works on headsets & glasses",
//             "Analytics included",
//           ].map((t) => (
//             <span
//               key={t}
//               className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
//             >
//               {t}
//             </span>
//           ))}
//         </motion.div>

//         {/* CTAs */}
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 10 }}
//           transition={{ delay: 0.25 }}
//           className="mt-6 flex flex-col sm:flex-row gap-3"
//         >
//           <Button
//             onClick={handlePrimary}
//             className="h-12 w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 text-base font-semibold text-white shadow-xl border-0 hover:shadow-2xl hover:scale-[1.02] transition"
//           >
//             Join the Durham Pilot (Free)
//             <ArrowRightIcon className="ml-2 h-5 w-5" />
//           </Button>
//           <Link href="/pilot-program">
//             <Button
//               variant="outline"
//               className="h-12 w-full sm:w-auto rounded-xl border-white/20 px-6 text-base text-slate-800 hover:bg-white/10"
//             >
//               <Sparkles className="mr-2 h-5 w-5 text-emerald-500" />
//               See examples & how it works
//             </Button>
//           </Link>
//         </motion.div>

//         <p className="mt-2 text-xs text-slate-400">
//           Pilot includes one on-site demo window; the AR experience is live
//           during that session only.
//         </p>

//         {/* Scroll cue (desktop) */}
//         <div className="hidden md:block mt-10">
//           <motion.div
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 0.7 }}
//             transition={{ delay: 0.8, duration: 0.8 }}
//             className="text-xs text-slate-400"
//           >
//             Scroll to see Blueprint in action
//           </motion.div>
//         </div>
//       </div>
//     </section>
//   );
// }
