// This file defines the Discover page component.
// The Discover page serves as an informational page detailing the features,
// benefits, and technology behind the Blueprint AR platform. It includes
// sections like Enterprise AR features, an image carousel showcasing the setup process,
// a step-by-step guide to getting started, and a contact form.

import React, { useRef, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { Link, useLocation } from "wouter";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import FadeIn from "@/components/FadeIn";
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
 * Mobile-specific process stepper component with compact timeline design
 */
function MobileProcessStepper({ steps, onGetStarted }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Handle touch events for swipe
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
    if (isRightSwipe && currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="relative">
      {/* Horizontal Stepper Timeline */}
      <motion.div
        className="relative mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {/* Progress Line */}
        <div className="absolute top-6 left-6 right-6 h-1 bg-slate-200 rounded-full">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 via-violet-500 to-fuchsia-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>

        {/* Step Icons */}
        <div className="flex justify-between relative z-10">
          {steps.map((stepItem, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className="group relative"
            >
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  idx <= currentStep
                    ? `bg-gradient-to-br ${stepItem.color} text-white shadow-lg`
                    : "bg-white border-2 border-slate-200 text-slate-400"
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {idx < currentStep ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  React.cloneElement(stepItem.icon, {
                    className: "w-5 h-5",
                  })
                )}
              </motion.div>

              {/* Step Number Badge */}
              <div
                className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  idx <= currentStep
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {idx + 1}
              </div>

              {/* Step Label */}
              <div className="absolute top-14 left-1/2 transform -translate-x-1/2 w-20 text-center">
                <span className="text-xs font-medium text-slate-600 block leading-tight">
                  {stepItem.title.split(" ").slice(0, 2).join(" ")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Current Step Card */}
      <div
        className="relative overflow-hidden mt-16"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <Card className="bg-white border-slate-200 shadow-xl">
              <CardContent className="p-6">
                {/* Duration Badge */}
                <div className="text-center mb-4">
                  <span className="inline-block bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                    {step.duration}
                  </span>
                </div>

                {/* Step Icon & Title */}
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg`}
                  >
                    {React.cloneElement(step.icon, {
                      className: "w-7 h-7",
                    })}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {step.title}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {step.description}
                </p>

                {/* Benefits */}
                <div className="space-y-3 mb-6">
                  {step.benefits.map((benefit, bidx) => (
                    <motion.div
                      key={bidx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + bidx * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-slate-700 font-medium">
                        {benefit}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* CTA Button for first step */}
                {currentStep === 0 && (
                  <Button
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-4 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={onGetStarted}
                  >
                    Start Your AR Journey
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
          disabled={currentStep === 0}
          className="flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Previous
        </Button>

        <div className="text-sm text-slate-500">
          {currentStep + 1} / {steps.length}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            currentStep < steps.length - 1 && setCurrentStep(currentStep + 1)
          }
          disabled={currentStep === steps.length - 1}
          className="flex items-center gap-2 disabled:opacity-50"
        >
          Next
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Swipe Hint */}
      {currentStep === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-center mt-4"
        >
          <p className="text-xs text-slate-500">
            👆 Swipe left/right or use buttons to navigate
          </p>
        </motion.div>
      )}

      {/* Final CTA */}
      {currentStep === steps.length - 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-slate-600 mb-4">
            Ready to transform your customer experience?
          </p>
          <Button
            size="lg"
            variant="outline"
            className="px-8 py-4 font-semibold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
            onClick={onGetStarted}
          >
            Learn More & Get Started
            <ArrowDown className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Mobile-specific Enterprise AR section with horizontal scrolling and compact design
 */
const MobileEnterpriseARSection = ({ scrollToContact, primaryFeatures }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const currentFeature = primaryFeatures[activeIndex];

  // Handle touch events for swipe
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && activeIndex < primaryFeatures.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
    if (isRightSwipe && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  return (
    <section className="relative py-16 px-4 overflow-hidden">
      {/* Compact Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/50 to-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-gradient-to-r from-violet-400/20 to-purple-400/20 rounded-full blur-2xl" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-2xl" />
        </div>
      </div>

      <div className="relative z-10 max-w-sm mx-auto">
        {/* Compact Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 mb-4 bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 px-4 py-2 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-3 h-3" />
            Enterprise-Grade Technology
          </div>

          <h2 className="text-2xl md:text-3xl font-black mb-3 text-gray-900">
            Professional AR
            <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              Made Simple
            </span>
          </h2>

          <p className="text-sm text-gray-600 leading-relaxed">
            Enterprise-level capabilities with zero complexity
          </p>
        </motion.div>

        {/* Feature Navigation Tabs */}
        <motion.div
          className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {primaryFeatures.map((feature, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                index === activeIndex
                  ? `bg-gradient-to-r ${feature.gradient} text-white shadow-lg`
                  : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200"
              }`}
            >
              {feature.title.split(" ")[0]}{" "}
              {/* First word only for compact display */}
            </button>
          ))}
        </motion.div>

        {/* Current Feature Card */}
        <div
          className="relative overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden">
                {/* Gradient header */}
                <div
                  className={`h-1 bg-gradient-to-r ${currentFeature.gradient}`}
                />

                <CardContent className="p-6">
                  {/* Icon and Title Section */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${currentFeature.gradient} text-white shadow-lg flex-shrink-0`}
                    >
                      {React.cloneElement(currentFeature.icon, {
                        className: "w-6 h-6",
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {currentFeature.title}
                      </h3>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {currentFeature.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 leading-relaxed mb-6 text-sm">
                    {currentFeature.description}
                  </p>

                  {/* Compact Metrics */}
                  <div className="bg-gray-50/80 rounded-xl p-4 mb-6">
                    <div className="flex justify-around">
                      {currentFeature.metrics.map((metric, midx) => (
                        <div key={midx} className="text-center">
                          <div
                            className={`text-lg font-black bg-gradient-to-r ${currentFeature.gradient} bg-clip-text text-transparent mb-1`}
                          >
                            {metric.value}
                          </div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {metric.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Compact Benefits */}
                  <div className="space-y-2 mb-6">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Key Benefits
                    </h4>
                    {currentFeature.benefits.map((benefit, bidx) => (
                      <motion.div
                        key={bidx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + bidx * 0.1 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-700">
                          {benefit}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Progress indicator */}
                  <div className="text-center text-xs text-slate-500 mb-4">
                    {activeIndex + 1} of {primaryFeatures.length}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {primaryFeatures.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === activeIndex ? "bg-indigo-600 w-4" : "bg-slate-300"
              }`}
            />
          ))}
        </div>

        {/* Swipe Hint */}
        {activeIndex === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="text-center mt-4"
          >
            <p className="text-xs text-slate-500">
              👆 Swipe left/right to see more features
            </p>
          </motion.div>
        )}

        {/* Compact CTA */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-sm text-gray-600 mb-4">
            Ready to experience enterprise AR?
          </p>
          <Button
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-3 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
            onClick={scrollToContact}
          >
            Join Pilot Program
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

/**
 * The EnterpriseARSection component highlights the enterprise-grade features of the Blueprint AR platform.
 * It showcases primary features like zero-friction access, AI-powered optimization, and multi-user experiences,
 * along with secondary features like advanced analytics, security, performance, and CDN.
 *
 * @returns {JSX.Element} The rendered EnterpriseARSection component.
 */
const EnterpriseARSection = ({ scrollToContact }) => {
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
    <section className="relative py-24 md:py-32 px-4 overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/50 to-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-violet-400/20 to-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />
        </div>

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
        <FadeIn yOffset={30} delay={0.3} className="text-center mb-20">
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
          {/* <div className="flex flex-wrap justify-center gap-8 text-sm font-semibold text-gray-700">
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
          </div> */}
        </FadeIn>

        {/* Primary Features - Enhanced Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 mb-20">
          {primaryFeatures.map((feature, idx) => (
            <FadeIn
              key={idx}
              yOffset={40}
              delay={feature.delay}
              className="group"
            >
              <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden bg-white/80 backdrop-blur-sm">
                {/* Gradient header */}
                <div className={`h-2 bg-gradient-to-r ${feature.gradient}`} />

                <CardContent className="p-8">
                  {/* Icon and Title Section */}
                  <div className="flex items-start gap-4 mb-8">
                    <div
                      className={`p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg flex-shrink-0`}
                    >
                      {feature.icon}
                    </div>
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
                  <div className="bg-gray-50/80 rounded-2xl p-6 mb-8">
                    <div className="flex flex-wrap justify-center gap-8">
                      {feature.metrics.map((metric, midx) => (
                        <div
                          key={midx}
                          className="text-center min-w-0 flex-shrink-0"
                        >
                          <div
                            className={`text-xl font-black bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent mb-2 leading-tight`}
                          >
                            {metric.value}
                          </div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-relaxed whitespace-nowrap">
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
                      <FadeIn
                        key={bidx}
                        delay={bidx * 0.1}
                        className="flex items-center gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 leading-relaxed">
                          {benefit}
                        </span>
                      </FadeIn>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        {/* Secondary Features - Compact Grid */}
        {/* <FadeIn yOffset={30} delay={0.4} className="mb-16">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Built for Scale & Security
          </h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {secondaryFeatures.map((feature, idx) => (
              <FadeIn
                key={idx}
                yOffset={20}
                delay={idx * 0.1}
                className="group"
              >
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/70 backdrop-blur-sm group-hover:-translate-y-1">
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
              </FadeIn>
            ))}
          </div>
        </FadeIn> */}

        {/* Call to Action */}
        <FadeIn
          yOffset={30}
          delay={0.6}
          className="hidden md:block text-center bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-12 shadow-2xl"
        >
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join Pilot Program
          </h3>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Be among the first to experience Blueprint. We're carefully
            selecting businesses for our exclusive Pilot Program.
          </p>
          <Button
            size="lg"
            className="bg-white text-indigo-600 hover:bg-gray-50 px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
            onClick={scrollToContact}
          >
            Join Pilot Program
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </FadeIn>
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
      time: "30-60 mins",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 10_28_16 AM.png",
      alt: "Step 3: AI Generation",
      caption: "AI-Powered Creation",
      description: "Our AI helps our designers create custom AR experiences",
      time: "1-2 days",
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

  // Preload the next image
  useEffect(() => {
    if (slides && slides.length > 1) {
      const nextIndex = (activeIndex + 1) % slides.length;
      if (slides[nextIndex] && slides[nextIndex].src) {
        const img = new Image();
        img.src = slides[nextIndex].src;
      }

      // Optional: Preload previous image as well for bi-directional navigation
      // const prevIndex = (activeIndex - 1 + slides.length) % slides.length;
      // if (slides[prevIndex] && slides[prevIndex].src) {
      //   const prevImg = new Image();
      //   prevImg.src = slides[prevIndex].src;
      // }
    }
  }, [activeIndex, slides]);

  return (
    <div className="relative">
      {/* Main carousel container */}
      <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="relative w-full aspect-[16/10] md:aspect-[3/2]">
          <FadeIn
            key={activeIndex}
            className="absolute inset-0 w-full h-full"
            delay={0}
            threshold={0.1}
          >
            <img
              src={slides[activeIndex].src}
              alt={slides[activeIndex].alt}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </FadeIn>

          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Enhanced caption with step info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <FadeIn yOffset={20} delay={0.2} key={`caption-${activeIndex}`}>
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
            </FadeIn>
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

const steps = [
  {
    icon: <Users className="w-6 h-6 md:w-8 md:h-8" />,
    title: "Join Pilot Program",
    description:
      "Secure your spot in our exclusive Pilot Program. Priority onboarding available.",
    benefits: ["Priority access", "Free 2 week program", "Dedicated support"],
    color: "from-emerald-500 to-teal-600",
    duration: "1 minute",
  },
  {
    icon: <MapPin className="w-6 h-6 md:w-8 md:h-8" />,
    title: "3D Space Mapping",
    description:
      "Our expert team visits your location to create a precise 3D digital twin of your space.",
    benefits: [
      "Professional scanning",
      "Flexible scheduling",
      "High-precision mapping",
    ],
    color: "from-blue-500 to-cyan-500",
    duration: "30-60 minutes",
  },
  // {
  //   icon: <Brain className="w-6 h-6 md:w-8 md:h-8" />,
  //   title: "AI-Powered Setup",
  //   description:
  //     "Our AI generates custom AR experiences tailored to your business goals and customer journey.",
  //   benefits: [
  //     "Intelligent content placement",
  //     "Custom interactions",
  //     "Brand integration",
  //   ],
  //   color: "from-violet-500 to-purple-600",
  //   duration: "30 minutes",
  // },
  {
    icon: <Brain className="w-6 h-6 md:w-8 md:h-8" />,
    title: "Blueprint Design",
    description:
      "Our designers work to create custom AR experiences tailored to your business goals and customer journey.",
    benefits: [
      "Intelligent content placement",
      "Custom interactions",
      "Brand integration",
    ],
    color: "from-violet-500 to-purple-600",
    duration: "1-2 Days",
  },
  // {
  //   icon: <Rocket className="w-6 h-6 md:w-8 md:h-8" />,
  //   title: "Launch & Scale",
  //   description:
  //     "Go live instantly with QR codes. Track engagement and optimize your AR experience with real-time analytics.",
  //   benefits: [
  //     "Instant deployment",
  //     "Performance analytics",
  //     "Continuous optimization",
  //   ],
  //   color: "from-fuchsia-500 to-pink-600",
  //   duration: "Same day",
  // },
  {
    icon: <Rocket className="w-6 h-6 md:w-8 md:h-8" />,
    title: "Demo Day",
    description:
      "We'll come in with an Apple Vision Pro to give a ~1 hour long demonstration. Open to any and everyone!",
    benefits: ["Feedback", "Performance analytics", "Continuous optimization"],
    color: "from-fuchsia-500 to-pink-600",
    duration: "Next Week",
  },
];

// Enhanced step cards for the 4-step process
// const steps = [
//   {
//     icon: <Rocket className="w-8 h-8" />,
//     title: "Join Early Access",
//     description:
//       "Reserve your spot for priority access to Blueprint's AR platform",
//     benefits: [
//       "Free 2 week program access",
//       "Priority support",
//       "Custom onboarding",
//     ],
//     color: "from-violet-500 to-purple-600",
//   },
//   {
//     icon: <Scan className="w-8 h-8" />,
//     title: "Quick 3D Mapping",
//     description:
//       "Our team scans your space in 30-60 minutes using advanced tech",
//     benefits: [
//       "Non-intrusive process",
//       "Works during business hours",
//       "No setup required",
//     ],
//     color: "from-blue-500 to-cyan-500",
//   },
//   {
//     icon: <Wand2 className="w-8 h-8" />,
//     title: "AI Creates Your AR",
//     description:
//       "Watch as AI instantly generates custom AR experiences for your space",
//     benefits: [
//       "Tailored to your brand",
//       "Preview in real-time",
//       "Unlimited revisions",
//     ],
//     color: "from-emerald-500 to-teal-500",
//   },
//   {
//     icon: <Star className="w-8 h-8" />,
//     title: "Go Live Instantly",
//     description:
//       "Launch your AR experience and start delighting customers immediately",
//     benefits: [
//       "No app downloads",
//       "Analytics dashboard",
//       "Continuous optimization",
//     ],
//     color: "from-orange-500 to-red-500",
//   },
// ];

const handleScrollToContactForm = () => {
  const contactFormElement = document.getElementById("contactForm");
  if (contactFormElement) {
    contactFormElement.scrollIntoView({ behavior: "smooth" });
  }
};

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
  const [location, setLocation] = useLocation();

  const goToPilotProgram = () => {
    setLocation("/pilot-program");
  };
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
            <FadeIn yOffset={30} delay={0.2} className="space-y-8">
              <FadeIn
                delay={0.2}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-100 to-indigo-100 text-indigo-700 px-5 py-2 rounded-full text-sm font-semibold"
              >
                <Sparkle className="w-4 h-4" />
                See How Blueprint Works
              </FadeIn>

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
                    Join Pilot Program
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="group px-8 py-6 text-lg font-semibold border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-300"
                  onClick={goToPilotProgram}
                >
                  <PlayCircle className="mr-2 h-5 w-5 text-indigo-600" />
                  Watch 2-min Demo
                </Button>
              </div>

              {/* Trust indicators */}
              <FadeIn yOffset={20} delay={0.4}>
                <div className="flex items-center gap-8 pt-4 text-sm text-gray-600">
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
                </div>
              </FadeIn>
            </FadeIn>

            <FadeIn delay={0.3} className="relative">
              <ImageCarousel />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Streamlined 4-Step Process */}
      <section className="py-20 md:py-32 px-4 bg-gradient-to-b from-gray-50 to-white relative">
        <div className="container mx-auto max-w-7xl">
          <FadeIn yOffset={30} delay={0.2} className="text-center mb-20">
            <div className="inline-flex items-center gap-2 mb-6 bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 px-5 py-2 rounded-full text-sm font-semibold">
              <Zap className="w-4 h-4" />
              Simple 4-Step Process
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 md:mb-6 text-gray-900 leading-tight">
              From Sign-Up to Live AR in
              <span className="block mt-1 md:mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Less Than 24 Hours
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our streamlined process gets you up and running faster than
              ordering custom business cards
            </p>
          </FadeIn>

          {/* MOBILE VERSION */}
          <div className="block md:hidden">
            <MobileProcessStepper
              steps={steps}
              onGetStarted={handleScrollToContactForm}
            />
          </div>

          {/* DESKTOP VERSION */}
          <div className="hidden md:block">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
              {/* Enhanced connection line */}
              <div className="hidden lg:block absolute top-20 left-[12.5%] right-[12.5%] h-1 bg-gradient-to-r from-emerald-400 via-blue-400 via-violet-400 to-fuchsia-400 rounded-full shadow-lg" />

              {steps.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.15 }}
                  whileHover={{ y: -8 }}
                  className="relative z-10"
                >
                  <Card className="h-full border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-white/90 backdrop-blur-sm overflow-hidden group">
                    <CardContent className="p-6 md:p-8">
                      <div className="flex flex-col items-center text-center mb-6">
                        <div className="relative mb-6">
                          <div
                            className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${step.color} shadow-xl group-hover:scale-110 transition-transform duration-300`}
                          >
                            {step.icon}
                          </div>
                          <div className="absolute -top-2 -right-2 bg-slate-900 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">
                            {idx + 1}
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          {step.duration}
                        </div>

                        <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">
                          {step.title}
                        </h3>

                        <p className="text-slate-600 mb-6 leading-relaxed">
                          {step.description}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {step.benefits.map((benefit, bidx) => (
                          <div
                            key={bidx}
                            className="flex items-center text-slate-700"
                          >
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                            <span className="text-sm font-medium">
                              {benefit}
                            </span>
                          </div>
                        ))}
                      </div>

                      {idx === 0 && (
                        <Button
                          className="w-full mt-8 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-base py-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                          onClick={handleScrollToContactForm}
                        >
                          Start Your AR Journey
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MOBILE VERSION */}
      <div className="block md:hidden">
        <MobileEnterpriseARSection
          scrollToContact={scrollToContact}
          primaryFeatures={[
            {
              icon: <Smartphone className="w-8 h-8" />,
              title: "Zero-Friction Access",
              subtitle: "No App Downloads Required",
              description:
                "Customers access AR experiences instantly through any mobile browser. No app store visits, no storage space required.",
              metrics: [
                { label: "Load Time", value: "< 2s" },
                { label: "Compatibility", value: "100%" },
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
          ]}
        />
      </div>

      {/* DESKTOP VERSION */}
      <div className="hidden md:block">
        <EnterpriseARSection scrollToContact={scrollToContact} />
      </div>

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
