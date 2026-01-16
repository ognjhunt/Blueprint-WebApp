// ===============================================
// FILE: src/components/sections/LocationShowcase.tsx
// PURPOSE: High-impact showcase with tabs + pro before/after scrub slider
// - Image preloading for current/next
// - Mobile horizontal tabs, desktop pill tabs
// - CTA anchors to contactForm
// ===============================================

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Building2,
  Landmark,
  ShoppingCart,
  ShoppingBag, // ← NEW (Superstore)
  Carrot, // ← NEW (Grocery)
  Hotel,
  Images,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// type Loc = {
//   id: string;
//   name: string;
//   icon: React.ReactNode;
//   before: string;
//   after: string;
//   benefits: string[];
// };

export default function LocationShowcase() {
  const locations = useMemo(
    () => [
      {
        id: "retail",
        name: "Retail",
        icon: <ShoppingCart className="w-4 h-4" />,
        before: "/images/higgsfieldapple.png",
        after: "/images/nano-banana_apple.png", //higgsfieldwalmart2.png
        benefits: [
          "AI shelf guidance for shoppers",
          "Surface promos in view",
          "Reduce returns with smart suggestions",
        ],
      },
      {
        id: "museum",
        name: "Museum",
        icon: <Landmark className="w-4 h-4" />,
        before: "/images/higgsfieldmuseum.png",
        after: "/images/nano-museum.png",
        benefits: [
          "AI narration triggered by exhibits",
          "Instant multilingual explanations",
          "Increase dwell time with stories",
        ],
      },
      {
        id: "hotel",
        name: "Hotel",
        icon: <Hotel className="w-4 h-4" />,
        before: "/images/higgsfieldhotel.png",
        after: "/images/nano-banana_hotel.png",
        benefits: [
          "Upsell amenities with AI prompts",
          "Hands-free wayfinding",
          "Delight arrivals with tailored greetings",
        ],
      },
      {
        id: "office",
        name: "Showroom/Office",
        icon: <Building2 className="w-4 h-4" />,
        before: "/images/higgsfieldoffice.png",
        after: "/images/nano-banana_workplace.png",
        benefits: [
          "Hands-free product explanations",
          "AI-assisted walkthroughs",
          "Interactive client briefings",
        ],
      },
      {
        id: "superstore",
        name: "Retail (Superstore)",
        icon: <ShoppingBag className="w-4 h-4" />, // visually distinct from the original Retail
        before: "/images/geminiwalmart.jpeg",
        after: "/images/nano-banana_walmart.png",
        benefits: [
          "AI aisle navigation for teams",
          "Promotions appear in-view",
          "Lift basket size with smart swaps",
        ],
      },
      {
        id: "grocery",
        name: "Grocery",
        icon: <Carrot className="w-4 h-4" />,
        before: "/images/higgsfieldgrocery2.png",
        after: "/images/nano-banana_grocery.png",
        benefits: [
          "Aisle-by-aisle AI navigation",
          "Nutrition & allergen callouts",
          "Personalized deals & smart swaps",
        ],
      },

      {
        id: "realestate",
        name: "Real Estate",
        icon: <MapPin className="w-4 h-4" />,
        before: "/images/higgsfieldhome.png",
        after: "/images/nano-banana_realestate.png",
        benefits: [
          "AI-staged property walkthroughs",
          "Ask questions room by room",
          "Remote co-touring support",
        ],
      }, //need to add: Walmart2 & grocery store
    ],
    [],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const active = locations[activeIndex];
  const [slider, setSlider] = useState(50); // 0-100
  const shouldReduce = useReducedMotion();

  // Preload active + next images
  useEffect(() => {
    const images = [];

    const preload = (src) => {
      const img = new Image();
      img.src = src;
      images.push(img);
      return img;
    };

    preload(active.before);
    preload(active.after);
    const next = locations[(activeIndex + 1) % locations.length];
    preload(next.before);
    preload(next.after);

    // Cleanup function to abort loading if component unmounts
    return () => {
      images.forEach((img) => {
        img.src = "";
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [active, activeIndex, locations]);

  const scrollToContact = () => {
    const el = document.getElementById("contactForm");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="locationShowcase" className="bg-[#0E172A] py-14">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200">
            <Images className="w-4 h-4 text-cyan-300" /> Use-cases across
            industries
          </div>
          <h2 className="mt-3 text-2xl md:text-4xl font-black text-white">
            See Blueprint{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-200 bg-clip-text text-transparent">
              in action
            </span>
          </h2>
          <p className="mt-2 text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
            Scrub to compare before/after to see how visitors experience your space
            with AI overlays, guidance, and bite-size info.
          </p>
        </div>

        {/* Tabs */}
        <div className="md:hidden -mx-4 overflow-x-auto no-scrollbar mb-4">
          <div className="flex w-max gap-2 px-4">
            {locations.map((loc, i) => (
              <button
                key={loc.id}
                onClick={() => {
                  setActiveIndex(i);
                  setSlider(50);
                }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold flex items-center gap-2 ${
                  active.id === loc.id
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-200"
                }`}
              >
                {loc.icon}
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center justify-center gap-2 mb-6">
          {locations.map((loc, i) => (
            <button
              key={loc.id}
              onClick={() => {
                setActiveIndex(i);
                setSlider(50);
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
                active.id === loc.id
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {loc.icon}
              {loc.name}
            </button>
          ))}
        </div>

        {/* Benefits */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-6">
          {active.benefits.map((b) => (
            <span
              key={b}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
            >
              <Sparkles className="mr-1 inline-block h-3.5 w-3.5 text-emerald-300" />{" "}
              {b}
            </span>
          ))}
        </div>

        {/* Pro Before/After Scrub Slider */}
        <div className="mx-auto max-w-5xl">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/10 bg-black select-none"
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();

              // Jump instantly on click
              const x = e.clientX - rect.left;
              setSlider(Math.min(100, Math.max(0, (x / rect.width) * 100)));

              // Start dragging
              const move = (ev) => {
                const moveX = ev.clientX - rect.left;
                setSlider(
                  Math.min(100, Math.max(0, (moveX / rect.width) * 100)),
                );
              };
              const up = () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
              };
              window.addEventListener("mousemove", move);
              window.addEventListener("mouseup", up);
            }}
            onTouchStart={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();

              // Jump instantly on tap
              const x = e.touches[0].clientX - rect.left;
              setSlider(Math.min(100, Math.max(0, (x / rect.width) * 100)));

              // Start dragging
              const move = (ev) => {
                const moveX = ev.touches[0].clientX - rect.left;
                setSlider(
                  Math.min(100, Math.max(0, (moveX / rect.width) * 100)),
                );
              };
              const end = () => {
                window.removeEventListener("touchmove", move);
                window.removeEventListener("touchend", end);
              };
              window.addEventListener("touchmove", move);
              window.addEventListener("touchend", end);
            }}
          >
            {/* Before */}
            <img
              src={active.before}
              alt={`${active.name} (before)`}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* After clipped */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
            >
              <img
                src={active.after}
                alt={`${active.name} (after)`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>

            {/* Labels */}
            <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
              Before
            </div>
            <div className="absolute right-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
              With Blueprint
            </div>

            {/* Handle */}
            <div
              className="absolute top-0 bottom-0"
              style={{ left: `${slider}%`, transform: "translateX(-50%)" }}
            >
              <div className="h-full w-[2px] bg-white/70 mix-blend-overlay" />
              <div className="absolute top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 border border-white/40 shadow-lg backdrop-blur-md grid place-items-center">
                <div className="h-1.5 w-5 rounded-full bg-slate-700" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Button
            onClick={scrollToContact}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-0 h-12 px-6 hover:shadow-2xl hover:scale-[1.02] transition"
          >
            Join the AI glasses pilot, free setup
          </Button>
        </div>
      </div>
    </section>
  );
}

// // ===============================================
// // FILE: src/components/sections/LocationShowcase.tsx
// // PURPOSE: High-impact showcase with tabs + pro before/after scrub slider
// // - Image preloading for current/next
// // - Mobile horizontal tabs, desktop pill tabs
// // - CTA anchors to contactForm
// // ===============================================

// import React, { useEffect, useMemo, useState } from "react";
// import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
// import {
//   Sparkles,
//   Building2,
//   Landmark,
//   ShoppingCart,
//   ShoppingBag, // ← NEW (Superstore)
//   Carrot, // ← NEW (Grocery)
//   Hotel,
//   Images,
//   MapPin,
// } from "lucide-react";
// import { Button } from "@/components/ui/button";

// // type Loc = {
// //   id: string;
// //   name: string;
// //   icon: React.ReactNode;
// //   before: string;
// //   after: string;
// //   benefits: string[];
// // };

// export default function LocationShowcase() {
//   const locations = useMemo(
//     () => [
//       {
//         id: "retail",
//         name: "Retail",
//         icon: <ShoppingCart className="w-4 h-4" />,
//         before: "/images/higgsfieldapple.png",
//         after: "/images/nano-banana_apple.png", //higgsfieldwalmart2.png
//         benefits: [
//           "Highlight promos on-shelf",
//           "Guide to alternatives",
//           "Reduce returns",
//         ],
//       },
//       {
//         id: "museum",
//         name: "Museum",
//         icon: <Landmark className="w-4 h-4" />,
//         before: "/images/higgsfieldmuseum.png",
//         after: "/images/nano-museum.png",
//         benefits: [
//           "Make exhibits interactive",
//           "Multilingual tours",
//           "More dwell time",
//         ],
//       },
//       {
//         id: "hotel",
//         name: "Hotel",
//         icon: <Hotel className="w-4 h-4" />,
//         before: "/images/higgsfieldhotel.png",
//         after: "/images/nano-banana_hotel.png",
//         benefits: [
//           "Upsell amenities",
//           "Self-guided wayfinding",
//           "Delight arrivals",
//         ],
//       },
//       {
//         id: "office",
//         name: "Showroom/Office",
//         icon: <Building2 className="w-4 h-4" />,
//         before: "/images/higgsfieldoffice.png",
//         after: "/images/nano-banana_workplace.png",
//         benefits: [
//           "AR product demos",
//           "Hands-free explanations",
//           "Better presentations",
//         ],
//       },
//       {
//         id: "superstore",
//         name: "Retail (Superstore)",
//         icon: <ShoppingBag className="w-4 h-4" />, // visually distinct from the original Retail
//         before: "/images/geminiwalmart.jpeg",
//         after: "/images/nano-banana_walmart.png",
//         benefits: [
//           "Highlight promos on-shelf",
//           "Guide to alternatives",
//           "Reduce returns",
//         ],
//       },
//       {
//         id: "grocery",
//         name: "Grocery",
//         icon: <Carrot className="w-4 h-4" />,
//         before: "/images/higgsfieldgrocery2.png",
//         after: "/images/nano-banana_grocery.png",
//         benefits: [
//           "Aisle-by-aisle guidance",
//           "Nutrition & allergens",
//           "Deals & smart swaps",
//         ],
//       },

//       {
//         id: "realestate",
//         name: "Real Estate",
//         icon: <MapPin className="w-4 h-4" />,
//         before: "/images/higgsfieldhome.png",
//         after: "/images/nano-banana_realestate.png",
//         benefits: [
//           "Virtual staging",
//           "Interactive floor plans",
//           "Remote walkthroughs",
//         ],
//       }, //need to add: Walmart2 & grocery store
//     ],
//     [],
//   );

//   const [activeIndex, setActiveIndex] = useState(0);
//   const active = locations[activeIndex];
//   const [slider, setSlider] = useState(50); // 0-100
//   const shouldReduce = useReducedMotion();

//   // Preload active + next images
//   useEffect(() => {
//     const images = [];

//     const preload = (src) => {
//       const img = new Image();
//       img.src = src;
//       images.push(img);
//       return img;
//     };

//     preload(active.before);
//     preload(active.after);
//     const next = locations[(activeIndex + 1) % locations.length];
//     preload(next.before);
//     preload(next.after);

//     // Cleanup function to abort loading if component unmounts
//     return () => {
//       images.forEach(img => {
//         img.src = '';
//         img.onload = null;
//         img.onerror = null;
//       });
//     };
//   }, [active, activeIndex, locations]);

//   const scrollToContact = () => {
//     const el = document.getElementById("contactForm");
//     if (el) el.scrollIntoView({ behavior: "smooth" });
//   };

//   return (
//     <section id="locationShowcase" className="bg-[#0E172A] py-14">
//       <div className="container mx-auto px-4">
//         {/* Section header */}
//         <div className="text-center mb-8 md:mb-12">
//           <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200">
//             <Images className="w-4 h-4 text-cyan-300" /> Use-cases across
//             industries
//           </div>
//           <h2 className="mt-3 text-2xl md:text-4xl font-black text-white">
//             See Blueprint{" "}
//             <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-200 bg-clip-text text-transparent">
//               in action
//             </span>
//           </h2>
//           <p className="mt-2 text-slate-300 max-w-2xl mx-auto text-sm md:text-base">
//             Scrub to compare before/after to see how visitors experience your space
//             with AR overlays, guidance, and bite-size info.
//           </p>
//         </div>

//         {/* Tabs */}
//         <div className="md:hidden -mx-4 overflow-x-auto no-scrollbar mb-4">
//           <div className="flex w-max gap-2 px-4">
//             {locations.map((loc, i) => (
//               <button
//                 key={loc.id}
//                 onClick={() => {
//                   setActiveIndex(i);
//                   setSlider(50);
//                 }}
//                 className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold flex items-center gap-2 ${
//                   active.id === loc.id
//                     ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
//                     : "border-white/10 bg-white/5 text-slate-200"
//                 }`}
//               >
//                 {loc.icon}
//                 {loc.name}
//               </button>
//             ))}
//           </div>
//         </div>

//         <div className="hidden md:flex items-center justify-center gap-2 mb-6">
//           {locations.map((loc, i) => (
//             <button
//               key={loc.id}
//               onClick={() => {
//                 setActiveIndex(i);
//                 setSlider(50);
//               }}
//               className={`rounded-xl border px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
//                 active.id === loc.id
//                   ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
//                   : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
//               }`}
//             >
//               {loc.icon}
//               {loc.name}
//             </button>
//           ))}
//         </div>

//         {/* Benefits */}
//         <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-6">
//           {active.benefits.map((b) => (
//             <span
//               key={b}
//               className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs md:text-sm text-slate-200"
//             >
//               <Sparkles className="mr-1 inline-block h-3.5 w-3.5 text-emerald-300" />{" "}
//               {b}
//             </span>
//           ))}
//         </div>

//         {/* Pro Before/After Scrub Slider */}
//         <div className="mx-auto max-w-5xl">
//           <motion.div
//             key={active.id}
//             initial={{ opacity: 0, y: 8 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.35 }}
//             className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/10 bg-black select-none"
//             onMouseDown={(e) => {
//               const rect = e.currentTarget.getBoundingClientRect();

//               // Jump instantly on click
//               const x = e.clientX - rect.left;
//               setSlider(Math.min(100, Math.max(0, (x / rect.width) * 100)));

//               // Start dragging
//               const move = (ev) => {
//                 const moveX = ev.clientX - rect.left;
//                 setSlider(
//                   Math.min(100, Math.max(0, (moveX / rect.width) * 100)),
//                 );
//               };
//               const up = () => {
//                 window.removeEventListener("mousemove", move);
//                 window.removeEventListener("mouseup", up);
//               };
//               window.addEventListener("mousemove", move);
//               window.addEventListener("mouseup", up);
//             }}
//             onTouchStart={(e) => {
//               const rect = e.currentTarget.getBoundingClientRect();

//               // Jump instantly on tap
//               const x = e.touches[0].clientX - rect.left;
//               setSlider(Math.min(100, Math.max(0, (x / rect.width) * 100)));

//               // Start dragging
//               const move = (ev) => {
//                 const moveX = ev.touches[0].clientX - rect.left;
//                 setSlider(
//                   Math.min(100, Math.max(0, (moveX / rect.width) * 100)),
//                 );
//               };
//               const end = () => {
//                 window.removeEventListener("touchmove", move);
//                 window.removeEventListener("touchend", end);
//               };
//               window.addEventListener("touchmove", move);
//               window.addEventListener("touchend", end);
//             }}
//           >
//             {/* Before */}
//             <img
//               src={active.before}
//               alt={`${active.name} (before)`}
//               className="absolute inset-0 h-full w-full object-cover"
//             />

//             {/* After clipped */}
//             <div
//               className="absolute inset-0"
//               style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
//             >
//               <img
//                 src={active.after}
//                 alt={`${active.name} (after)`}
//                 className="absolute inset-0 h-full w-full object-cover"
//               />
//             </div>

//             {/* Labels */}
//             <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
//               Before
//             </div>
//             <div className="absolute right-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
//               With Blueprint
//             </div>

//             {/* Handle */}
//             <div
//               className="absolute top-0 bottom-0"
//               style={{ left: `${slider}%`, transform: "translateX(-50%)" }}
//             >
//               <div className="h-full w-[2px] bg-white/70 mix-blend-overlay" />
//               <div className="absolute top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 border border-white/40 shadow-lg backdrop-blur-md grid place-items-center">
//                 <div className="h-1.5 w-5 rounded-full bg-slate-700" />
//               </div>
//             </div>
//           </motion.div>
//         </div>

//         {/* CTA */}
//         <div className="mt-8 text-center">
//           <Button
//             onClick={scrollToContact}
//             className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white border-0 h-12 px-6 hover:shadow-2xl hover:scale-[1.02] transition"
//           >
//             Join the Durham Pilot, free setup
//           </Button>
//         </div>
//       </div>
//     </section>
//   );
// }
