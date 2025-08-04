"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Link } from "wouter";
import { PlayIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { Info, Sparkles, Zap, Eye } from "lucide-react";

/**
 * The Hero component is the main hero section for the landing page.
 * It displays a rotating headline, a short description, and call-to-action buttons.
 * It also includes some visual elements like background gradients and patterns.
 *
 * @returns {JSX.Element} The rendered Hero component.
 */
export default function Hero() {
  const headlines = [
    {
      text: "Turn Any Space Into an",
      highlight: "Interactive AR Experience",
      description:
        "Transform your business location into an immersive digital playground that captivates customers and drives engagement—no app downloads required.",
    },
    {
      text: "Boost Engagement 200%",
      highlight: "with Blueprint",
      description:
        "Create memorable experiences that work instantly in any browser. From product demos to virtual tours, engage customers like never before.", //smart glasses
    },
    {
      text: "Customized In-Person UX",
      highlight: "For The Spatial Age",
      description:
        "Join industry leaders who are already transforming customer experiences with our cutting-edge spatial computing technology.",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const heroRef = useRef(null);
  const isInView = useInView(heroRef, { once: true });

  /**
   * Scrolls the page to the contact form section smoothly.
   */
  const handleScrollToContactForm = () => {
    const contactFormElement = document.getElementById("contactForm");
    if (contactFormElement) {
      contactFormElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const industryTypes = [
    { icon: "🏪", name: "Retail" },
    { icon: "🏛️", name: "Museum" },
    { icon: "🎨", name: "Gallery" },
    { icon: "🏢", name: "Showroom" },
    { icon: "🏨", name: "Hospitality" },
  ];

  const businessRoles = [
    "Sarah Chen", // Retail Manager
    "Marcus Johnson", // Museum Director
    "Elena Rodriguez", // Gallery Owner
    "David Kim", // Store Manager
    "Amanda Foster", // Experience Director
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [headlines.length]);

  const features = [
    {
      icon: <Zap className="w-4 h-4 sm:w-5 sm:h-5" />,
      text: "No App Required",
    },
    {
      icon: <Eye className="w-4 h-4 sm:w-5 sm:h-5" />,
      text: "Works on All Hardware", //Glasses
    },
    {
      icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />,
      text: "Ready in under 24 Hours",
    },
  ];

  return (
    <section
      ref={heroRef}
      className="relative min-h-[85vh] sm:min-h-[95vh] flex items-center justify-center pt-8 sm:pt-24 pb-12 sm:pb-16 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/30"
    >
      {/* Enhanced background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-100/40 via-violet-100/30 to-fuchsia-100/20 blur-3xl" />
        <motion.div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-100/30 via-cyan-100/20 to-emerald-100/10 blur-3xl" />
      </div>

      {/* Floating grid pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='rgb(99 102 241 / 0.03)' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 relative z-20">
        <div className="max-w-4xl mx-auto text-center">
          <div>
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 mb-4 sm:mb-6 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 py-2 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-semibold tracking-wide border border-indigo-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.6 }}
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
              Next-Gen AR Technology Platform
            </motion.div>

            {/* Main headline container - reduced min-height for smaller screens */}
            <div className="min-h-[100px] sm:min-h-[140px] md:min-h-[180px] lg:min-h-[220px] mb-4 sm:mb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  className="w-full"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.8 }}
                >
                  {/* Reduced text sizes for better mobile fit */}
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black mb-3 sm:mb-4 md:mb-6 leading-tight">
                    <span className="text-slate-900 block">
                      {headlines[currentIndex].text}
                    </span>
                    <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-transparent bg-clip-text block">
                      {headlines[currentIndex].highlight}
                    </span>
                  </h1>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-2 sm:px-4 md:px-0">
                    {headlines[currentIndex].description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Feature badges - 2x2 grid on mobile, flex on larger screens */}
            <motion.div
              className="grid grid-cols-2 gap-2 justify-items-center mb-6 sm:flex sm:flex-wrap sm:justify-center sm:gap-3 px-2 sm:px-0 max-w-lg mx-auto sm:max-w-none"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-1.5 sm:gap-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm whitespace-nowrap ${
                    index === 2
                      ? "col-span-2 justify-self-center sm:col-span-1"
                      : ""
                  }`}
                >
                  {feature.icon}
                  <span className="text-xs sm:text-sm">{feature.text}</span>
                </div>
              ))}
            </motion.div>

            {/* Action buttons */}
            <motion.div
              className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base lg:text-lg px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-6 font-semibold tracking-wide shadow-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 hover:scale-105 transition-all duration-300 border-0 text-white"
                onClick={handleScrollToContactForm}
              >
                Join Pilot Program (FREE)
                <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 ml-2 text-white" />
              </Button>

              <Link href="/pilot-program">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-sm sm:text-base lg:text-lg px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-6 font-semibold tracking-wide border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:scale-105 transition-all duration-300"
                >
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  See How It Works
                </Button>
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              className="mt-3 sm:mt-8 lg:mt-12 hidden sm:flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 lg:gap-8 px-4 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="flex -space-x-2 sm:-space-x-3">
                {industryTypes.map((industry, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 sm:border-3 border-white bg-white flex items-center justify-center shadow-lg"
                    title={industry.name}
                  >
                    <span className="text-lg sm:text-xl">{industry.icon}</span>
                  </div>
                ))}
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs sm:text-sm flex items-center justify-center border-2 sm:border-3 border-white font-bold shadow-lg">
                  20+
                </div>
              </div>
              <div className="text-xs sm:text-sm text-center sm:text-left">
                <div className="font-bold text-slate-900 text-sm sm:text-base">
                  20+ businesses
                </div>
                <div className="text-slate-600 text-xs sm:text-sm">
                  testing the future of customer engagement
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
