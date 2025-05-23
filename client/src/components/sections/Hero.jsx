"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Link } from "wouter";
import { PlayIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { Info, Sparkles, Zap, Eye } from "lucide-react";

export default function Hero() {
  const headlines = [
    {
      text: "Turn Any Space Into an",
      highlight: "Interactive AR Experience",
      description:
        "Transform your business location into an immersive digital playground that captivates customers and drives engagement—no app downloads required.",
    },
    {
      text: "Boost Customer Engagement with",
      highlight: "Web-Based Augmented Reality",
      description:
        "Create memorable experiences that work instantly in any smartphone browser. From product demos to virtual tours, engage customers like never before.",
    },
    {
      text: "Revolutionary AR Platform for",
      highlight: "Forward-Thinking Businesses",
      description:
        "Join industry leaders who are already transforming customer experiences with our cutting-edge spatial computing technology.",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const heroRef = useRef(null);
  const isInView = useInView(heroRef, { once: true });

  const handleScrollToContactForm = () => {
    const contactFormElement = document.getElementById("contactForm");
    if (contactFormElement) {
      contactFormElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [headlines.length]);

  const features = [
    { icon: <Zap className="w-5 h-5" />, text: "No App Required" },
    { icon: <Eye className="w-5 h-5" />, text: "Works on Any Phone" },
    { icon: <Sparkles className="w-5 h-5" />, text: "Ready in Days" },
  ];

  return (
    <section
      ref={heroRef}
      className="relative min-h-[95vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/30"
    >
      {/* Enhanced background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-100/40 via-violet-100/30 to-fuchsia-100/20 blur-3xl"
          animate={{
            y: [0, 30, 0],
            x: [0, 20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-100/30 via-cyan-100/20 to-emerald-100/10 blur-3xl"
          animate={{
            y: [0, -40, 0],
            x: [0, 30, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: "reverse",
            delay: 2,
          }}
        />
      </div>

      {/* Floating grid pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='rgb(99 102 241 / 0.03)' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="container mx-auto px-6 relative z-20">
        <div className="max-w-4xl mx-auto text-center">
          <div>
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 mb-6 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 py-2 px-4 rounded-full text-sm font-semibold tracking-wide border border-indigo-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.6 }}
            >
              <Sparkles className="w-4 h-4" />
              Next-Gen AR Technology Platform
            </motion.div>

            {/* Main headline container */}
            <div className="min-h-[160px] sm:min-h-[180px] md:min-h-[220px] lg:min-h-[240px] mb-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  className="w-full"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.8 }}
                >
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight line-clamp-2 overflow-hidden">
                    <span className="text-slate-900">
                      {headlines[currentIndex].text}
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-transparent bg-clip-text">
                      {headlines[currentIndex].highlight}
                    </span>
                  </h1>
                  <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed line-clamp-2 overflow-hidden">
                    {headlines[currentIndex].description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Feature badges */}
            <motion.div
              className="flex flex-wrap justify-center gap-3 mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
                >
                  {feature.icon}
                  {feature.text}
                </div>
              ))}
            </motion.div>

            {/* Action buttons */}
            <motion.div
              className="flex flex-col sm:flex-row justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Button
                size="lg"
                className="text-lg px-10 py-6 font-semibold tracking-wide shadow-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 hover:scale-105 transition-all duration-300 border-0"
                onClick={handleScrollToContactForm}
              >
                Get Early Access
                <ArrowRightIcon className="w-5 h-5 ml-2" />
              </Button>

              <Link href="/discover">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-10 py-6 font-semibold tracking-wide border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:scale-105 transition-all duration-300"
                >
                  <Info className="w-5 h-5 mr-2" />
                  See How It Works
                </Button>
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-3 border-white overflow-hidden shadow-lg"
                  >
                    <img
                      src={`/images/avatar-${i}.jpg`}
                      alt="Customer avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=User+${i}&background=6366f1&color=fff&bold=true`;
                      }}
                    />
                  </div>
                ))}
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm flex items-center justify-center border-3 border-white font-bold shadow-lg">
                  2K+
                </div>
              </div>
              <div className="text-sm text-center sm:text-left">
                <div className="font-bold text-slate-900 text-base">
                  2,000+ businesses
                </div>
                <div className="text-slate-600">
                  already transforming customer experiences
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
