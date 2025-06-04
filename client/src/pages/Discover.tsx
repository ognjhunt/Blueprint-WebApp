// This file defines the Discover page component.
// The Discover page serves as an informational page detailing the features,
// benefits, and technology behind the Blueprint AR platform. It includes
// sections like Enterprise AR features, an image carousel showcasing the setup process,
// a step-by-step guide to getting started, and a contact form.

import React, { useRef, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { Link } from "wouter";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AIChatButton from "@/components/AIChatButton";
import {
  ShieldCheck,
  Rocket,
  Sparkle,
  Zap,
  MapPin,
  Edit,
  Wand2,
  PlayCircle,
  Smartphone,
  Brain,
  BarChart3,
  Gauge,
  Cloud,
  ArrowRight,
  CheckCircle2,
  ArrowDown,
  Info,
  Layers,
  Code,
  Globe,
  Users,
  PenTool,
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  Scan,
  Star,
  Lock,
} from "lucide-react";

/**
 * The EnterpriseARSection component highlights the enterprise-grade features of the Blueprint AR platform.
 * It showcases primary features like zero-friction access, AI-powered optimization, and multi-user experiences,
 * along with secondary features like advanced analytics, security, performance, and CDN.
 *
 * @returns {JSX.Element} The rendered EnterpriseARSection component.
 */
const EnterpriseARSection = () => {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  // Enhanced feature set with metrics and detailed benefits
  const primaryFeatures = [
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "Zero-Friction Access",
      subtitle: "No App Downloads Required",
      description:
        "Customers access AR experiences instantly through any mobile browser. No app store visits, no storage space required.",
      metrics: [
        { label: "Load Time", value: "< 2s" },
        { label: "Compatibility", value: "100%" },
        { label: "Storage Used", value: "0 MB" },
      ],
      benefits: [
        "Works on any smartphone",
        "Instant access via QR codes",
        "No user friction barriers",
      ],
      gradient: "from-blue-500 via-cyan-500 to-teal-500",
      delay: 0.1,
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "AI-Powered Optimization",
      subtitle: "Smart Content Placement",
      description:
        "Our AI analyzes foot traffic, lighting, and spatial geometry to position AR elements exactly where they'll have maximum impact.",
      metrics: [
        { label: "Accuracy", value: "99.2%" },
        { label: "Speed", value: "Real-time" },
        { label: "Learning", value: "Continuous" },
      ],
      benefits: [
        "Optimal engagement zones",
        "Adaptive to environment changes",
        "Performance-driven placement",
      ],
      gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
      delay: 0.2,
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Multi-User Experiences",
      subtitle: "Shared AR Interactions",
      description:
        "Multiple customers can simultaneously interact with the same AR elements, creating collaborative and social experiences.",
      metrics: [
        { label: "Concurrent Users", value: "50+" },
        { label: "Sync Latency", value: "< 100ms" },
        { label: "Stability", value: "99.9%" },
      ],
      benefits: [
        "Social AR interactions",
        "Real-time synchronization",
        "Scalable architecture",
      ],
      gradient: "from-emerald-500 via-green-500 to-lime-500",
      delay: 0.3,
    },
  ];

  const secondaryFeatures = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Advanced Analytics",
      description:
        "Comprehensive engagement tracking with heat maps, interaction analytics, and ROI measurement.",
      color: "from-orange-500 to-red-500",
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Enterprise Security",
      description:
        "Bank-level encryption, SOC 2 compliance, and privacy-first architecture protect your data.",
      color: "from-pink-500 to-rose-500",
    },
    {
      icon: <Gauge className="w-6 h-6" />,
      title: "Lightning Performance",
      description:
        "Optimized rendering engine ensures smooth 60fps AR experiences even on older devices.",
      color: "from-indigo-500 to-blue-500",
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: "Global CDN",
      description:
        "Content delivered from 180+ edge locations worldwide for consistent performance anywhere.",
      color: "from-cyan-500 to-teal-500",
    },
  ];

  return (
    <section
      ref={containerRef}
      className="relative py-24 md:py-32 px-4 overflow-hidden"
    >
      {/* Enhanced Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/50 to-white">
        <motion.div style={{ y }} className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-violet-400/20 to-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />
        </motion.div>

        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `
              linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)
            `,
              backgroundSize: "60px 60px",
            }}
          />
        </div>
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 mb-6 bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 px-6 py-3 rounded-full text-sm font-semibold shadow-lg">
            <ShieldCheck className="w-4 h-4" />
            Enterprise-Grade Technology
          </div>

          <h2 className="text-5xl md:text-6xl font-black mb-8 text-gray-900 leading-tight">
            Professional AR
            <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              Made Simple
            </span>
          </h2>

          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-8">
            Enterprise-level capabilities with zero complexity. Our platform
            delivers cutting-edge AR technology that scales from boutique shops
            to global retailers.
          </p>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 text-sm font-semibold text-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>SOC 2 Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>99.9% Uptime SLA</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>24/7 Support</span>
            </div>
          </div>
        </motion.div>

        {/* Primary Features - Enhanced Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 mb-20">
          {primaryFeatures.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: feature.delay }}
              onMouseEnter={() => setHoveredFeature(idx)}
              onMouseLeave={() => setHoveredFeature(null)}
              className="group"
            >
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden bg-white/80 backdrop-blur-sm">
                {/* Gradient header */}
                <div className={`h-2 bg-gradient-to-r ${feature.gradient}`} />

                <CardContent className="p-8">
                  {/* Icon and Title Section */}
                  <div className="flex items-start gap-4 mb-8">
                    <motion.div
                      whileHover={{ rotate: 5, scale: 1.1 }}
                      className={`p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg flex-shrink-0`}
                    >
                      {feature.icon}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                        {feature.title}
                      </h3>
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        {feature.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 leading-relaxed mb-8 text-base">
                    {feature.description}
                  </p>

                  {/* Metrics - Improved Layout */}
                  <div className="bg-gray-50/80 rounded-2xl p-8 mb-8">
                    <div className="grid grid-cols-3 gap-4">
                      {feature.metrics.map((metric, midx) => (
                        <div key={midx} className="text-center">
                          <div
                            className={`text-xl font-black bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent mb-3 leading-none`}
                          >
                            {metric.value}
                          </div>
                          <div className="text-sm font-medium text-gray-500 uppercase tracking-wide leading-relaxed">
                            {metric.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      Key Benefits
                    </h4>
                    {feature.benefits.map((benefit, bidx) => (
                      <motion.div
                        key={bidx}
                        initial={{ opacity: 0.8, x: 0 }}
                        animate={{
                          opacity: hoveredFeature === idx ? 1 : 0.8,
                          x: hoveredFeature === idx ? 4 : 0,
                        }}
                        transition={{ delay: bidx * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 leading-relaxed">
                          {benefit}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Secondary Features - Compact Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-16"
        >
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Built for Scale & Security
          </h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {secondaryFeatures.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="group"
              >
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/70 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div
                      className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} text-white mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      {feature.icon}
                    </div>
                    <h4 className="text-lg font-bold mb-2 text-gray-900">
                      {feature.title}
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-12 shadow-2xl"
        >
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to See It in Action?
          </h3>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Schedule a personalized demo and see how Blueprint can transform
            your customer experience in under 30 minutes.
          </p>
          <Button
            size="lg"
            className="bg-white text-indigo-600 hover:bg-gray-50 px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
          >
            Schedule Demo
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

/**
 * The ImageCarousel component displays a series of images with captions,
 * showcasing the step-by-step process of setting up a Blueprint AR experience.
 * It includes auto-play functionality and navigation controls.
 *
 * @returns {JSX.Element} The rendered ImageCarousel component.
 */
const ImageCarousel = () => {
  const slides = [
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 08_32_27 AM.png",
      alt: "Step 1: Initial Meeting",
      caption: "Initial Meeting",
      description: "Our mapping specialist arrives at your location",
      time: "5 mins",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 08_50_20 AM.png",
      alt: "Step 2: 3D Scanning",
      caption: "3D Space Scanning",
      description: "Advanced scanning creates a digital twin of your space",
      time: "20 mins",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 10_28_16 AM.png",
      alt: "Step 3: AI Generation",
      caption: "AI-Powered Creation",
      description: "Our AI instantly generates custom AR experiences",
      time: "15 mins",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 09_03_13 AM.png",
      alt: "Step 4: QR Placement",
      caption: "Strategic QR Placement",
      description: "QR codes positioned for optimal customer engagement",
      time: "15 mins",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 09_08_15 AM.png",
      alt: "Step 5: Customer Experience",
      caption: "Instant AR Access",
      description: "Customers scan QR codes to enter AR experiences",
      time: "Instant",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 10_33_42 AM.png",
      alt: "Step 6: Continuous Updates",
      caption: "Continuous Optimization",
      description: "AI analyzes data to improve experiences over time",
      time: "Ongoing",
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delay = 7000;

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => {
    resetTimeout();
    timeoutRef.current = setTimeout(() => {
      setActiveIndex((prevIndex) =>
        prevIndex === slides.length - 1 ? 0 : prevIndex + 1,
      );
    }, delay);
    return () => {
      resetTimeout();
    };
  }, [activeIndex, slides.length]);

  return (
    <div className="relative">
      {/* Main carousel container */}
      <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="relative w-full aspect-[16/10] md:aspect-[3/2]">
          <AnimatePresence mode="wait">
            <picture>
              <source srcSet={slides[activeIndex].src.replace(/\.(png|jpe?g)$/i, '.webp')} type="image/webp" />
              <source srcSet={slides[activeIndex].src} type={slides[activeIndex].src.endsWith('.png') ? 'image/png' : 'image/jpeg'} />
              <motion.img
                key={activeIndex}
                src={slides[activeIndex].src}
                alt={slides[activeIndex].alt}
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.7 }}
                loading="lazy"
              />
            </picture>
          </AnimatePresence>

          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Enhanced caption with step info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <motion.div
              key={`caption-${activeIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  {slides[activeIndex].time}
                </span>
                <span className="text-white/80 text-sm">
                  Step {activeIndex + 1} of {slides.length}
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {slides[activeIndex].caption}
              </h3>
              <p className="text-white/90 text-lg max-w-2xl">
                {slides[activeIndex].description}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Enhanced navigation buttons */}
        <button
          onClick={() => {
            resetTimeout();
            setActiveIndex(
              activeIndex === 0 ? slides.length - 1 : activeIndex - 1,
            );
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => {
            resetTimeout();
            setActiveIndex(
              activeIndex === slides.length - 1 ? 0 : activeIndex + 1,
            );
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
          aria-label="Next slide"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mt-6">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              resetTimeout();
              setActiveIndex(idx);
            }}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === activeIndex
                ? "w-8 bg-gradient-to-r from-indigo-500 to-violet-500"
                : "w-2 bg-gray-300 hover:bg-gray-400"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

// Enhanced step cards for the 4-step process
const steps = [
  {
    icon: <Rocket className="w-8 h-8" />,
    title: "Join Early Access",
    description:
      "Reserve your spot for priority access to Blueprint's AR platform",
    benefits: [
      "Free 14-day pilot access",
      "Priority support",
      "Custom onboarding",
    ],
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: <Scan className="w-8 h-8" />,
    title: "Quick 3D Mapping",
    description:
      "Our team scans your space in under 30 minutes using advanced tech",
    benefits: [
      "Non-intrusive process",
      "Works during business hours",
      "No setup required",
    ],
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: <Wand2 className="w-8 h-8" />,
    title: "AI Creates Your AR",
    description:
      "Watch as AI instantly generates custom AR experiences for your space",
    benefits: [
      "Tailored to your brand",
      "Preview in real-time",
      "Unlimited revisions",
    ],
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: <Star className="w-8 h-8" />,
    title: "Go Live Instantly",
    description:
      "Launch your AR experience and start delighting customers immediately",
    benefits: [
      "No app downloads",
      "Analytics dashboard",
      "Continuous optimization",
    ],
    color: "from-orange-500 to-red-500",
  },
];

// Enhanced technology features
const techFeatures = [
  {
    icon: <Globe className="w-8 h-8" />,
    title: "No App Downloads",
    description:
      "Works instantly in any mobile browser. Your customers just scan and experience.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: <Layers className="w-8 h-8" />,
    title: "Smart AR Placement",
    description:
      "AI analyzes your space to place AR elements exactly where they'll have maximum impact.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Multi-User Experiences",
    description:
      "Multiple customers can interact with the same AR elements simultaneously.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: <Activity className="w-8 h-8" />,
    title: "Real-Time Analytics",
    description:
      "Track engagement, popular elements, and ROI with our comprehensive dashboard.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: <ShieldCheck className="w-8 h-8" />,
    title: "Enterprise Security",
    description:
      "Bank-level encryption and privacy controls keep your data and customers safe.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: "Lightning Fast",
    description:
      "AR experiences load in under 2 seconds, ensuring zero customer friction.",
    gradient: "from-indigo-500 to-blue-500",
  },
];

/**
 * The Discover component renders the main informational page about the Blueprint AR platform.
 * It includes sections detailing enterprise features, an image carousel of the setup process,
 * a step-by-step guide, and a contact form for users to get early access.
 *
 * @returns {JSX.Element} The rendered Discover page.
 */
export default function Discover() {
  const contactFormRef = useRef<HTMLDivElement>(null);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  /**
   * Scrolls the page smoothly to the contact form section.
   */
  const scrollToContact = () => {
    contactFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Subtle background decoration */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.08),transparent_50%)]" />
      </div>

      <Nav />

      {/* Enhanced Hero Section */}
      <section className="relative pt-28 pb-20 px-4 overflow-hidden">
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-100 to-indigo-100 text-indigo-700 px-5 py-2 rounded-full text-sm font-semibold"
              >
                <Sparkle className="w-4 h-4" />
                See How Blueprint Works
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-gray-900">
                Turn Any Space Into an{" "}
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                  AR Experience
                </span>
                <span className="block mt-2 text-3xl md:text-4xl lg:text-5xl text-gray-700">
                  in Under 1 Hour
                </span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
                No coding. No apps. Just scan a QR code and watch your space
                come alive with interactive AR that drives 3x more engagement.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  size="lg"
                  className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-8 py-6 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300"
                  onClick={scrollToContact}
                >
                  <span className="relative z-10 flex items-center">
                    Get Early Access
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="group px-8 py-6 text-lg font-semibold border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-300"
                >
                  <PlayCircle className="mr-2 h-5 w-5 text-indigo-600" />
                  Watch 2-min Demo
                </Button>
              </div>

              {/* Trust indicators */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex items-center gap-8 pt-4 text-sm text-gray-600"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Setup in 1 hour</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>No app required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>Impact Guaranteed</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="relative"
            >
              <ImageCarousel />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Streamlined 4-Step Process */}
      <section className="py-20 md:py-32 px-4 bg-gradient-to-b from-gray-50 to-white relative">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 mb-6 bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 px-5 py-2 rounded-full text-sm font-semibold">
              <Zap className="w-4 h-4" />
              Simple 4-Step Process
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              From Sign-Up to Live AR in
              <span className="block mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Less Than 24 Hours
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our streamlined process gets you up and running faster than
              ordering custom business cards
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 relative">
            {/* Connection line for desktop */}
            <div className="hidden lg:block absolute top-24 left-[12.5%] right-[12.5%] h-0.5">
              <div className="h-full bg-gradient-to-r from-violet-300 via-indigo-300 to-purple-300 rounded-full" />
            </div>

            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                onMouseEnter={() => setHoveredStep(idx)}
                onMouseLeave={() => setHoveredStep(null)}
                className="relative"
              >
                <Card
                  className={`h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden ${
                    hoveredStep === idx ? "scale-105" : ""
                  }`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-5`}
                  />
                  <CardContent className="relative p-8">
                    <div className="flex flex-col items-center text-center">
                      {/* Step number and icon */}
                      <div className="relative mb-6">
                        <motion.div
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.8 }}
                          className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} p-5 shadow-xl`}
                        >
                          <div className="w-full h-full flex items-center justify-center text-white">
                            {step.icon}
                          </div>
                        </motion.div>
                        <div className="absolute -top-2 -right-2 bg-white shadow-lg text-gray-900 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center border-2 border-gray-100">
                          {idx + 1}
                        </div>
                      </div>

                      <h3 className="text-2xl font-bold mb-3 text-gray-900">
                        {step.title}
                      </h3>

                      <p className="text-gray-600 mb-6 leading-relaxed">
                        {step.description}
                      </p>

                      <div className="space-y-3 w-full">
                        {step.benefits.map((benefit, bidx) => (
                          <motion.div
                            key={bidx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{
                              opacity: hoveredStep === idx ? 1 : 0.8,
                              x: 0,
                            }}
                            transition={{ delay: bidx * 0.1 }}
                            className="flex items-center text-left"
                          >
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-700">
                              {benefit}
                            </span>
                          </motion.div>
                        ))}
                      </div>

                      {idx === 0 && (
                        <Button
                          className="w-full mt-8 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                          onClick={scrollToContact}
                        >
                          Reserve Your Spot
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <EnterpriseARSection />

      {/* Contact Form Section */}
      <section
        ref={contactFormRef}
        id="contactForm"
        className="py-24 px-4 bg-gray-50"
      >
        <div className="container mx-auto max-w-7xl">
          <ContactForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
