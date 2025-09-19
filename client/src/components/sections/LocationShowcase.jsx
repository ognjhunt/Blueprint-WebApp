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
          "Highlight promos on-shelf",
          "Guide to alternatives",
          "Reduce returns",
        ],
      },
      {
        id: "museum",
        name: "Museum",
        icon: <Landmark className="w-4 h-4" />,
        before: "/images/higgsfieldmuseum.png",
        after: "/images/nano-museum.png",
        benefits: [
          "Make exhibits interactive",
          "Multilingual tours",
          "More dwell time",
        ],
      },
      {
        id: "hotel",
        name: "Hotel",
        icon: <Hotel className="w-4 h-4" />,
        before: "/images/higgsfieldhotel.png",
        after: "/images/nano-banana_hotel.png",
        benefits: [
          "Upsell amenities",
          "Self-guided wayfinding",
          "Delight arrivals",
        ],
      },
      {
        id: "office",
        name: "Showroom/Office",
        icon: <Building2 className="w-4 h-4" />,
        before: "/images/higgsfieldoffice.png",
        after: "/images/nano-banana_workplace.png",
        benefits: [
          "AR product demos",
          "Hands-free explanations",
          "Better presentations",
        ],
      },
      {
        id: "superstore",
        name: "Retail (Superstore)",
        icon: <ShoppingBag className="w-4 h-4" />, // visually distinct from the original Retail
        before: "/images/geminiwalmart.jpeg",
        after: "/images/nano-banana_walmart.png",
        benefits: [
          "Highlight promos on-shelf",
          "Guide to alternatives",
          "Reduce returns",
        ],
      },
      {
        id: "grocery",
        name: "Grocery",
        icon: <Carrot className="w-4 h-4" />,
        before: "/images/higgsfieldgrocery2.png",
        after: "/images/nano-banana_grocery.png",
        benefits: [
          "Aisle-by-aisle guidance",
          "Nutrition & allergens",
          "Deals & smart swaps",
        ],
      },

      {
        id: "realestate",
        name: "Real Estate",
        icon: <MapPin className="w-4 h-4" />,
        before: "/images/higgsfieldhome.png",
        after: "/images/nano-banana_realestate.png",
        benefits: [
          "Virtual staging",
          "Interactive floor plans",
          "Remote walkthroughs",
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
      images.forEach(img => {
        img.src = '';
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
            Scrub to compare before/after — how visitors experience your space
            with AR overlays, guidance, and bite-size info.
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
            Join the Durham Pilot — Free Setup
          </Button>
        </div>
      </div>
    </section>
  );
}

// // This file defines the LocationShowcase component, which displays a showcase of different locations
// // and how AR technology can be applied to them. It allows users to select different locations
// // and see "before" and "after" images or videos demonstrating the AR enhancements.

// import { useState, useEffect } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Sparkles,
//   ArrowRight,
//   Eye,
//   Star,
//   ShoppingCart,
//   Building,
//   MapPin,
//   Camera,
// } from "lucide-react";

// export function useImagePreloader(imageUrls) {
//   const [loadedImages, setLoadedImages] = useState(new Set());
//   const [allLoaded, setAllLoaded] = useState(false);

//   useEffect(() => {
//     const imagePromises = imageUrls.map((url) => {
//       return new Promise((resolve, reject) => {
//         const img = new Image();
//         img.onload = () => {
//           setLoadedImages((prev) => new Set([...prev, url]));
//           resolve(url);
//         };
//         img.onerror = reject;
//         img.src = url;
//       });
//     });

//     Promise.all(imagePromises)
//       .then(() => setAllLoaded(true))
//       .catch(console.error);
//   }, [imageUrls]);

//   return { loadedImages, allLoaded };
// }

// /**
//  * Mobile-specific location showcase with compact design and swipe gestures
//  */
// function MobileLocationShowcase({ locations, allImageUrls }) {
//   const [selectedIndex, setSelectedIndex] = useState(0);
//   const [showAfter, setShowAfter] = useState(false);
//   const [touchStart, setTouchStart] = useState(null);
//   const [touchEnd, setTouchEnd] = useState(null);

//   const currentLocation = locations[selectedIndex];

//   // Handle touch events for location swipe
//   const onTouchStart = (e) => {
//     setTouchEnd(null);
//     setTouchStart(e.targetTouches[0].clientX);
//   };

//   const onTouchMove = (e) => {
//     setTouchEnd(e.targetTouches[0].clientX);
//   };

//   const onTouchEnd = () => {
//     if (!touchStart || !touchEnd) return;

//     const distance = touchStart - touchEnd;
//     const isLeftSwipe = distance > 50;
//     const isRightSwipe = distance < -50;

//     if (isLeftSwipe && selectedIndex < locations.length - 1) {
//       setSelectedIndex(selectedIndex + 1);
//       setShowAfter(false); // Reset to before when changing location
//     }
//     if (isRightSwipe && selectedIndex > 0) {
//       setSelectedIndex(selectedIndex - 1);
//       setShowAfter(false); // Reset to before when changing location
//     }
//   };

//   return (
//     <div className="px-4">
//       {/* Compact Header */}
//       <motion.div
//         className="text-center mb-8"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6 }}
//       >
//         <div className="inline-flex items-center gap-2 mb-3 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 py-1.5 px-3 rounded-full text-xs font-semibold border border-indigo-100">
//           <Camera className="w-3 h-3" />
//           AR Across Industries
//         </div>
//         <h2 className="text-2xl md:text-3xl font-black mb-3 text-slate-900">
//           See Blueprint in{" "}
//           <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-transparent bg-clip-text">
//             Action
//           </span>
//         </h2>
//         <p className="text-sm text-slate-600 leading-relaxed">
//           Transform ordinary spaces into extraordinary interactive experiences
//         </p>
//       </motion.div>

//       {/* Horizontal Scrollable Location Tabs */}
//       <motion.div
//         className="relative mb-6"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.1 }}
//       >
//         <div
//           className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
//           onTouchStart={onTouchStart}
//           onTouchMove={onTouchMove}
//           onTouchEnd={onTouchEnd}
//         >
//           {locations.map((location, index) => (
//             <motion.button
//               key={location.id}
//               onClick={() => {
//                 setSelectedIndex(index);
//                 setShowAfter(false);
//               }}
//               className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 border-2 ${
//                 index === selectedIndex
//                   ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-lg"
//                   : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
//               }`}
//               whileTap={{ scale: 0.95 }}
//             >
//               <div className="flex items-center gap-2 whitespace-nowrap">
//                 {location.icon}
//                 <span>{location.name}</span>
//               </div>
//             </motion.button>
//           ))}
//         </div>
//       </motion.div>

//       {/* Compact Benefits */}
//       <motion.div
//         className="flex flex-wrap gap-2 justify-center mb-6"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.2 }}
//       >
//         {currentLocation.benefits.map((benefit, index) => (
//           <motion.div
//             key={benefit}
//             className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-100"
//             initial={{ opacity: 0, scale: 0.8 }}
//             animate={{ opacity: 1, scale: 1 }}
//             transition={{ duration: 0.3, delay: index * 0.1 }}
//           >
//             <Sparkles className="w-3 h-3" />
//             {benefit}
//           </motion.div>
//         ))}
//       </motion.div>

//       {/* Compact Image Comparison */}
//       <motion.div
//         className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl mb-6 cursor-pointer"
//         initial={{ opacity: 0, scale: 0.95 }}
//         whileInView={{ opacity: 1, scale: 1 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.3 }}
//         onClick={() => setShowAfter(!showAfter)}
//       >
//         {/* Before Image */}
//         <motion.div
//           className="absolute inset-0"
//           animate={{ opacity: showAfter ? 0 : 1 }}
//           transition={{ duration: 0.3 }}
//         >
//           <img
//             src={currentLocation.image}
//             alt={currentLocation.name}
//             className="w-full h-full object-cover"
//             loading="eager"
//           />
//           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
//             <div className="absolute bottom-4 left-4 text-white">
//               <div className="flex items-center gap-2 mb-1">
//                 <div className="w-2 h-2 rounded-full bg-red-400"></div>
//                 <span className="text-xs font-semibold uppercase tracking-wider">
//                   Before
//                 </span>
//               </div>
//               <h3 className="text-lg font-bold">Standard Experience</h3>
//             </div>
//           </div>
//         </motion.div>

//         {/* After Image */}
//         <motion.div
//           className="absolute inset-0"
//           animate={{ opacity: showAfter ? 1 : 0 }}
//           transition={{ duration: 0.3 }}
//         >
//           <img
//             src={currentLocation.secondaryImage}
//             alt={`AR-enhanced ${currentLocation.name}`}
//             className="w-full h-full object-cover"
//             loading="lazy"
//           />
//           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
//             <div className="absolute bottom-4 left-4 text-white">
//               <div className="flex items-center gap-2 mb-1">
//                 <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
//                 <span className="text-xs font-semibold uppercase tracking-wider">
//                   With Blueprint
//                 </span>
//               </div>
//               <h3 className="text-lg font-bold">Interactive AR Experience</h3>
//             </div>
//           </div>
//         </motion.div>

//         {/* Compact Toggle */}
//         <motion.div
//           className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg"
//           initial={{ opacity: 0, scale: 0.8 }}
//           animate={{ opacity: 1, scale: 1 }}
//           transition={{ delay: 0.5 }}
//         >
//           <div className="flex items-center gap-2 px-2 py-1">
//             <span
//               className={`text-xs font-medium ${!showAfter ? "text-slate-900" : "text-slate-400"}`}
//             >
//               Before
//             </span>
//             <motion.button
//               className="relative w-8 h-4 bg-slate-200 rounded-full"
//               onClick={() => setShowAfter(!showAfter)}
//               animate={{ backgroundColor: showAfter ? "#6366f1" : "#e2e8f0" }}
//             >
//               <motion.div
//                 className="w-3 h-3 bg-white rounded-full shadow absolute top-0.5"
//                 animate={{ x: showAfter ? 16 : 2 }}
//                 transition={{ type: "spring", stiffness: 300, damping: 30 }}
//               />
//             </motion.button>
//             <span
//               className={`text-xs font-medium ${showAfter ? "text-indigo-600" : "text-slate-400"}`}
//             >
//               AR
//             </span>
//           </div>
//         </motion.div>

//         {/* Tap indicator */}
//         <motion.div
//           className="absolute inset-0 flex items-center justify-center pointer-events-none"
//           initial={{ opacity: 0 }}
//           animate={{ opacity: showAfter ? 0 : 1 }}
//           transition={{ delay: 1 }}
//         >
//           <div className="bg-black/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium">
//             👆 Tap image or toggle to see AR version
//           </div>
//         </motion.div>
//       </motion.div>

//       {/* Navigation dots */}
//       <div className="flex justify-center gap-2 mb-6">
//         {locations.map((_, index) => (
//           <button
//             key={index}
//             onClick={() => {
//               setSelectedIndex(index);
//               setShowAfter(false);
//             }}
//             className={`w-2 h-2 rounded-full transition-all duration-300 ${
//               index === selectedIndex ? "bg-indigo-600 w-4" : "bg-slate-300"
//             }`}
//           />
//         ))}
//       </div>

//       {/* Swipe hint */}
//       {selectedIndex === 0 && (
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 1.5 }}
//           className="text-center mb-6"
//         >
//           <p className="text-xs text-slate-500">
//             👆 Swipe left/right to see more industries
//           </p>
//         </motion.div>
//       )}

//       {/* Compact CTA */}
//       <motion.div
//         className="text-center"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.4 }}
//       >
//         <p className="text-sm text-slate-600 mb-4">
//           Ready to transform your {currentLocation.name.toLowerCase()}?
//         </p>
//         <motion.button
//           className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg text-sm"
//           whileHover={{ scale: 1.05 }}
//           whileTap={{ scale: 0.98 }}
//           onClick={() => {
//             const contactFormElement = document.getElementById("contactForm");
//             if (contactFormElement) {
//               contactFormElement.scrollIntoView({ behavior: "smooth" });
//             }
//           }}
//         >
//           <Sparkles className="w-4 h-4" />
//           Join Pilot Program (FREE)
//           <ArrowRight className="w-4 h-4" />
//         </motion.button>
//       </motion.div>
//     </div>
//   );
// }

// /**
//  * The LocationShowcase component displays a showcase of different locations
//  * and how AR technology can be applied to them.
//  * It allows users to select different locations and see "before" and "after"
//  * images or videos demonstrating the AR enhancements.
//  *
//  * @returns {JSX.Element} The rendered LocationShowcase component.
//  */
// export default function LocationShowcase() {
//   const [selectedLocation, setSelectedLocation] = useState("Grocery Store");
//   const [isHovering, setIsHovering] = useState(null);
//   const [showAfter, setShowAfter] = useState(false);

//   const [groceryIndex, setGroceryIndex] = useState(0);
//   // useEffect(() => {
//   //   if (selectedLocation === "Grocery Store") {
//   //     const interval = setInterval(() => {
//   //       setGroceryIndex((prev) => (prev + 1) % 2);
//   //     }, 4000);
//   //     return () => clearInterval(interval);
//   //   }
//   // }, [selectedLocation]);

//   const groceryBeforeImages = [
//     "/images/higgsfieldgrocery.png",
//     "/images/higgsfieldgrocery.png",
//   ];

//   const groceryAfterImages = [
//     "/images/higgsfieldgrocery2.png",
//     "/images/higgsfieldgrocery2.png",
//   ];

//   // Enhanced location data with more compelling descriptions and metrics
//   const LOCATIONS = [
//     {
//       id: "grocery",
//       name: "Grocery Store",
//       category: "Retail",
//       image: "/images/higgsfieldgrocery.png",
//       secondaryImage: "/images/higgsfieldgrocery2.png",
//       description:
//         "Turn shopping into an interactive experience with AR product information, nutritional details, and personalized recommendations.",
//       benefits: [
//         "200% increase in engagement",
//         "Reduced checkout time",
//         "Enhanced product discovery",
//       ],
//       icon: <ShoppingCart className="w-5 h-5" />,
//     },
//     {
//       id: "retail",
//       name: "Retail Store",
//       category: "Commerce",
//       image: "/images/higgsfieldapple.png",
//       secondaryImage: "/images/higgsfieldwalmart2.png",
//       description:
//         "Create immersive try-before-you-buy experiences with virtual product demonstrations and interactive catalogs.",
//       benefits: [
//         "50% fewer returns",
//         "Higher conversion rates",
//         "Extended dwell time",
//       ],
//       icon: <Building className="w-5 h-5" />,
//     },
//     {
//       id: "hotel",
//       name: "Hotel",
//       category: "Hospitality",
//       image: "/images/higgsfieldhotel.png",
//       secondaryImage: "/images/higgsfieldhotel.png",
//       description:
//         "Elevate guest experiences with interactive room tours, amenity guides, and personalized concierge services.",
//       benefits: [
//         "Higher guest satisfaction",
//         "Streamlined check-in",
//         "Increased upselling",
//       ],
//       icon: <Building className="w-5 h-5" />,
//     },
//     {
//       id: "museum",
//       name: "Museum",
//       category: "Culture",
//       image: "/images/higgsfieldmuseum.png",
//       secondaryImage: "/images/higgsfieldmuseum.png",
//       description:
//         "Bring exhibits to life with immersive storytelling, interactive timelines, and augmented historical content.",
//       benefits: [
//         "Deeper visitor engagement",
//         "Educational enhancement",
//         "Multilingual support",
//       ],
//       icon: <Eye className="w-5 h-5" />,
//     },
//     {
//       id: "office",
//       name: "Office",
//       category: "Corporate",
//       image: "/images/higgsfieldoffice.png",
//       secondaryImage: "/images/geminiwalmart.jpeg",
//       description:
//         "Transform workspaces with AR-powered collaboration tools, interactive presentations, and virtual meeting spaces.",
//       benefits: [
//         "Enhanced collaboration",
//         "Remote integration",
//         "Improved presentations",
//       ],
//       icon: <Building className="w-5 h-5" />,
//     },
//     {
//       id: "apartment",
//       name: "Real Estate",
//       category: "Property",
//       image: "/images/higgsfieldhome.png",
//       secondaryImage: "/images/higgsfieldrealestate2.png",
//       description:
//         "Revolutionize property tours with AR staging, virtual furniture placement, and interactive floor plans.",
//       benefits: ["Faster sales cycles", "Virtual staging", "Remote viewings"],
//       icon: <MapPin className="w-5 h-5" />,
//     },
//   ];

//   // Collect all image URLs for preloading
//   const allImageUrls = [
//     ...groceryBeforeImages,
//     ...groceryAfterImages,
//     ...LOCATIONS.flatMap((loc) => [loc.image, loc.secondaryImage]),
//   ];

//   const { allLoaded } = useImagePreloader(allImageUrls);

//   const currentLocation =
//     LOCATIONS.find((loc) => loc.name === selectedLocation) || LOCATIONS[0];

//   return (
//     <section className="py-20 md:py-28 relative overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-white">
//       {/* Enhanced background elements */}
//       <motion.div
//         className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50/60 via-transparent to-violet-50/40 pointer-events-none"
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         transition={{ duration: 2 }}
//       />

//       {/* MOBILE VERSION */}
//       <div className="block md:hidden">
//         <MobileLocationShowcase
//           locations={LOCATIONS}
//           allImageUrls={allImageUrls}
//         />
//       </div>

//       {/* DESKTOP VERSION */}
//       <div className="hidden md:block">
//         <div className="container mx-auto px-6">
//           {/* Enhanced header section */}
//           <motion.div
//             className="text-center mb-20"
//             initial={{ opacity: 0, y: 40 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.2 }}
//             transition={{ duration: 0.8 }}
//           >
//             <div className="inline-flex items-center gap-2 mb-6 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 py-2 px-4 rounded-full text-sm font-semibold border border-indigo-100">
//               <Camera className="w-4 h-4" />
//               Use Cases for Different Industries
//             </div>
//             <h2 className="text-4xl md:text-5xl font-black mb-6 text-slate-900">
//               See Blueprint in Action Across{" "}
//               <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-transparent bg-clip-text">
//                 Every Industry
//               </span>
//             </h2>
//             <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
//               From retail to hospitality, our AR technology transforms ordinary
//               spaces into extraordinary interactive experiences that captivate
//               customers and drive results.
//             </p>
//           </motion.div>

//           {/* Enhanced location selector */}
//           <motion.div
//             className="flex flex-wrap justify-center gap-3 mb-16"
//             initial={{ opacity: 0, y: 30 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true, amount: 0.6 }}
//             transition={{ duration: 0.8, delay: 0.2 }}
//           >
//             {LOCATIONS.map((location) => (
//               <motion.button
//                 key={location.id}
//                 onClick={() => setSelectedLocation(location.name)}
//                 onMouseEnter={() => setIsHovering(location.id)}
//                 onMouseLeave={() => setIsHovering(null)}
//                 className={`group relative px-6 py-3 rounded-2xl transition-all duration-300 font-semibold text-sm border-2 overflow-hidden
//                   ${
//                     selectedLocation === location.name
//                       ? "text-white-600 hover:text-indigo-600 border-slate-200 hover:border-indigo-200 bg-white/80 backdrop-blur-sm hover:shadow-lg"
//                       : "text-slate-600 hover:text-indigo-600 border-slate-200 hover:border-indigo-200 bg-white/80 backdrop-blur-sm hover:shadow-lg"
//                   }
//                 `}
//                 whileHover={{ scale: 1.05 }}
//                 whileTap={{ scale: 0.98 }}
//               >
//                 {selectedLocation === location.name && (
//                   <motion.div
//                     className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 -z-10"
//                     layoutId="activeLocationBackground"
//                     initial={false}
//                     transition={{
//                       type: "spring",
//                       stiffness: 300,
//                       damping: 30,
//                     }}
//                   />
//                 )}
//                 <div className="flex items-center gap-2 relative z-10">
//                   {location.icon}
//                   <span>{location.name}</span>
//                 </div>
//                 {selectedLocation !== location.name && (
//                   <span className="text-xs text-slate-400 block mt-1">
//                     {location.category}
//                   </span>
//                 )}
//               </motion.button>
//             ))}
//           </motion.div>

//           <div className="relative max-w-4xl mx-auto">
//             {/* Benefits section */}
//             <motion.div
//               className="mt-12 flex flex-wrap justify-center gap-6 max-w-4xl mx-auto mb-12"
//               initial={{ opacity: 0, y: 30 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ duration: 0.8, delay: 0.4 }}
//             >
//               {currentLocation.benefits.map((benefit, index) => (
//                 <motion.div
//                   key={benefit}
//                   className="flex items-center gap-2 text-slate-700"
//                   initial={{ opacity: 0, y: 20 }}
//                   whileInView={{ opacity: 1, y: 0 }}
//                   viewport={{ once: true }}
//                   transition={{ duration: 0.6, delay: index * 0.1 }}
//                 >
//                   <div className="w-6 h-6 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
//                     <Sparkles className="w-3 h-3 text-white" />
//                   </div>
//                   <span className="font-semibold text-sm">{benefit}</span>
//                 </motion.div>
//               ))}
//             </motion.div>

//             <AnimatePresence mode="wait">
//               <motion.div
//                 key={selectedLocation}
//                 className="relative aspect-[16/9] rounded-3xl overflow-hidden shadow-2xl cursor-pointer"
//                 initial={{ opacity: 0 }}
//                 animate={{ opacity: 1 }}
//                 exit={{ opacity: 0 }}
//                 transition={{ duration: 0.3 }}
//                 onClick={() => setShowAfter(!showAfter)} // Tap to toggle on mobile
//               >
//                 {/* Before Image */}
//                 <motion.div
//                   className="absolute inset-0"
//                   animate={{ opacity: showAfter ? 0 : 1 }}
//                   transition={{ duration: 0.3 }}
//                 >
//                   <img
//                     src={
//                       selectedLocation === "Grocery Store"
//                         ? groceryBeforeImages[groceryIndex]
//                         : currentLocation.image
//                     }
//                     alt={currentLocation.name}
//                     className="w-full h-full object-cover"
//                     loading="eager" // Changed from "lazy"
//                     fetchPriority="high" // Added for faster loading
//                     decoding="async" // Added for better performance
//                   />
//                   <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
//                     <div className="absolute bottom-6 left-6 text-white">
//                       <div className="flex items-center gap-2 mb-2">
//                         <div className="w-3 h-3 rounded-full bg-red-400"></div>
//                         <span className="text-sm font-semibold uppercase tracking-wider">
//                           Before
//                         </span>
//                       </div>
//                       <h3 className="text-xl md:text-3xl font-bold mb-2">
//                         Standard Experience
//                       </h3>
//                     </div>
//                   </div>
//                 </motion.div>

//                 {/* After Image */}
//                 <motion.div
//                   className="absolute inset-0"
//                   animate={{ opacity: showAfter ? 1 : 0 }}
//                   transition={{ duration: 0.3 }}
//                 >
//                   <img
//                     src={
//                       selectedLocation === "Grocery Store"
//                         ? groceryAfterImages[groceryIndex]
//                         : currentLocation.secondaryImage
//                     }
//                     alt={`AR-enhanced ${currentLocation.name}`}
//                     className="w-full h-full object-cover"
//                     loading="lazy"
//                   />
//                   <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
//                     <div className="absolute bottom-6 left-6 text-white">
//                       <div className="flex items-center gap-2 mb-2">
//                         <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
//                         <span className="text-sm font-semibold uppercase tracking-wider">
//                           After Blueprint
//                         </span>
//                       </div>
//                       <h3 className="text-xl md:text-3xl font-bold mb-2">
//                         Interactive AR Experience
//                       </h3>
//                     </div>
//                   </div>
//                   {/* Keep your AR overlay elements here */}
//                 </motion.div>

//                 {/* Slider toggle at bottom of image */}
//                 <motion.div
//                   className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-xl border border-slate-200"
//                   initial={{ opacity: 0, y: 20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   transition={{ delay: 0.8 }}
//                 >
//                   <div className="flex items-center gap-4 px-4 py-2">
//                     <span
//                       className={`text-sm font-medium transition-colors ${!showAfter ? "text-slate-900" : "text-slate-400"}`}
//                     >
//                       Before
//                     </span>
//                     <motion.button
//                       className="relative w-12 h-6 bg-slate-200 rounded-full p-1 cursor-pointer"
//                       onClick={() => setShowAfter(!showAfter)}
//                       animate={{
//                         backgroundColor: showAfter ? "#6366f1" : "#e2e8f0",
//                       }}
//                     >
//                       <motion.div
//                         className="w-4 h-4 bg-white rounded-full shadow"
//                         animate={{ x: showAfter ? 24 : 0 }}
//                         transition={{
//                           type: "spring",
//                           stiffness: 300,
//                           damping: 30,
//                         }}
//                       />
//                     </motion.button>
//                     <span
//                       className={`text-sm font-medium transition-colors ${showAfter ? "text-indigo-600" : "text-slate-400"}`}
//                     >
//                       With AR
//                     </span>
//                   </div>
//                 </motion.div>
//               </motion.div>
//             </AnimatePresence>

//             {/* Call to action */}
//             <motion.div
//               className="text-center mt-16"
//               initial={{ opacity: 0, y: 20 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ duration: 0.6, delay: 0.6 }}
//             >
//               <p className="text-lg text-slate-600 mb-6">
//                 Ready to transform your space like these examples?
//               </p>
//               <motion.button
//                 className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
//                 whileHover={{ scale: 1.05 }}
//                 whileTap={{ scale: 0.98 }}
//                 onClick={() => {
//                   const contactFormElement =
//                     document.getElementById("contactForm");
//                   if (contactFormElement) {
//                     contactFormElement.scrollIntoView({ behavior: "smooth" });
//                   }
//                 }}
//               >
//                 <Sparkles className="w-5 h-5" />
//                 Join Pilot Program (FREE)
//                 <ArrowRight className="w-5 h-5" />
//               </motion.button>
//             </motion.div>
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }
