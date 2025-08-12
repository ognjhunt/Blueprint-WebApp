// ===============================================
// FILE: src/pages/PilotProgram.jsx
// PURPOSE: Full-page Pilot Program (emerald/cyan brand) — dark base UI
// NOTES: JS/JSX only (no TS). Keeps all original functionality: toasts,
//        video demo, tabs, carousels, FAQ accordion, and ContactForm.
//        Copy + section order revamped for maximum clarity & conversion.
// ===============================================

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Nav from "@/components/Nav";
import { toast, Toaster } from "sonner";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";
import {
  Rocket,
  MapPin,
  Wand2,
  PlayCircle,
  Users,
  CalendarCheck,
  CheckCircle2,
  UtensilsCrossed,
  Clock,
  DollarSign,
  ArrowRight,
  ChevronRight,
  Shield,
  Zap,
  Lightbulb,
  Monitor,
  Target,
  Star,
  ChevronDown,
  Video,
  Send,
  Sparkles,
  Store,
  Building2,
  Smartphone,
} from "lucide-react";

const mobileNavBtnClass =
  "flex items-center gap-2 border-white/30 bg-white/90 text-slate-900 hover:bg-white hover:text-slate-900 disabled:bg-white disabled:text-slate-400 disabled:opacity-100";

// -----------------------------------------------
// Mobile: Benefits Carousel (dark theme)
// -----------------------------------------------
function MobileBenefitsCarousel({ benefits }) {
  const [currentBenefit, setCurrentBenefit] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const current = benefits[currentBenefit];

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dist = touchStart - touchEnd;
    if (dist > 50 && currentBenefit < benefits.length - 1)
      setCurrentBenefit(currentBenefit + 1);
    if (dist < -50 && currentBenefit > 0) setCurrentBenefit(currentBenefit - 1);
  };

  return (
    <div className="relative px-4">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl md:text-3xl font-black mb-3 text-white">
          Why Join the Pilot?
        </h2>
        <p className="text-sm text-slate-300">
          Transform your on-site customer experience with zero risk
        </p>
      </motion.div>

      <div className="text-center mb-4">
        <span className="text-sm font-medium text-slate-400">
          Benefit {currentBenefit + 1} of {benefits.length}
        </span>
      </div>

      <div
        className="relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBenefit}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <Card className="bg-white/[0.07] border-white/10 shadow-xl">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-200/20 to-cyan-200/20 flex items-center justify-center shadow-lg">
                    {React.cloneElement(current.icon, {
                      className: "w-10 h-10 text-emerald-300",
                    })}
                  </div>
                </div>

                <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-sm mb-4 px-4 py-2 font-bold">
                  ✨ {current.highlight}
                </Badge>

                <h3 className="text-2xl font-bold mb-4 text-white">
                  {current.title}
                </h3>
                <p className="text-slate-300 leading-relaxed text-base mb-6">
                  {current.description}
                </p>

                <div className="bg-gradient-to-r from-emerald-50/10 to-cyan-50/10 border border-emerald-500/20 rounded-xl p-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h4 className="font-bold text-white mb-3 text-sm">
                      What You Get:
                    </h4>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {getBenefitDetails(current.title).map((detail, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + idx * 0.08 }}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          <span className="text-slate-300">{detail}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {currentBenefit === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6"
                  >
                    <Button
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white py-4 font-semibold shadow-xl transition-transform hover:scale-[1.02]"
                      onClick={() => {
                        const el = document.getElementById("pilot-waitlist");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Reserve Your Free Spot
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            currentBenefit > 0 && setCurrentBenefit(currentBenefit - 1)
          }
          disabled={currentBenefit === 0}
          className={mobileNavBtnClass}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Previous
        </Button>

        <div className="flex gap-1">
          {benefits.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBenefit(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentBenefit ? "bg-emerald-500 w-4" : "bg-slate-500/40"}`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            currentBenefit < benefits.length - 1 &&
            setCurrentBenefit(currentBenefit + 1)
          }
          disabled={currentBenefit === benefits.length - 1}
          className={mobileNavBtnClass}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {currentBenefit === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-center mt-4"
        >
          <p className="text-xs text-slate-400">
            👆 Swipe left/right to see all benefits
          </p>
        </motion.div>
      )}
    </div>
  );
}

function getBenefitDetails(title) {
  const details = {
    "Zero Risk": [
      "Free two-visit pilot (~10 days)",
      "No credit card or contract",
      "We handle setup end-to-end",
      "Clear next steps after demo",
    ],
    "Premium Hardware": [
      "Apple Vision Pro demo day",
      "We bring devices on-site",
      "Hands-on staff training",
      "No hardware purchase required",
    ],
    "Real Analytics": [
      "Dwell time & interactions",
      "Conversion signals",
      "Simple, actionable recap",
      "Use results to plan rollout",
    ],
    "Future-Ready": [
      "First-mover advantage",
      "Modern, shareable experiences",
      "Competitive differentiation",
      "Press-worthy innovation",
    ],
  };
  return (
    details[title] || [
      "Enhanced customer experience",
      "Business growth opportunities",
      "Technology advancement",
      "Competitive edge",
    ]
  );
}

// -----------------------------------------------
// Mobile: Business Types Carousel (dark theme)
// -----------------------------------------------
function MobileBusinessTypesCarousel({ idealFor }) {
  const [currentType, setCurrentType] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const current = idealFor[currentType];

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dist = touchStart - touchEnd;
    if (dist > 50 && currentType < idealFor.length - 1)
      setCurrentType(currentType + 1);
    if (dist < -50 && currentType > 0) setCurrentType(currentType - 1);
  };

  return (
    <div className="relative px-4">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl md:text-3xl font-black mb-3 text-white">
          Built for Physical Spaces
        </h2>
        <p className="text-sm text-slate-300">
          If customers visit in person, Blueprint fits
        </p>
      </motion.div>

      <div className="text-center mb-4">
        <span className="text-sm font-medium text-slate-400">
          {currentType + 1} of {idealFor.length} Business Types
        </span>
      </div>

      <div
        className="relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentType}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <Card className="bg-white/[0.07] border-white/10 shadow-xl">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-200/20 to-cyan-200/20 flex items-center justify-center shadow-lg">
                    {React.cloneElement(current.icon, {
                      className: "w-10 h-10 text-emerald-300",
                    })}
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">
                  {current.title}
                </h3>
                <p className="text-slate-300 leading-relaxed text-base mb-6">
                  {current.description}
                </p>
                <div className="bg-gradient-to-r from-emerald-50/10 to-cyan-50/10 border border-emerald-500/20 rounded-xl p-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h4 className="font-bold text-white mb-3 text-sm">
                      Great for:
                    </h4>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {getUseCaseExamples(current.title).map((u, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + idx * 0.08 }}
                          className="flex items-center gap-2"
                        >
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          <span className="text-slate-300">{u}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => currentType > 0 && setCurrentType(currentType - 1)}
          disabled={currentType === 0}
          className={mobileNavBtnClass}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Previous
        </Button>
        <div className="flex gap-1">
          {idealFor.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentType(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentType ? "bg-emerald-500 w-4" : "bg-slate-500/40"}`}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            currentType < idealFor.length - 1 && setCurrentType(currentType + 1)
          }
          disabled={currentType === idealFor.length - 1}
          className={mobileNavBtnClass}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {currentType === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-center mt-4"
        >
          <p className="text-xs text-slate-400">
            👆 Swipe left/right to explore
          </p>
        </motion.div>
      )}
    </div>
  );
}

function getUseCaseExamples(type) {
  const ex = {
    "Retail & Grocery Stores": [
      "Interactive product info",
      "Virtual try-ons",
      "Smart promos by aisle",
      "Loyalty & rewards moments",
    ],
    "Museums & Galleries": [
      "Immersive guides",
      "Contextual stories",
      "Kid-friendly quests",
      "Multi-language layers",
    ],
    "Restaurants & Cafes": [
      "3D menu previews",
      "Allergen & nutrition info",
      "Pairing suggestions",
      "At-table ordering",
    ],
    "Real Estate & Showrooms": [
      "Virtual staging",
      "Configurable options",
      "Feature highlights",
      "Guided walkthroughs",
    ],
  };
  return (
    ex[type] || [
      "Interactive experiences",
      "Higher engagement",
      "Less friction",
      "Delight on site",
    ]
  );
}

// -----------------------------------------------
// Mobile: Timeline Carousel (neutral card, brand accents)
// -----------------------------------------------
function MobileTimelineCarousel({ timeline }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dist = touchStart - touchEnd;
    if (dist > 50 && currentStep < timeline.length - 1)
      setCurrentStep(currentStep + 1);
    if (dist < -50 && currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = timeline[currentStep];

  return (
    <div className="relative">
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          {timeline.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${idx === currentStep ? `w-8 bg-gradient-to-r ${step.color}` : idx < currentStep ? "w-2 bg-emerald-400" : "w-2 bg-slate-500/40"}`}
            />
          ))}
        </div>
      </div>

      <div className="text-center mb-6">
        <span className="text-sm font-medium text-slate-300">
          Step {currentStep + 1} of {timeline.length}
        </span>
      </div>

      <div
        className="relative overflow-hidden"
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
            <Card className="bg-white/[0.07] border-white/10 shadow-xl">
              <CardContent className="p-6">
                <div className="flex justify-center mb-6">
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg text-white`}
                  >
                    {React.cloneElement(step.icon, { className: "w-7 h-7" })}
                  </div>
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2 text-white">
                    {step.title}
                  </h3>
                  <p className="text-emerald-300 font-semibold text-lg">
                    {step.subtitle}
                  </p>
                </div>
                <p className="text-slate-300 mb-6 text-center leading-relaxed">
                  {step.description}
                </p>
                <div className="space-y-3 mb-6">
                  {step.details.map((d, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{d}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="text-center">
                  <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 px-4 py-2 text-sm font-semibold">
                    ✨ {step.benefit}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className={mobileNavBtnClass}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Previous
        </Button>
        <div className="flex gap-1">
          {timeline.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-colors ${idx === currentStep ? "bg-emerald-500" : "bg-slate-500/40"}`}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setCurrentStep((s) => Math.min(timeline.length - 1, s + 1))
          }
          disabled={currentStep === timeline.length - 1}
          className={mobileNavBtnClass}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {currentStep === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-center mt-4"
        >
          <p className="text-xs text-slate-400">👆 Swipe or tap to navigate</p>
        </motion.div>
      )}
    </div>
  );
}

// -----------------------------------------------
// Mobile: FAQ Carousel (dark theme)
// -----------------------------------------------
function MobileFAQCarousel({ faqs = [] }) {
  const [currentFaq, setCurrentFaq] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  if (!faqs.length) return null;
  const currentFaqData = faqs[currentFaq];

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dist = touchStart - touchEnd;
    if (dist > 50 && currentFaq < faqs.length - 1)
      setCurrentFaq(currentFaq + 1);
    if (dist < -50 && currentFaq > 0) setCurrentFaq(currentFaq - 1);
  };

  return (
    <div className="relative px-4">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl md:text-3xl font-black mb-3 text-white">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-slate-300">Short answers. Straight talk.</p>
      </motion.div>

      <div className="text-center mb-4">
        <span className="text-sm font-medium text-slate-400">
          Q{currentFaq + 1} of {faqs.length}
        </span>
      </div>

      <div
        className="relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFaq}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <Card className="bg-white/[0.07] border-white/10 shadow-xl">
              <CardContent className="p-6">
                <div className="mb-4">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">Q</span>
                    </div>
                    <h3 className="text-lg font-bold text-white leading-tight">
                      {currentFaqData.q}
                    </h3>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">A</span>
                  </div>
                  <div className="flex-1">
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-slate-300 leading-relaxed text-sm"
                    >
                      {currentFaqData.a}
                    </motion.p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => currentFaq > 0 && setCurrentFaq(currentFaq - 1)}
          disabled={currentFaq === 0}
          className={mobileNavBtnClass}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Previous
        </Button>

        <div className="flex gap-1">
          {faqs.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentFaq(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentFaq ? "bg-emerald-500 w-4" : "bg-slate-500/40"}`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            currentFaq < faqs.length - 1 && setCurrentFaq(currentFaq + 1)
          }
          disabled={currentFaq === faqs.length - 1}
          className={mobileNavBtnClass}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {currentFaq === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-center mt-4"
        >
          <p className="text-xs text-slate-400">👆 Swipe to browse more</p>
        </motion.div>
      )}
    </div>
  );
}

// -----------------------------------------------
// Page Component
// -----------------------------------------------
export default function PilotProgram() {
  const videoRef = useRef(null);
  const [activeTab, setActiveTab] = useState("what");
  const [selectedFaq, setSelectedFaq] = useState(null);

  const handleWatchDemo = () => {
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
  };

  const showPilotToast = () => {
    toast.custom(
      (t) => (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-600 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">
                Pilot Access Required
              </h3>
              <p className="text-sm text-slate-600">
                Check your email for invitation
              </p>
            </div>
          </div>
          <p className="text-slate-700 mb-4 text-sm leading-relaxed">
            Use the unique URL we sent to your email to access the pilot
            experience for your venue.
          </p>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Didn’t receive an invitation yet?
            </p>
            <button
              onClick={() => {
                toast.dismiss(t);
                const el = document.getElementById("pilot-waitlist");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
            >
              Reserve a Pilot Spot
            </button>
            <button
              onClick={() => toast.dismiss(t)}
              className="w-full text-slate-500 hover:text-slate-700 px-4 py-2 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      ),
      { duration: 6000, position: "top-center" },
    );
  };

  // 10-day flow for clarity
  const timeline = [
    {
      icon: <MapPin className="w-6 h-6" />,
      title: "Visit 1",
      subtitle: "30–60 min Mapping",
      description:
        "We scan your venue with LiDAR to create a precise digital twin—fast, quiet, and disruption-free.",
      color: "from-emerald-500 to-cyan-500",
      benefit: "Zero prep on your side",
      details: [
        "Under 5,000 sq ft in ~30–60 min",
        "Larger spaces in 1–2 hrs",
        "Millimeter-accurate model",
      ],
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Between Visits (~1 week)",
      subtitle: "Design & Build",
      description:
        "We design a brand-aligned AR layer with smart placements and interactions.",
      color: "from-cyan-500 to-teal-500",
      benefit: "Tailored to your venue",
      details: ["AI-assisted content", "Review checkpoint (async)", "QR plan"],
    },
    {
      icon: <Wand2 className="w-6 h-6" />,
      title: "Prep & Briefing",
      subtitle: "We get your team ready",
      description:
        "We place/ship QR kits, finish polish, and share a quick briefing so demo day runs smoothly.",
      color: "from-teal-500 to-emerald-500",
      benefit: "Smooth demo day",
      details: ["QR placement", "Final adjustments", "Team briefing"],
    },
    {
      icon: <PlayCircle className="w-6 h-6" />,
      title: "Visit 2",
      subtitle: "Live Demo Day (1–2 hrs)",
      description:
        "We bring Apple Vision Pro and run the demo end-to-end. Your team tries it hands-on; we handle devices, setup, and sanitization. The AR is live during the scheduled demo window only.",
      color: "from-emerald-400 to-cyan-400",
      benefit: "Hands-on, on-site",
      details: ["Vision Pro", "Team walkthrough", "Immediate insights"],
    },
  ];
  // const timeline = [
  //   {
  //     icon: <MapPin className="w-6 h-6" />,
  //     title: "Day 1",
  //     subtitle: "30–60 min Mapping",
  //     description:
  //       "We scan your venue with LiDAR to create a precise digital twin—fast, quiet, and disruption-free.",
  //     color: "from-emerald-500 to-cyan-500",
  //     benefit: "Zero prep on your side",
  //     details: [
  //       "Under 5,000 sq ft in ~30–60 min",
  //       "Larger spaces in 1–2 hrs",
  //       "Millimeter-accurate model",
  //     ],
  //   },
  //   {
  //     icon: <Sparkles className="w-6 h-6" />,
  //     title: "Week 1",
  //     subtitle: "AI-Powered Creation",
  //     description:
  //       "We design a custom AR layer for your space—brand-aligned, interactive, and purposeful.",
  //     color: "from-cyan-500 to-teal-500",
  //     benefit: "Tailored to your venue",
  //     details: [
  //       "AI-generated content",
  //       "Smart triggers & placements",
  //       "Review checkpoints",
  //     ],
  //   },
  //   {
  //     icon: <Wand2 className="w-6 h-6" />,
  //     title: "Week 1",
  //     subtitle: "Fine-Tune & Prep",
  //     description:
  //       "We place QR codes, finish polish, and brief your team for a smooth reveal.",
  //     color: "from-teal-500 to-emerald-500",
  //     benefit: "Polished to perfection",
  //     details: ["QR placement plan", "Final adjustments", "Staff briefing"],
  //   },
  //   {
  //     icon: <PlayCircle className="w-6 h-6" />,
  //     title: "Week 2",
  //     subtitle: "Live Demo Day",
  //     description:
  //       "See your space come alive on Apple Vision Pro and other devices. Collect instant feedback.",
  //     color: "from-emerald-400 to-cyan-400",
  //     benefit: "Hands-on, on-site",
  //     details: ["Vision Pro demo", "Team training", "Immediate insights"],
  //   },
  // ];

  const idealFor = [
    {
      icon: <Store className="w-8 h-8" />,
      title: "Retail & Grocery Stores",
      description:
        "Turn aisles into interactive guides with try-ons, demos, and smart offers.",
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Museums & Galleries",
      description:
        "Layer stories, audio, and guided tours onto exhibits for every visitor.",
    },
    {
      icon: <UtensilsCrossed className="w-8 h-8" />,
      title: "Restaurants & Cafes",
      description:
        "Help guests choose with 3D menu previews, nutrition info, and pairings.",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Real Estate & Showrooms",
      description:
        "Let buyers explore configurations, features, and scaled models—on site.",
    },
  ];

  const benefits = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Zero Risk",
      description:
        "A two-visit pilot (~10 days) that’s free and feedback-only.",
      highlight: "100% FREE",
    },
    {
      icon: <Monitor className="w-6 h-6" />,
      title: "Premium Hardware",
      description: "We bring an Apple Vision Pro to your demo day.",
      highlight: "No hardware needed",
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Real Analytics",
      description:
        "See what people engage with—dwell time, interactions, and more.",
      highlight: "Data you can act on",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Future-Ready",
      description:
        "Be first to market with a modern, shareable, press-worthy experience.",
      highlight: "First-mover edge",
    },
  ];

  const faqs = [
    {
      q: "What is Blueprint in one sentence?",
      a: "It’s a custom AR layer for your physical space—scan a QR code, and visitors instantly get interactive guidance, stories, and offers on their device.",
    },
    {
      q: "What does the pilot cost?",
      a: "Nothing. The two-visit pilot (~10 days) is free and feedback-only. No contract, and there’s no purchase option yet.",
    },
    {
      q: "How long does mapping take?",
      a: "Most venues under 5,000 sq ft take 30–60 minutes; larger venues 1–2 hours. It’s quiet and won’t disrupt your operations.",
    },
    {
      q: "Do customers need special hardware?",
      a: "No. The AR runs in the browser via QR codes. For demo day, we bring an Apple Vision Pro so your team can try it hands-on.",
    },
    {
      q: "What do you need from us?",
      a: "Access for mapping, some basic business info, and your feedback after demo day. We handle the rest—design, setup, and analytics.",
    },
    {
      q: "Is the AR experience live for two weeks?",
      a: "No. The experience is live during the scheduled demo window (1–2 hours) on Visit 2. The goal is to gather feedback and learn, not to run the experience continuously yet.",
    },
    {
      q: "What happens after the pilot?",
      a: "We'll send out a survey to all participants of the Demo Day asking about the whole Pilot Program experience. Any feedback from this survey helps us improve Blueprint! As of today, there are no options to discuss continuing with a full implementation of Blueprint for your space.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0B1220] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-24 h-[45rem] w-[45rem] rounded-full blur-3xl opacity-40 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-sky-500/10" />
        <div className="absolute -bottom-32 -left-24 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-30 bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-amber-400/10" />
      </div>

      <Toaster richColors position="top-center" />
      <Nav />

      {/* HERO */}
      <section className="mt-6 md:mt-0 pt-16 md:pt-20 lg:pt-32 pb-12 md:pb-16 lg:pb-24 relative overflow-hidden bg-[#0B1220]">
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{ contain: "paint" }}
        >
          <div className="absolute top-20 -right-20 w-96 h-96 bg-emerald-300/10 rounded-full md:blur-xl blur-none will-change-transform" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-300/10 rounded-full md:blur-xl blur-none will-change-transform" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            <FadeIn
              yOffset={20}
              delay={0.1}
              className="flex-1 text-center lg:text-left"
            >
              <Badge className="inline-flex items-center gap-2 bg-emerald-400/10 text-emerald-300 border-emerald-500/30 mb-6 px-4 py-2">
                <Rocket className="w-4 h-4" />
                Durham Pilot — Two visits (~10 days)
              </Badge>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-white">
                Turn Your Space{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-200 bg-clip-text text-transparent">
                  Into a Shareable AR Experience in 10 Days
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-6 md:mb-8 max-w-2xl mx-auto lg:mx-0">
                Two quick visits about a week apart: mapping (~60 min) and an
                on-site demo (1–2 hrs). Free and feedback-only. No apps to
                install—guests just scan a QR code.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Button
                  size="lg"
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white px-6 sm:px-8 py-6 text-base sm:text-lg font-bold shadow-xl transition-transform hover:scale-[1.02]"
                  onClick={showPilotToast}
                >
                  Reserve Your Free Pilot Spot
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  className="rounded-xl px-6 sm:px-8 py-6 text-base sm:text-lg bg-white/90 text-slate-900 border border-white/60 backdrop-blur hover:bg-white hover:border-white"
                  onClick={handleWatchDemo}
                  aria-label="Watch 2-minute demo video"
                >
                  <Video className="mr-2 w-5 h-5 text-emerald-600" />
                  Watch 2-min demo
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 md:gap-4 mb-2 text-xs md:text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-slate-200">No app downloads</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-slate-200">
                    Works on all smart glasses
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-slate-200">We handle everything</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Note: The AR experience is live during the scheduled demo window
                only.
              </p>
            </FadeIn>

            <FadeIn
              yOffset={20}
              delay={0.2}
              className="flex-1 w-full max-w-2xl lg:max-w-none"
              id="demo-video"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-100/10 to-cyan-100/10 z-10 pointer-events-none" />
                <video
                  ref={videoRef}
                  className="w-full aspect-video object-cover"
                  src="/videos/blueprint-website-demo2.mp4"
                  controls
                  preload="metadata"
                  playsInline
                  controlsList="nodownload"
                  decoding="async"
                  poster="/images/demo-poster.jpg"
                />
              </div>
              <p className="text-center text-sm text-slate-400 mt-4">
                A quick look at Blueprint in a real space
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF / KEY METRICS */}
      <section className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: "Investment Required",
              value: "$0",
              icon: <DollarSign className="w-6 h-6" />,
              description: "Completely free pilot",
              gradient: "from-green-500 to-emerald-500",
            },
            {
              label: "Time to Launch",
              value: "10 days",
              icon: <Clock className="w-6 h-6" />,
              description: "From mapping to on-site demo", // ← replace this line
              gradient: "from-cyan-500 to-teal-500",
            },
            {
              label: "Mapping Time",
              value: "30–60 mins*",
              icon: <Zap className="w-6 h-6" />,
              description: "*Typical for <5k sq ft",
              gradient: "from-emerald-400 to-cyan-400",
            },
          ].map((stat, idx) => (
            <FadeIn key={stat.label} yOffset={20} delay={idx * 0.1}>
              <Card className="relative bg-white/90 border-white/10 hover:shadow-xl transition-all group overflow-hidden">
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`}
                />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p
                        className={`text-4xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-1`}
                      >
                        {stat.value}
                      </p>
                      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                        {stat.label}
                      </p>
                      <p className="text-sm text-slate-600 mt-2">
                        {stat.description}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} ring-1 ring-white/20 shadow-md transition-all`}
                    >
                      {React.cloneElement(stat.icon, {
                        className: "w-6 h-6 text-white",
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section
        className="py-16 md:py-24 relative bg-[#0E172A]"
        style={{ contentVisibility: "auto", contain: "paint", containIntrinsicSize: "1px 800px" }}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="block md:hidden">
            <MobileBusinessTypesCarousel idealFor={idealFor} />
          </div>

          <div className="hidden md:block">
            <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                If You Have a Physical Space, You’re a Fit
              </h2>
              <p className="text-lg text-slate-300 max-w-3xl mx-auto">
                From museums to markets, Blueprint adds a digital layer that
                drives engagement and sales.
              </p>
            </FadeIn>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {idealFor.map((item, idx) => (
                <FadeIn
                  key={idx}
                  yOffset={20}
                  delay={idx * 0.1}
                  className="group"
                >
                  <Card className="h-full bg-white/90 border-white/10 hover:shadow-xl transition-all">
                    <CardContent className="p-4 md:p-6 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-200/30 to-cyan-200/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {React.cloneElement(item.icon, {
                          className: "w-8 h-8 text-emerald-600",
                        })}
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-slate-900">
                        {item.title}
                      </h3>
                      <p className="text-slate-600 text-sm">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section
        className="py-16 md:py-24 relative bg-[#0E172A]"
        style={{ contentVisibility: "auto", contain: "paint", containIntrinsicSize: "1px 800px" }}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <FadeIn
            yOffset={20}
            delay={0.1}
            className="text-center mb-12 md:mb-20"
          >
            <Badge className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-300 border-cyan-500/30 mb-6 px-4 py-2">
              <CalendarCheck className="w-4 h-4" />
              Simple Two-Visit Process (~10 days)
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white">
              From First Scan to a Live Demo in ~10 Days
            </h2>
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              We do the heavy lifting—your team just shows up to try it and give
              feedback.
            </p>
          </FadeIn>

          <div className="block md:hidden">
            <MobileTimelineCarousel timeline={timeline} />
          </div>

          <div className="hidden md:block relative max-w-6xl mx-auto">
            <div className="hidden lg:block absolute top-[88px] left-[16.67%] right-[16.67%] h-[3px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 rounded-full shadow-sm" />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-8 relative">
              {timeline.map((step, idx) => (
                <FadeIn
                  key={idx}
                  yOffset={30}
                  delay={idx * 0.12}
                  className="relative"
                >
                  <div className="flex justify-center mb-8 lg:mb-0">
                    <div className="lg:absolute lg:-top-[10px] lg:z-20">
                      <div
                        className={`w-16 h-16 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-xl relative text-white border-4 border-white/90`}
                      >
                        {React.cloneElement(step.icon, {
                          className: "w-7 h-7 lg:w-6 lg:h-6",
                        })}
                      </div>
                    </div>
                  </div>

                  <Card className="h-full bg-white/95 border-white/10 hover:shadow-2xl transition-all duration-300 lg:mt-20 lg:pt-8">
                    <CardContent className="p-6 lg:p-8">
                      <div className="text-center mb-6">
                        <h3 className="text-xl lg:text-2xl font-bold mb-2 text-slate-900">
                          {step.title}
                        </h3>
                        <p className="text-emerald-600 font-semibold text-base lg:text-lg">
                          {step.subtitle}
                        </p>
                      </div>
                      <p className="text-slate-600 mb-6 text-center text-sm lg:text-base leading-relaxed">
                        {step.description}
                      </p>
                      <div className="space-y-3 mb-6">
                        {step.details.map((d, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 text-sm lg:text-base"
                          >
                            <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-700 leading-relaxed">
                              {d}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-slate-200 text-center">
                        <Badge className="bg-cyan-500/10 text-cyan-700 border-cyan-200 px-3 py-1.5 text-sm font-semibold">
                          ✨ {step.benefit}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* EXPLAINER TABS */}
      <section
        className="py-16 md:py-24 relative bg-[#0E172A]"
        style={{ contentVisibility: "auto", contain: "paint", containIntrinsicSize: "1px 800px" }}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              How It Works • Why It Works • What You Get
            </h2>
            <p className="text-lg text-slate-300">
              Short, scannable, and no fluff.
            </p>
          </FadeIn>

          <Tabs
            defaultValue="what"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full max-w-2xl mx-auto bg-white/5 border border-white/10 p-1 rounded-2xl mb-12 grid grid-cols-3">
              <TabsTrigger
                value="what"
                className="rounded-xl py-3 transition-all text-slate-200 data-[state=active]:text-white
                           data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-600"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                What It Is
              </TabsTrigger>
              <TabsTrigger
                value="why"
                className="rounded-xl py-3 transition-all text-slate-200 data-[state=active]:text-white
                           data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-600"
              >
                <Target className="w-4 h-4 mr-2" />
                Why It Works
              </TabsTrigger>
              <TabsTrigger
                value="how"
                className="rounded-xl py-3 transition-all text-slate-200 data-[state=active]:text-white
                           data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-600"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                How It Works
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              {/* WHAT */}
              <TabsContent value="what" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.28 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
                >
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-white">
                      A Smart Digital Layer for Your Space
                    </h3>
                    <p className="text-slate-300 mb-6">
                      Customers point their device at products or exhibits to
                      unlock helpful, branded content—guided tours, 3D previews,
                      offers, and more.
                    </p>
                    <ul className="space-y-4">
                      {[
                        "Interactive product info & 3D models",
                        "Virtual try-ons and configurators",
                        "Guided stories & multi-language support",
                        "Quests, rewards, and social moments",
                        "Real-time offers when interest is high",
                      ].map((item, idx) => (
                        <FadeIn
                          key={idx}
                          Component="li"
                          delay={idx * 0.08}
                          yOffset={8}
                          className="flex items-start gap-3"
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-200">{item}</span>
                        </FadeIn>
                      ))}
                    </ul>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-200/10 to-cyan-200/10 blur-3xl" />
                    <Card className="relative bg-white/5 border-white/10 overflow-hidden shadow-xl">
                      <CardContent className="p-0">
                        <div className="p-6">
                          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 mb-3">
                            <Smartphone className="w-3 h-3 mr-1" />
                            No App Required
                          </Badge>
                          <h4 className="text-xl font-bold mb-2 text-white">
                            Instant Access
                          </h4>
                          <p className="text-slate-300 text-sm">
                            Visitors scan a QR and the AR launches in their
                            browser. Zero friction for guests; zero overhead for
                            your team.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              </TabsContent>

              {/* WHY */}
              <TabsContent value="why" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    <div>
                      <h3 className="text-2xl font-bold mb-6 text-white">
                        Proven to Lift Engagement
                      </h3>
                      <p className="text-slate-300 mb-8">
                        AR reduces decision friction and creates moments people
                        talk about. Expect stronger dwell time, sharing, and
                        conversion.
                      </p>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        {[
                          {
                            metric: "40%",
                            label: "Increase in dwell time",
                            icon: Clock,
                          },
                          {
                            metric: "3.5x",
                            label: "More social shares",
                            icon: Users,
                          },
                          {
                            metric: "28%",
                            label: "Higher conversion",
                            icon: Target,
                          },
                          {
                            metric: "92%",
                            label: "Customer satisfaction",
                            icon: Star,
                          },
                        ].map((stat, idx) => (
                          <FadeIn
                            key={idx}
                            delay={idx * 0.08}
                            yOffset={8}
                            className="bg-white/5 border border-white/10 rounded-xl p-4"
                          >
                            <stat.icon className="w-5 h-5 text-emerald-300 mb-2" />
                            <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text">
                              {stat.metric}
                            </p>
                            <p className="text-xs text-slate-300">
                              {stat.label}
                            </p>
                          </FadeIn>
                        ))}
                      </div>
                    </div>

                    <div className="lg:pl-6">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6 h-full flex flex-col justify-center">
                        <h4 className="font-bold mb-4 text-white">
                          Why it resonates:
                        </h4>
                        <ul className="space-y-2 text-sm text-slate-300">
                          <li>• Memorable, shareable experiences</li>
                          <li>• Instant information without waiting</li>
                          <li>• Clearer choices = faster decisions</li>
                          <li>• Signals innovation to your market</li>
                          <li>• Differentiates your in-person visit</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* HOW */}
              <TabsContent value="how" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.28 }}
                  className="max-w-4xl mx-auto"
                >
                  <h3 className="text-2xl font-bold mb-8 text-center text-white">
                    Under the Hood
                  </h3>

                  <div className="space-y-6">
                    {[
                      {
                        step: "1",
                        title: "LiDAR Space Mapping",
                        description:
                          "We create a millimeter-accurate digital twin of your space as the foundation.",
                        tech: "Apple LiDAR + Custom Algorithms",
                      },
                      {
                        step: "2",
                        title: "AI Content Generation",
                        description:
                          "Our AI + designers tailor content to your brand, products, and flow of the space.",
                        tech: "Computer-Use + Computer Vision Models",
                      },
                      {
                        step: "3",
                        title: "WebXR Deployment",
                        description:
                          "Runs directly in modern browsers—no app to install for guests.",
                        tech: "WebXR + Cloud Infrastructure",
                      },
                      {
                        step: "4",
                        title: "Real-Time Analytics",
                        description:
                          "See engagement and interactions, learn what resonates, and iterate.",
                        tech: "Custom Analytics Platform",
                      },
                    ].map((item, idx) => (
                      <FadeIn
                        key={idx}
                        delay={idx * 0.08}
                        yOffset={8}
                        className="flex gap-6"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center font-bold text-lg text-white">
                            {item.step}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-bold mb-2 text-white">
                            {item.title}
                          </h4>
                          <p className="text-slate-300 mb-2">
                            {item.description}
                          </p>
                          <Badge className="bg-white/5 text-slate-200 border-white/10">
                            <Zap className="w-3 h-3 mr-1" />
                            {item.tech}
                          </Badge>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="benefits-section" className="py-16 md:py-24 bg-[#0E172A]">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          {/* Mobile */}
          <div className="block md:hidden">
            <MobileBenefitsCarousel benefits={benefits} />
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                Why Teams Love the Pilot
              </h2>
              <p className="text-lg text-slate-300 max-w-3xl mx-auto">
                Try the future of on-site engagement with our team guiding every
                step—free.
              </p>
            </FadeIn>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {benefits.map((b, idx) => (
                <FadeIn key={idx} yOffset={20} delay={idx * 0.08}>
                  <Card className="h-full bg-white/5 border-white/10 hover:shadow-2xl transition-all group">
                    <CardContent className="p-4 md:p-6">
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-200/30 to-cyan-200/30 flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                        {React.cloneElement(b.icon, {
                          className: "w-5 h-5 md:w-6 md:h-6 text-emerald-300",
                        })}
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-xs mb-2 md:mb-3">
                        {b.highlight}
                      </Badge>
                      <h3 className="text-lg md:text-xl font-bold mb-2 text-white">
                        {b.title}
                      </h3>
                      <p className="text-slate-300 text-sm md:text-base">
                        {b.description}
                      </p>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>

            <FadeIn yOffset={20} delay={0.3} className="mt-12 text-center">
              <Button
                size="lg"
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white px-8 py-6 text-lg font-bold shadow-xl transition-transform hover:scale-[1.02]"
                onClick={showPilotToast}
              >
                Reserve Your Free Pilot Spot
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <p className="text-slate-400 mt-4 text-sm">
                Limited availability. No credit card required.
              </p>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="py-16 md:py-24 relative bg-[#0E172A]"
        style={{ contentVisibility: "auto", contain: "paint", containIntrinsicSize: "1px 800px" }}
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          {/* Mobile */}
          <div className="block md:hidden">
            <MobileFAQCarousel faqs={faqs} />
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-slate-300">
                If you’re wondering it, someone else asked it too.
              </p>
            </FadeIn>

            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <FadeIn key={idx} yOffset={14} delay={idx * 0.04}>
                  <button
                    className="w-full text-left bg-white/5 hover:bg-white/7.5 border border-white/10 rounded-xl p-6 transition-all"
                    onClick={() =>
                      setSelectedFaq(selectedFaq === idx ? null : idx)
                    }
                    aria-expanded={selectedFaq === idx}
                    aria-controls={`faq-panel-${idx}`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-semibold text-lg pr-8 text-white">
                        {faq.q}
                      </h3>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-300 flex-shrink-0 transition-transform ${selectedFaq === idx ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </div>

                    <AnimatePresence>
                      {selectedFaq === idx && (
                        <motion.div
                          id={`faq-panel-${idx}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28 }}
                          className="overflow-hidden"
                        >
                          <p className="text-slate-300 mt-4 leading-relaxed">
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </FadeIn>
              ))}
            </div>

            <FadeIn
              yOffset={20}
              delay={0.1}
              className="mt-12 p-8 rounded-2xl bg-white/5 border border-white/10 text-center"
            >
              <h3 className="text-2xl font-bold mb-4 text-white">
                Still Have Questions?
              </h3>
              <p className="text-slate-300 mb-6">
                We’ll tailor the pilot to your space and goals. Let’s talk.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="outline"
                  className="border-white/30 text-slate-900 hover:bg-white/90 hover:text-slate-900"
                  asChild
                >
                  <a
                    href="mailto:nijel@tryblueprint.io"
                    aria-label="Email the Blueprint team"
                  >
                    <Send className="mr-2 w-4 h-4" />
                    Email Us
                  </a>
                </Button>
                <Button
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white"
                  asChild
                >
                  <a
                    href="https://calendly.com/blueprintar/30min"
                    aria-label="Schedule a call with Blueprint"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Schedule a Call
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                </Button>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* WAITLIST CONTACT FORM (light surface for readability) */}
      <section
        id="pilot-waitlist"
        className="bg-[#0B1220] border-t border-white/10"
      >
        <ContactForm />
        <div className="px-4 sm:px-6 max-w-4xl mx-auto pb-12">
          <p className="text-center text-slate-300 text-sm mt-4">
            Durham, NC pilot enrolling now. Austin, TX may open next—join the
            list to be notified.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// // This file defines the PilotProgram page component.
// // This page provides detailed information about the Blueprint pilot program,
// // including its benefits, timeline, ideal candidates, and FAQs.
// // It also includes a call-to-action to join the waitlist via a contact form.

// import React, { useState, useEffect, useRef } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import FadeIn from "@/components/FadeIn";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Badge } from "@/components/ui/badge";
// import Nav from "@/components/Nav";
// // Add these to your existing imports
// import { toast } from "sonner"; // You'll need to install sonner: npm install sonner
// import { Toaster } from "sonner";
// import ContactForm from "@/components/sections/ContactForm"; // Import your ContactForm
// import Footer from "@/components/Footer";
// import {
//   Rocket,
//   MapPin,
//   Camera,
//   Wand2,
//   PlayCircle,
//   Users,
//   ClipboardList,
//   CalendarCheck,
//   CheckCircle2,
//   UtensilsCrossed,
//   Clock,
//   DollarSign,
//   Award,
//   ArrowRight,
//   ChevronRight,
//   Shield,
//   Zap,
//   Lightbulb,
//   Monitor,
//   Target,
//   UserPlus,
//   Star,
//   ChevronDown,
//   Video,
//   Send,
//   ChevronUp,
//   Sparkles,
//   Store,
//   Palette,
//   Building2,
//   Smartphone,
// } from "lucide-react";

// /**
//  * Mobile-specific benefits carousel component
//  */
// function MobileBenefitsCarousel({ benefits }) {
//   const [currentBenefit, setCurrentBenefit] = useState(0);
//   const [touchStart, setTouchStart] = useState(null);
//   const [touchEnd, setTouchEnd] = useState(null);

//   const currentBenefitData = benefits[currentBenefit];

//   // Handle touch events for swipe
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

//     if (isLeftSwipe && currentBenefit < benefits.length - 1) {
//       setCurrentBenefit(currentBenefit + 1);
//     }
//     if (isRightSwipe && currentBenefit > 0) {
//       setCurrentBenefit(currentBenefit - 1);
//     }
//   };

//   return (
//     <div className="relative px-4">
//       {/* Compact Header */}
//       <motion.div
//         className="text-center mb-8"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6 }}
//       >
//         <h2 className="text-2xl md:text-3xl font-black mb-3 text-slate-900">
//           Why Join the Pilot Program?
//         </h2>
//         <p className="text-sm text-slate-600 leading-relaxed">
//           Experience the future of customer engagement with zero risk
//         </p>
//       </motion.div>

//       {/* Benefit Counter */}
//       <div className="text-center mb-4">
//         <span className="text-sm font-medium text-slate-500">
//           Benefit {currentBenefit + 1} of {benefits.length}
//         </span>
//       </div>

//       {/* Benefit Card */}
//       <div
//         className="relative overflow-hidden"
//         onTouchStart={onTouchStart}
//         onTouchMove={onTouchMove}
//         onTouchEnd={onTouchEnd}
//       >
//         <AnimatePresence mode="wait">
//           <motion.div
//             key={currentBenefit}
//             initial={{ x: 300, opacity: 0 }}
//             animate={{ x: 0, opacity: 1 }}
//             exit={{ x: -300, opacity: 0 }}
//             transition={{ type: "spring", stiffness: 300, damping: 30 }}
//           >
//             <Card className="bg-white border-slate-200 shadow-xl">
//               <CardContent className="p-6 text-center">
//                 {/* Icon */}
//                 <div className="flex justify-center mb-6">
//                   <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-lg">
//                     {React.cloneElement(currentBenefitData.icon, {
//                       className: "w-10 h-10 text-indigo-600",
//                     })}
//                   </div>
//                 </div>

//                 {/* Highlight Badge */}
//                 <Badge className="bg-green-100 text-green-700 border-green-200 text-sm mb-4 px-4 py-2 font-bold">
//                   ✨ {currentBenefitData.highlight}
//                 </Badge>

//                 {/* Title */}
//                 <h3 className="text-2xl font-bold mb-4 text-slate-900">
//                   {currentBenefitData.title}
//                 </h3>

//                 {/* Description */}
//                 <p className="text-slate-600 leading-relaxed text-base mb-6">
//                   {currentBenefitData.description}
//                 </p>

//                 {/* Key Points */}
//                 <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4">
//                   <motion.div
//                     initial={{ opacity: 0, y: 10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ delay: 0.2 }}
//                   >
//                     <h4 className="font-bold text-slate-900 mb-3 text-sm">
//                       What This Means For You:
//                     </h4>
//                     <div className="grid grid-cols-1 gap-2 text-xs">
//                       {getBenefitDetails(currentBenefitData.title).map(
//                         (detail, idx) => (
//                           <motion.div
//                             key={idx}
//                             initial={{ opacity: 0, x: -10 }}
//                             animate={{ opacity: 1, x: 0 }}
//                             transition={{ delay: 0.3 + idx * 0.1 }}
//                             className="flex items-center gap-2"
//                           >
//                             <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
//                             <span className="text-slate-700">{detail}</span>
//                           </motion.div>
//                         ),
//                       )}
//                     </div>
//                   </motion.div>
//                 </div>

//                 {/* CTA for first benefit */}
//                 {currentBenefit === 0 && (
//                   <motion.div
//                     initial={{ opacity: 0, y: 20 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ delay: 0.4 }}
//                     className="mt-6"
//                   >
//                     <Button
//                       className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
//                       onClick={() => {
//                         // Scroll to contact form or show pilot toast
//                         const contactFormElement =
//                           document.getElementById("pilot-waitlist");
//                         if (contactFormElement) {
//                           contactFormElement.scrollIntoView({
//                             behavior: "smooth",
//                           });
//                         }
//                       }}
//                     >
//                       Reserve Your Free Pilot Spot
//                       <ArrowRight className="w-5 h-5 ml-2" />
//                     </Button>
//                   </motion.div>
//                 )}
//               </CardContent>
//             </Card>
//           </motion.div>
//         </AnimatePresence>
//       </div>

//       {/* Navigation Controls */}
//       <div className="flex justify-between items-center mt-6">
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() =>
//             currentBenefit > 0 && setCurrentBenefit(currentBenefit - 1)
//           }
//           disabled={currentBenefit === 0}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           <ChevronRight className="w-4 h-4 rotate-180" />
//           Previous
//         </Button>

//         <div className="flex gap-1">
//           {benefits.map((_, idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentBenefit(idx)}
//               className={`w-2 h-2 rounded-full transition-all duration-300 ${
//                 idx === currentBenefit ? "bg-indigo-600 w-4" : "bg-slate-300"
//               }`}
//             />
//           ))}
//         </div>

//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() =>
//             currentBenefit < benefits.length - 1 &&
//             setCurrentBenefit(currentBenefit + 1)
//           }
//           disabled={currentBenefit === benefits.length - 1}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           Next
//           <ChevronRight className="w-4 h-4" />
//         </Button>
//       </div>

//       {/* Swipe Hint */}
//       {currentBenefit === 0 && (
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 1 }}
//           className="text-center mt-4"
//         >
//           <p className="text-xs text-slate-500">
//             👆 Swipe left/right to see all benefits
//           </p>
//         </motion.div>
//       )}

//       {/* Quick Access Icons */}
//       <motion.div
//         className="mt-8 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.3 }}
//       >
//         <h4 className="font-bold text-slate-900 mb-3 text-sm text-center">
//           All Benefits at a Glance
//         </h4>
//         <div className="flex justify-center gap-3">
//           {benefits.map((benefit, idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentBenefit(idx)}
//               className={`p-3 rounded-xl transition-all ${
//                 idx === currentBenefit
//                   ? "bg-indigo-600 text-white shadow-lg scale-110"
//                   : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200"
//               }`}
//               title={benefit.title}
//             >
//               {React.cloneElement(benefit.icon, {
//                 className: "w-5 h-5",
//               })}
//             </button>
//           ))}
//         </div>
//       </motion.div>

//       {/* Final CTA */}
//       <motion.div
//         className="mt-6 text-center"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.4 }}
//       >
//         <p className="text-sm text-slate-600 mb-3">
//           Ready to experience the future of customer engagement?
//         </p>
//         <div className="flex flex-col gap-2">
//           <Button
//             className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 px-6 py-3 text-sm font-semibold"
//             onClick={() => {
//               const contactFormElement =
//                 document.getElementById("pilot-waitlist");
//               if (contactFormElement) {
//                 contactFormElement.scrollIntoView({ behavior: "smooth" });
//               }
//             }}
//           >
//             Start Your Free 2-Week Program
//             <ArrowRight className="ml-2 w-4 h-4" />
//           </Button>
//           <p className="text-xs text-slate-500">No credit card required</p>
//         </div>
//       </motion.div>
//     </div>
//   );
// }

// // Helper function to get benefit details
// function getBenefitDetails(benefitTitle) {
//   const details = {
//     "Zero Risk": [
//       "No upfront costs or commitments",
//       "Test before you invest",
//       "Full support throughout trial",
//       "No hidden fees or surprises",
//     ],
//     "Premium Hardware": [
//       "Apple Vision Pro demos included",
//       "Latest AR technology access",
//       "Professional setup & training",
//       "Hardware experts on-site",
//     ],
//     "Real Analytics": [
//       "Customer engagement metrics",
//       "ROI measurement tools",
//       "Actionable insights provided",
//       "Performance optimization tips",
//     ],
//     "Future-Ready": [
//       "First-mover advantage",
//       "Next-gen customer experiences",
//       "Competitive differentiation",
//       "Innovation leadership",
//     ],
//   };

//   return (
//     details[benefitTitle] || [
//       "Enhanced customer experience",
//       "Business growth opportunities",
//       "Technology advancement",
//       "Competitive advantage",
//     ]
//   );
// }

// /**
//  * Mobile-specific business types carousel component
//  */
// function MobileBusinessTypesCarousel({ idealFor }) {
//   const [currentType, setCurrentType] = useState(0);
//   const [touchStart, setTouchStart] = useState(null);
//   const [touchEnd, setTouchEnd] = useState(null);

//   const currentBusiness = idealFor[currentType];

//   // Handle touch events for swipe
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

//     if (isLeftSwipe && currentType < idealFor.length - 1) {
//       setCurrentType(currentType + 1);
//     }
//     if (isRightSwipe && currentType > 0) {
//       setCurrentType(currentType - 1);
//     }
//   };

//   return (
//     <div className="relative px-4">
//       {/* Compact Header */}
//       <motion.div
//         className="text-center mb-8"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6 }}
//       >
//         <h2 className="text-2xl md:text-3xl font-black mb-3 text-slate-900">
//           Perfect For Forward-Thinking Businesses
//         </h2>
//         <p className="text-sm text-slate-600 leading-relaxed">
//           If you have a physical space, Blueprint is for you
//         </p>
//       </motion.div>

//       {/* Business Type Counter */}
//       <div className="text-center mb-4">
//         <span className="text-sm font-medium text-slate-500">
//           {currentType + 1} of {idealFor.length} Business Types
//         </span>
//       </div>

//       {/* Business Type Card */}
//       <div
//         className="relative overflow-hidden"
//         onTouchStart={onTouchStart}
//         onTouchMove={onTouchMove}
//         onTouchEnd={onTouchEnd}
//       >
//         <AnimatePresence mode="wait">
//           <motion.div
//             key={currentType}
//             initial={{ x: 300, opacity: 0 }}
//             animate={{ x: 0, opacity: 1 }}
//             exit={{ x: -300, opacity: 0 }}
//             transition={{ type: "spring", stiffness: 300, damping: 30 }}
//           >
//             <Card className="bg-white border-slate-200 shadow-xl">
//               <CardContent className="p-6 text-center">
//                 {/* Icon */}
//                 <div className="flex justify-center mb-6">
//                   <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shadow-lg">
//                     {React.cloneElement(currentBusiness.icon, {
//                       className: "w-10 h-10 text-indigo-600",
//                     })}
//                   </div>
//                 </div>

//                 {/* Title */}
//                 <h3 className="text-2xl font-bold mb-4 text-slate-900">
//                   {currentBusiness.title}
//                 </h3>

//                 {/* Description */}
//                 <p className="text-slate-600 leading-relaxed text-base mb-6">
//                   {currentBusiness.description}
//                 </p>

//                 {/* Use Case Examples */}
//                 <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4">
//                   <motion.div
//                     initial={{ opacity: 0, y: 10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ delay: 0.2 }}
//                   >
//                     <h4 className="font-bold text-slate-900 mb-3 text-sm">
//                       Perfect For:
//                     </h4>
//                     <div className="grid grid-cols-1 gap-2 text-xs">
//                       {getUseCaseExamples(currentBusiness.title).map(
//                         (useCase, idx) => (
//                           <motion.div
//                             key={idx}
//                             initial={{ opacity: 0, x: -10 }}
//                             animate={{ opacity: 1, x: 0 }}
//                             transition={{ delay: 0.3 + idx * 0.1 }}
//                             className="flex items-center gap-2"
//                           >
//                             <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
//                             <span className="text-slate-700">{useCase}</span>
//                           </motion.div>
//                         ),
//                       )}
//                     </div>
//                   </motion.div>
//                 </div>
//               </CardContent>
//             </Card>
//           </motion.div>
//         </AnimatePresence>
//       </div>

//       {/* Navigation Controls */}
//       <div className="flex justify-between items-center mt-6">
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() => currentType > 0 && setCurrentType(currentType - 1)}
//           disabled={currentType === 0}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           <ChevronRight className="w-4 h-4 rotate-180" />
//           Previous
//         </Button>

//         <div className="flex gap-1">
//           {idealFor.map((_, idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentType(idx)}
//               className={`w-2 h-2 rounded-full transition-all duration-300 ${
//                 idx === currentType ? "bg-indigo-600 w-4" : "bg-slate-300"
//               }`}
//             />
//           ))}
//         </div>

//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() =>
//             currentType < idealFor.length - 1 && setCurrentType(currentType + 1)
//           }
//           disabled={currentType === idealFor.length - 1}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           Next
//           <ChevronRight className="w-4 h-4" />
//         </Button>
//       </div>

//       {/* Swipe Hint */}
//       {currentType === 0 && (
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 1 }}
//           className="text-center mt-4"
//         >
//           <p className="text-xs text-slate-500">
//             👆 Swipe left/right to see more business types
//           </p>
//         </motion.div>
//       )}

//       {/* Quick Access Buttons */}
//       <motion.div
//         className="mt-8 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.3 }}
//       >
//         <h4 className="font-bold text-slate-900 mb-3 text-sm text-center">
//           Quick Access
//         </h4>
//         <div className="grid grid-cols-2 gap-2">
//           {idealFor.map((business, idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentType(idx)}
//               className={`p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
//                 idx === currentType
//                   ? "bg-indigo-600 text-white"
//                   : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200"
//               }`}
//             >
//               {React.cloneElement(business.icon, {
//                 className: "w-4 h-4 flex-shrink-0",
//               })}
//               <span className="truncate">
//                 {business.title.split("&")[0].trim()}
//               </span>
//             </button>
//           ))}
//         </div>
//       </motion.div>

//       {/* Compact Summary */}
//       <motion.div
//         className="mt-6 text-center"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.4 }}
//       >
//         <p className="text-sm text-slate-600 mb-3">
//           Ready to transform your space?
//         </p>
//         <Button
//           size="sm"
//           className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 px-6 py-2 text-sm"
//           onClick={() => {
//             // Scroll to contact form or pilot signup
//             const contactFormElement =
//               document.getElementById("pilot-waitlist");
//             if (contactFormElement) {
//               contactFormElement.scrollIntoView({ behavior: "smooth" });
//             }
//           }}
//         >
//           Start Free Pilot Program
//           <ArrowRight className="ml-2 w-4 h-4" />
//         </Button>
//       </motion.div>
//     </div>
//   );
// }

// // Helper function to get use case examples for each business type
// function getUseCaseExamples(businessType) {
//   const examples = {
//     "Retail & Grocery Stores": [
//       "Product information on demand",
//       "Virtual try-on experiences",
//       "Interactive shopping lists",
//       "Promotional offers",
//     ],
//     "Museums & Galleries": [
//       "Immersive historical tours",
//       "Interactive art experiences",
//       "Multi-language guides",
//       "Educational content",
//     ],
//     "Restaurants & Cafes": [
//       "3D menu visualization",
//       "Nutritional information",
//       "Order customization",
//       "Table service enhancement",
//     ],
//     "Real Estate & Showrooms": [
//       "Virtual property staging",
//       "Product customization",
//       "Space visualization",
//       "Feature highlights",
//     ],
//   };

//   return (
//     examples[businessType] || [
//       "Interactive experiences",
//       "Customer engagement",
//       "Information access",
//       "Enhanced service",
//     ]
//   );
// }

// /**
//  * Mobile-specific FAQ carousel component
//  */
// function MobileFAQCarousel({ faqs }) {
//   const [currentFaq, setCurrentFaq] = useState(0);
//   const [touchStart, setTouchStart] = useState(null);
//   const [touchEnd, setTouchEnd] = useState(null);

//   const currentFaqData = faqs[currentFaq];

//   // Handle touch events for swipe
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

//     if (isLeftSwipe && currentFaq < faqs.length - 1) {
//       setCurrentFaq(currentFaq + 1);
//     }
//     if (isRightSwipe && currentFaq > 0) {
//       setCurrentFaq(currentFaq - 1);
//     }
//   };

//   return (
//     <div className="relative">
//       {/* Compact Header */}
//       <motion.div
//         className="text-center mb-6"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6 }}
//       >
//         <h2 className="text-2xl md:text-3xl font-black mb-3 text-slate-900">
//           Frequently Asked Questions
//         </h2>
//         <p className="text-sm text-slate-600">
//           Got questions? We've got answers.
//         </p>
//       </motion.div>

//       {/* FAQ Counter */}
//       <div className="text-center mb-4">
//         <span className="text-sm font-medium text-slate-500">
//           Question {currentFaq + 1} of {faqs.length}
//         </span>
//       </div>

//       {/* FAQ Card */}
//       <div
//         className="relative overflow-hidden"
//         onTouchStart={onTouchStart}
//         onTouchMove={onTouchMove}
//         onTouchEnd={onTouchEnd}
//       >
//         <AnimatePresence mode="wait">
//           <motion.div
//             key={currentFaq}
//             initial={{ x: 300, opacity: 0 }}
//             animate={{ x: 0, opacity: 1 }}
//             exit={{ x: -300, opacity: 0 }}
//             transition={{ type: "spring", stiffness: 300, damping: 30 }}
//           >
//             <Card className="bg-white border-slate-200 shadow-xl">
//               <CardContent className="p-6">
//                 {/* Question */}
//                 <div className="mb-4">
//                   <div className="flex items-start gap-3 mb-4">
//                     <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
//                       <span className="text-white font-bold text-sm">Q</span>
//                     </div>
//                     <h3 className="text-lg font-bold text-slate-900 leading-tight">
//                       {currentFaqData.q}
//                     </h3>
//                   </div>
//                 </div>

//                 {/* Answer */}
//                 <div className="flex items-start gap-3">
//                   <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
//                     <span className="text-white font-bold text-sm">A</span>
//                   </div>
//                   <div className="flex-1">
//                     <motion.p
//                       initial={{ opacity: 0, y: 10 }}
//                       animate={{ opacity: 1, y: 0 }}
//                       transition={{ delay: 0.2 }}
//                       className="text-slate-600 leading-relaxed text-sm"
//                     >
//                       {currentFaqData.a}
//                     </motion.p>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           </motion.div>
//         </AnimatePresence>
//       </div>

//       {/* Navigation Controls */}
//       <div className="flex justify-between items-center mt-6">
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() => currentFaq > 0 && setCurrentFaq(currentFaq - 1)}
//           disabled={currentFaq === 0}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           <ChevronRight className="w-4 h-4 rotate-180" />
//           Previous
//         </Button>

//         <div className="flex gap-1">
//           {faqs.map((_, idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentFaq(idx)}
//               className={`w-2 h-2 rounded-full transition-all duration-300 ${
//                 idx === currentFaq ? "bg-indigo-600 w-4" : "bg-slate-300"
//               }`}
//             />
//           ))}
//         </div>

//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() =>
//             currentFaq < faqs.length - 1 && setCurrentFaq(currentFaq + 1)
//           }
//           disabled={currentFaq === faqs.length - 1}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           Next
//           <ChevronRight className="w-4 h-4" />
//         </Button>
//       </div>

//       {/* Swipe Hint */}
//       {currentFaq === 0 && (
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 1 }}
//           className="text-center mt-4"
//         >
//           <p className="text-xs text-slate-500">
//             👆 Swipe left/right to see more questions
//           </p>
//         </motion.div>
//       )}

//       {/* Quick Jump to Popular Questions */}
//       <motion.div
//         className="mt-8 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.3 }}
//       >
//         <h4 className="font-bold text-slate-900 mb-3 text-sm text-center">
//           Popular Questions
//         </h4>
//         <div className="flex flex-wrap gap-2 justify-center">
//           {[0, 1, 2, 3].map((idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentFaq(idx)}
//               className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
//                 idx === currentFaq
//                   ? "bg-indigo-600 text-white"
//                   : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200"
//               }`}
//             >
//               Q{idx + 1}
//             </button>
//           ))}
//         </div>
//       </motion.div>

//       {/* Contact CTA */}
//       <motion.div
//         className="mt-6 text-center"
//         initial={{ opacity: 0, y: 20 }}
//         whileInView={{ opacity: 1, y: 0 }}
//         viewport={{ once: true }}
//         transition={{ duration: 0.6, delay: 0.4 }}
//       >
//         <p className="text-sm text-slate-600 mb-3">Still have questions?</p>
//         <div className="flex flex-col gap-2">
//           <Button
//             variant="outline"
//             size="sm"
//             className="border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
//             asChild
//           >
//             <a href="mailto:nijel@tryblueprint.io">
//               <Send className="mr-2 w-4 h-4" />
//               Email Us
//             </a>
//           </Button>
//           <Button
//             size="sm"
//             className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 text-sm"
//             asChild
//           >
//             <a href="https://calendly.com/blueprintar/30min">
//               Schedule a Call
//               <ArrowRight className="ml-2 w-4 h-4" />
//             </a>
//           </Button>
//         </div>
//       </motion.div>
//     </div>
//   );
// }

// /**
//  * Mobile-specific timeline carousel component
//  */
// function MobileTimelineCarousel({ timeline }) {
//   const [currentStep, setCurrentStep] = useState(0);
//   const [touchStart, setTouchStart] = useState(null);
//   const [touchEnd, setTouchEnd] = useState(null);

//   // Handle touch events for swipe
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

//     if (isLeftSwipe && currentStep < timeline.length - 1) {
//       setCurrentStep(currentStep + 1);
//     }
//     if (isRightSwipe && currentStep > 0) {
//       setCurrentStep(currentStep - 1);
//     }
//   };

//   const nextStep = () => {
//     if (currentStep < timeline.length - 1) {
//       setCurrentStep(currentStep + 1);
//     }
//   };

//   const prevStep = () => {
//     if (currentStep > 0) {
//       setCurrentStep(currentStep - 1);
//     }
//   };

//   const step = timeline[currentStep];

//   return (
//     <div className="relative">
//       {/* Progress Bar */}
//       <div className="flex justify-center mb-8">
//         <div className="flex items-center gap-2">
//           {timeline.map((_, idx) => (
//             <button
//               key={idx}
//               onClick={() => setCurrentStep(idx)}
//               className={`h-2 rounded-full transition-all duration-300 ${
//                 idx === currentStep
//                   ? `w-8 bg-gradient-to-r ${step.color}`
//                   : idx < currentStep
//                     ? "w-2 bg-green-400"
//                     : "w-2 bg-slate-300"
//               }`}
//             />
//           ))}
//         </div>
//       </div>

//       {/* Step Counter */}
//       <div className="text-center mb-6">
//         <span className="text-sm font-medium text-slate-500">
//           Step {currentStep + 1} of {timeline.length}
//         </span>
//       </div>

//       {/* Card Container */}
//       <div
//         className="relative overflow-hidden"
//         onTouchStart={onTouchStart}
//         onTouchMove={onTouchMove}
//         onTouchEnd={onTouchEnd}
//       >
//         <AnimatePresence mode="wait">
//           <motion.div
//             key={currentStep}
//             initial={{ x: 300, opacity: 0 }}
//             animate={{ x: 0, opacity: 1 }}
//             exit={{ x: -300, opacity: 0 }}
//             transition={{ type: "spring", stiffness: 300, damping: 30 }}
//           >
//             <Card className="bg-white border-slate-200 shadow-xl">
//               <CardContent className="p-6">
//                 {/* Icon */}
//                 <div className="flex justify-center mb-6">
//                   <div
//                     className={`w-16 h-16 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg text-white`}
//                   >
//                     {React.cloneElement(step.icon, {
//                       className: "w-7 h-7",
//                     })}
//                   </div>
//                 </div>

//                 {/* Header */}
//                 <div className="text-center mb-6">
//                   <h3 className="text-2xl font-bold mb-2 text-slate-900">
//                     {step.title}
//                   </h3>
//                   <p className="text-indigo-600 font-semibold text-lg">
//                     {step.subtitle}
//                   </p>
//                 </div>

//                 {/* Description */}
//                 <p className="text-slate-600 mb-6 text-center leading-relaxed">
//                   {step.description}
//                 </p>

//                 {/* Features List */}
//                 <div className="space-y-3 mb-6">
//                   {step.details.map((detail, didx) => (
//                     <motion.div
//                       key={didx}
//                       initial={{ opacity: 0, x: -20 }}
//                       animate={{ opacity: 1, x: 0 }}
//                       transition={{ delay: 0.2 + didx * 0.1 }}
//                       className="flex items-start gap-3"
//                     >
//                       <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
//                       <span className="text-slate-700">{detail}</span>
//                     </motion.div>
//                   ))}
//                 </div>

//                 {/* Benefit Badge */}
//                 <div className="text-center">
//                   <Badge className="bg-violet-100 text-violet-700 border-violet-200 px-4 py-2 text-sm font-semibold">
//                     ✨ {step.benefit}
//                   </Badge>
//                 </div>
//               </CardContent>
//             </Card>
//           </motion.div>
//         </AnimatePresence>
//       </div>

//       {/* Navigation Buttons */}
//       <div className="flex justify-between items-center mt-6">
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={prevStep}
//           disabled={currentStep === 0}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           <ChevronRight className="w-4 h-4 rotate-180" />
//           Previous
//         </Button>

//         <div className="flex gap-1">
//           {timeline.map((_, idx) => (
//             <div
//               key={idx}
//               className={`w-2 h-2 rounded-full transition-colors ${
//                 idx === currentStep ? "bg-indigo-600" : "bg-slate-300"
//               }`}
//             />
//           ))}
//         </div>

//         <Button
//           variant="outline"
//           size="sm"
//           onClick={nextStep}
//           disabled={currentStep === timeline.length - 1}
//           className="flex items-center gap-2 disabled:opacity-50"
//         >
//           Next
//           <ChevronRight className="w-4 h-4" />
//         </Button>
//       </div>

//       {/* Swipe Hint */}
//       {currentStep === 0 && (
//         <motion.div
//           initial={{ opacity: 0, y: 10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 1 }}
//           className="text-center mt-4"
//         >
//           <p className="text-xs text-slate-500">
//             👆 Swipe left/right or use buttons to navigate
//           </p>
//         </motion.div>
//       )}
//     </div>
//   );
// }

// /**
//  * The PilotProgram component renders a page with detailed information about the Blueprint pilot program.
//  * It showcases the benefits, timeline, ideal candidates, FAQs, and includes a contact form to join the waitlist.
//  *
//  * @returns {JSX.Element} The rendered PilotProgram page.
//  */
// export default function PilotProgram() {
//   const videoRef = useRef(null);
//   const [activeTab, setActiveTab] = useState("what");
//   const [selectedFaq, setSelectedFaq] = useState(null);
//   const industryTypes = [
//     { icon: "🏪", name: "Retail" },
//     { icon: "🏛️", name: "Museum" },
//     { icon: "🎨", name: "Gallery" },
//     { icon: "🏢", name: "Showroom" },
//     { icon: "🏨", name: "Hospitality" },
//   ];

//   const handleWatchDemo = () => {
//     const videoElement = videoRef.current;
//     if (videoElement) {
//       // Just play the video, no scrolling needed
//       videoElement.play().catch((error) => {
//         console.log("Auto-play prevented:", error);
//         // Some browsers prevent autoplay, so this is expected
//       });
//     }
//   };

//   /**
//    * Displays a custom toast notification prompting the user to check their email for a pilot invitation.
//    * If the user indicates they haven't received an email, it scrolls to the waitlist contact form.
//    */
//   const showPilotToast = () => {
//     toast.custom(
//       (t) => (
//         <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md mx-auto">
//           <div className="flex items-center gap-3 mb-4">
//             <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center">
//               <Rocket className="w-5 h-5 text-white" />
//             </div>
//             <div>
//               <h3 className="font-bold text-slate-900">
//                 Pilot Access Required
//               </h3>
//               <p className="text-sm text-slate-600">
//                 Check your email for invitation
//               </p>
//             </div>
//           </div>

//           <p className="text-slate-700 mb-4 text-sm leading-relaxed">
//             Please use the unique URL we sent to your email to access the pilot
//             program.
//           </p>

//           <div className="space-y-3">
//             <p className="text-xs text-slate-500">
//               Didn't receive a pilot invitation email?
//             </p>
//             <button
//               onClick={() => {
//                 toast.dismiss(t);
//                 // Scroll to contact form
//                 const contactFormElement =
//                   document.getElementById("pilot-waitlist");
//                 if (contactFormElement) {
//                   contactFormElement.scrollIntoView({ behavior: "smooth" });
//                 }
//               }}
//               className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
//             >
//               Sign up for the Pilot Program
//             </button>
//             <button
//               onClick={() => toast.dismiss(t)}
//               className="w-full text-slate-500 hover:text-slate-700 px-4 py-2 text-sm font-medium transition-colors"
//             >
//               Close
//             </button>
//           </div>
//         </div>
//       ),
//       {
//         duration: 6000, // Don't auto-dismiss
//         position: "top-center",
//       },
//     );
//   };

//   const timeline = [
//     {
//       icon: <MapPin className="w-6 h-6" />,
//       title: "Week 1",
//       subtitle: "Mapping Session",
//       description:
//         "We scan your venue in 30-60 minutes using advanced LiDAR technology to create a precise digital twin.",
//       color: "from-blue-500 to-indigo-500",
//       benefit: "Zero prep work required",
//       details: [
//         "Quick 30-60 min scan",
//         "No business disruption",
//         "Millimeter-accurate 3D model",
//       ],
//     },
//     {
//       icon: <Sparkles className="w-6 h-6" />,
//       title: "Week 1",
//       subtitle: "Finalize Design",
//       description:
//         "Our AI helps our designers create custom AR experiences, and we work with you to finalize the design and smart triggers.",
//       color: "from-indigo-500 to-violet-500",
//       benefit: "Fully customized for your business",
//       details: [
//         "AI-generated content",
//         "Brand-aligned design",
//         "Interactive elements",
//         "Final adjustments",
//       ],
//     },
//     {
//       icon: <PlayCircle className="w-6 h-6" />,
//       title: "Week 2",
//       subtitle: "Demo Day",
//       description:
//         "Experience your space transformed with AR using cutting-edge devices. See the magic firsthand!",
//       color: "from-purple-500 to-pink-500",
//       benefit: "Hands-on experience",
//       details: ["Vision Pro demo", "Team training", "Immediate feedback"],
//     },
//   ];

//   const idealFor = [
//     {
//       icon: <Store className="w-8 h-8" />,
//       title: "Retail & Grocery Stores",
//       description:
//         "Transform shopping with interactive product demos and virtual try-ons",
//     },
//     {
//       icon: <Building2 className="w-8 h-8" />,
//       title: "Museums & Galleries",
//       description:
//         "Bring exhibits to life with immersive storytelling and digital guides",
//     },
//     {
//       icon: <UtensilsCrossed className="w-8 h-8" />,
//       title: "Restaurants & Cafes",
//       description:
//         "Interactive menus, 3D food visualization, and tableside ordering experiences",
//     },
//     {
//       icon: <Users className="w-8 h-8" />,
//       title: "Real Estate & Showrooms",
//       description:
//         "Let customers visualize products in their space before buying",
//     },
//   ];

//   const benefits = [
//     {
//       icon: <Shield className="w-6 h-6" />,
//       title: "Zero Risk",
//       description: "2 week program with absolutely no cost or obligation",
//       highlight: "100% FREE",
//     },
//     {
//       icon: <Monitor className="w-6 h-6" />,
//       title: "Premium Hardware",
//       description: "Test with Apple Vision Pro and other cutting-edge devices",
//       highlight: "No purchase needed",
//     },
//     {
//       icon: <Target className="w-6 h-6" />,
//       title: "Real Analytics",
//       description: "Track engagement, dwell time, and conversion metrics",
//       highlight: "Data-driven insights",
//     },
//     {
//       icon: <Zap className="w-6 h-6" />,
//       title: "Future-Ready",
//       description: "Be first to market with next-gen customer experiences",
//       highlight: "Competitive edge",
//     },
//   ];

//   /*
//   const testimonials = [
//     {
//       quote:
//         "Blueprint's AR transformed our flagship store. Customers spend 40% more time engaging with products, and our conversion rate jumped 28%. It's like having a personal guide for every visitor.",
//       author: "Jamie Chen",
//       role: "Head of Innovation, RetailNext",
//       metric: "+40% dwell time",
//     },
//     {
//       quote:
//         "The zero-commitment pilot made it a no-brainer. Within days, we saw how AR could revolutionize our customer experience. Now rolling out to all 12 locations.",
//       author: "Alex Rivera",
//       role: "COO, TechSpace",
//       metric: "12 locations adopted",
//     },
//     {
//       quote:
//         "Our visitors are blown away. The AR layer adds context and interactivity that brings our exhibits to life in ways we never imagined possible.",
//       author: "Sarah Johnson",
//       role: "Museum Director, Future Gallery",
//       metric: "5-star visitor reviews",
//     },
//   ];
//   */

//   const faqs = [
//     {
//       q: "What exactly is Blueprint?",
//       a: "Blueprint is the easiest way to create custom augmented reality experiences for physical spaces. Using AI and spatial computing, we transform your venue into an interactive digital environment. We call these 'Blueprints'. Customers access Blueprints through their smart glasses - no app download required. Think of it as adding a smart, invisible layer to your space that enhances customer engagement, provides information, and creates memorable experiences.",
//     },
//     {
//       q: "What does the pilot program cost?",
//       a: "Nothing. Zero. Nada. The entire 2 week program is completely free with no hidden fees, no credit card required, and no obligation to continue. This includes the space mapping, AI-generated AR content, hardware demos, and analytics. We're investing in showing you the future because we believe seeing is believing.",
//     },
//     {
//       q: "How long does the space mapping take?",
//       a: "Most spaces under 5,000 sq ft are mapped in 30-60 minutes. Larger venues may take 1-2 hours. Our team uses professional LiDAR equipment to create a millimeter-accurate 3D model of your space. The process is quiet, non-invasive, and won't disrupt your business operations.",
//     },
//     {
//       q: "Do we need special hardware for customers?",
//       a: "No! That's the beauty of Blueprint. Your customers access the AR experience through their own devices via web browser - no app download needed. During the pilot, we bring Vision Pro and other devices for demos, but day-to-day operation only requires customer's devices.",
//     },
//     {
//       q: "What do you need from us?",
//       a: "Just three things: 1) Access to your space for the initial mapping (30-60 min), 2) Basic information about your business, products, or exhibits, and 3) Your feedback during the course of the program. We handle everything else - the technology, content creation, and implementation.",
//     },
//     {
//       q: "What kinds of AR experiences can you create?",
//       a: "The possibilities are endless! For retail: virtual try-ons, product demos, and interactive catalogs. For museums: digital guides, historical recreations, and interactive exhibits. For restaurants: 3D menu visualizations and tableside ordering. For real estate: virtual staging and property tours. Each experience is custom-built for your specific needs.",
//     },
//     {
//       q: "What happens after the 2 week program?",
//       a: "We'll send out a survey to all participants of the Demo Day asking about the whole Pilot Program experience. Any feedback from this survey helps us improve Blueprint!",
//     },
//     {
//       q: "How do customers access the AR experience?",
//       a: "Super simple! You'll get custom QR codes to place around your space. Customers scan with their glasses camera, and the AR experience launches instantly on their device. No downloads, no friction, just magic. If a customer already has the Blueprint app downloaded, then once the QR code is scanned, it will bring them straight to the app.",
//     },
//   ];

//   return (
//     <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-indigo-50/20">
//       <Toaster richColors position="top-center" />
//       <Nav />

//       {/* HERO SECTION - Improved clarity on what Blueprint does */}
//         <section className="mt-6 md:mt-0 pt-16 md:pt-20 lg:pt-32 pb-12 md:pb-16 lg:pb-24 relative overflow-hidden">
//         {/* Animated background */}
//         <div className="absolute inset-0 overflow-hidden">
//           <div className="absolute inset-0 opacity-5" />
//           <div className="absolute top-20 -right-20 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl animated-bg-circle-1" />
//           <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl animated-bg-circle-2" />
//         </div>

//         <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
//           <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
//             <FadeIn
//               yOffset={20}
//               delay={0.1}
//               className="flex-1 text-center lg:text-left"
//             >
//               {/* What Blueprint is - Crystal Clear */}
//               <Badge className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 border-indigo-200 mb-6 px-4 py-2">
//                 <Rocket className="w-4 h-4" />
//                 Limited Pilot Program
//               </Badge>

//               {/* <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-slate-900">
//                 Turn Your Physical Space
//                 <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">
//                   Into an Interactive AR Experience
//                 </span>
//               </h1> */}
//               <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-slate-900">
//                 Turn Your Physical Space{" "}
//                 <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">
//                   Into an Interactive AR Experience
//                 </span>
//               </h1>

//               <p className="text-base sm:text-lg md:text-xl text-slate-600 mb-6 md:mb-8 max-w-2xl mx-auto lg:mx-0">
//                 <span className="md:hidden">
//                   AI-powered AR for your business. No apps needed - customers
//                   just scan and explore. Try it free.
//                 </span>
//                 <span className="hidden md:block">
//                   Blueprint uses AI to create custom augmented reality for your
//                   business. No apps needed - customers just scan and explore.
//                   Try it for completely free.
//                 </span>
//               </p>

//               {/* Key points for instant understanding */}
//               <div className="flex flex-col sm:flex-row gap-2 md:gap-4 mb-6 md:mb-8 text-xs md:text-sm">
//                 <div className="flex items-center gap-2">
//                   <CheckCircle2 className="w-5 h-5 text-green-600" />
//                   <span className="text-slate-700">
//                     Works on all smart glasses
//                   </span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <CheckCircle2 className="w-5 h-5 text-green-600" />
//                   <span className="text-slate-700">No app downloads</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <CheckCircle2 className="w-5 h-5 text-green-600" />
//                   <span className="text-slate-700">AI-generated content</span>
//                 </div>
//               </div>

//               <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
//                 <Button
//                   size="lg"
//                   className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-6 sm:px-8 py-6 text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all"
//                   onClick={showPilotToast}
//                 >
//                   Start Your Free 2 Week Program
//                   <ArrowRight className="ml-2 w-5 h-5" />
//                 </Button>
//                 <Button
//                   size="lg"
//                   variant="outline"
//                   className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 px-6 sm:px-8 py-6 text-base sm:text-lg"
//                   onClick={handleWatchDemo} // Add this
//                   // Remove the asChild prop and anchor tag
//                 >
//                   <Video className="mr-2 w-5 h-5" />
//                   Watch 2-Min Demo
//                 </Button>
//               </div>

//               {/* Social proof */}
//               <div className="flex items-center justify-center lg:justify-start gap-3 md:gap-4">
//                 <div className="flex -space-x-1 md:-space-x-2">
//                   {industryTypes.map((industry, i) => (
//                     <div
//                       key={i}
//                       className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white bg-white flex items-center justify-center shadow-lg"
//                       title={industry.name}
//                     >
//                       <span className="text-lg md:text-xl">
//                         {industry.icon}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//                 {/* <div className="flex -space-x-1 md:-space-x-2">
//                   {[1, 2, 3, 4].map((i) => (
//                     <div
//                       key={i}
//                       className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white"
//                     >
//                       {String.fromCharCode(64 + i)}
//                     </div>
//                   ))}
//                 </div> */}
//                 <p className="text-xs md:text-sm text-slate-600">
//                   <span className="font-bold text-slate-900">6 businesses</span>{" "}
//                   <span className="hidden sm:inline">
//                     transformed this month
//                   </span>
//                   <span className="sm:hidden">joined this month</span>
//                 </p>
//               </div>
//             </FadeIn>

//             {/* Video Demo */}
//             <FadeIn
//               yOffset={20}
//               a
//               delay={0.2}
//               className="flex-1 w-full max-w-2xl lg:max-w-none"
//               id="demo-video"
//             >
//               <div className="relative rounded-2xl overflow-hidden shadow-2xl">
//                 <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/20 to-violet-100/20 z-10 pointer-events-none" />
//                 <video
//                   ref={videoRef} // Add this ref
//                   className="w-full aspect-video object-cover"
//                   src="/videos/blueprint-website-demo2.mp4"
//                   controls
//                   preload="metadata"
//                 />
//               </div>
//               {/* <iframe
//                 className="w-full aspect-video"
//                 src="https://www.youtube.com/embed/OKaamZtSxtw?rel=0&modestbranding=1&showinfo=0&controls=1"
//                 title="Blueprint Website Demo"
//                 frameBorder="0"
//                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
//                 allowFullScreen
//               /> */}
//               <p className="text-center text-sm text-slate-600 mt-4">
//                 See Blueprint in action at an art museum
//               </p>
//             </FadeIn>
//           </div>
//         </div>
//       </section>

//       {/* WHO IT'S FOR - New Section */}
//       <section className="py-16 md:py-24 relative bg-gradient-to-b from-indigo-50/20 to-slate-50">
//         <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
//           {/* MOBILE VERSION */}
//           <div className="block md:hidden">
//             <MobileBusinessTypesCarousel idealFor={idealFor} />
//           </div>

//           {/* DESKTOP VERSION */}
//           <div className="hidden md:block">
//             <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
//               <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
//                 Perfect For Forward-Thinking Businesses
//               </h2>
//               <p className="text-lg text-slate-600 max-w-3xl mx-auto">
//                 If you have a physical space and want to create unforgettable
//                 customer experiences, Blueprint is for you
//               </p>
//             </FadeIn>

//             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
//               {idealFor.map((item, idx) => (
//                 <FadeIn
//                   key={idx}
//                   yOffset={20}
//                   delay={idx * 0.1}
//                   className="group"
//                 >
//                   <Card className="h-full bg-white/80 border-slate-200 hover:bg-white hover:border-indigo-300 hover:shadow-xl transition-all duration-300">
//                     <CardContent className="p-4 md:p-6 text-center">
//                       <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center group-hover:scale-110 transition-transform">
//                         {React.cloneElement(item.icon, {
//                           className: "w-8 h-8 text-indigo-600",
//                         })}
//                       </div>
//                       <h3 className="text-xl font-bold mb-2 text-slate-900">
//                         {item.title}
//                       </h3>
//                       <p className="text-slate-600 text-sm">
//                         {item.description}
//                       </p>
//                     </CardContent>
//                   </Card>
//                 </FadeIn>
//               ))}
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* KEY METRICS - Enhanced */}
//       <section className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           {[
//             {
//               label: "Investment Required",
//               value: "$0",
//               icon: <DollarSign className="w-6 h-6" />,
//               description: "Completely free pilot program",
//               gradient: "from-green-500 to-emerald-500",
//             },
//             {
//               label: "Time to Launch",
//               value: "< 2 weeks",
//               icon: <Clock className="w-6 h-6" />,
//               description: "From scan to live experience",
//               gradient: "from-blue-500 to-cyan-500",
//             },
//             {
//               label: "Setup Time",
//               value: "30-60 mins",
//               icon: <Zap className="w-6 h-6" />,
//               description: "Quick venue scanning process",
//               gradient: "from-violet-500 to-purple-500",
//             },
//           ].map((stat, idx) => (
//             <FadeIn key={stat.label} yOffset={20} delay={idx * 0.1}>
//               <Card className="relative bg-white/90 border-slate-200 hover:shadow-xl transition-all group overflow-hidden">
//                 <div
//                   className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`}
//                 />
//                 <CardContent className="p-6">
//                   <div className="flex items-start justify-between">
//                     <div>
//                       <p
//                         className={`text-4xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-1`}
//                       >
//                         {stat.value}
//                       </p>
//                       <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
//                         {stat.label}
//                       </p>
//                       <p className="text-sm text-slate-600 mt-2">
//                         {stat.description}
//                       </p>
//                     </div>
//                     <div
//                       className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} opacity-10 group-hover:opacity-20 transition-opacity`}
//                     >
//                       {React.cloneElement(stat.icon, {
//                         className: "w-6 h-6 text-slate-900",
//                       })}
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>
//             </FadeIn>
//           ))}
//         </div>
//       </section>

//       {/* TIMELINE - Mobile Carousel + Desktop Grid */}
//       <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-indigo-50/30">
//         <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
//           <FadeIn
//             yOffset={20}
//             delay={0.1}
//             className="text-center mb-12 md:mb-20"
//           >
//             <Badge className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 border-violet-200 mb-6 px-4 py-2">
//               <CalendarCheck className="w-4 h-4" />
//               Simple 2 Week Process
//             </Badge>
//             <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-slate-900">
//               From First Scan to Live AR in Two Weeks
//             </h2>
//             <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
//               Our streamlined process gets your AR experience up and running
//               fast, with zero technical work on your end
//             </p>
//           </FadeIn>

//           {/* MOBILE TIMELINE CAROUSEL */}
//           <div className="block md:hidden">
//             <MobileTimelineCarousel timeline={timeline} />
//           </div>

//           {/* DESKTOP TIMELINE - Keep existing */}
//           <div className="hidden md:block relative max-w-6xl mx-auto">
//             {/* Desktop Timeline Line - Better positioned */}
//             <div className="hidden lg:block absolute top-[88px] left-[16.67%] right-[16.67%] h-[3px] bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 rounded-full shadow-sm" />

//             {/* Timeline Container with proper 3-column layout */}
//             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 relative">
//               {timeline.map((step, idx) => (
//                 <FadeIn
//                   key={idx}
//                   yOffset={30}
//                   delay={idx * 0.15}
//                   className="relative"
//                 >
//                   {/* Timeline Icon - Better positioned */}
//                   <div className="flex justify-center mb-8 lg:mb-0">
//                     <div className="lg:absolute lg:-top-[10px] lg:z-20">
//                       <div
//                         className={`w-16 h-16 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-xl relative text-white border-4 border-white`}
//                       >
//                         {React.cloneElement(step.icon, {
//                           className: "w-7 h-7 lg:w-6 lg:h-6",
//                         })}
//                       </div>
//                     </div>
//                   </div>

//                   {/* Timeline Card - Improved design */}
//                   <Card className="h-full bg-white border-slate-200 hover:shadow-2xl hover:border-indigo-300 transition-all duration-300 lg:mt-20 lg:pt-8">
//                     <CardContent className="p-6 lg:p-8">
//                       {/* Header Section */}
//                       <div className="text-center mb-6">
//                         <h3 className="text-xl lg:text-2xl font-bold mb-2 text-slate-900">
//                           {step.title}
//                         </h3>
//                         <p className="text-indigo-600 font-semibold text-base lg:text-lg">
//                           {step.subtitle}
//                         </p>
//                       </div>

//                       {/* Description */}
//                       <p className="text-slate-600 mb-6 text-center text-sm lg:text-base leading-relaxed">
//                         {step.description}
//                       </p>

//                       {/* Features List - Consistent spacing */}
//                       <div className="space-y-3 mb-6">
//                         {step.details.map((detail, didx) => (
//                           <div
//                             key={didx}
//                             className="flex items-start gap-3 text-sm lg:text-base"
//                           >
//                             <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5 text-green-600 flex-shrink-0 mt-0.5" />
//                             <span className="text-slate-700 leading-relaxed">
//                               {detail}
//                             </span>
//                           </div>
//                         ))}
//                       </div>

//                       {/* Benefit Badge */}
//                       <div className="pt-4 border-t border-slate-200">
//                         <div className="text-center">
//                           <Badge className="bg-violet-100 text-violet-700 border-violet-200 px-3 py-1.5 text-sm font-semibold">
//                             ✨ {step.benefit}
//                           </Badge>
//                         </div>
//                       </div>
//                     </CardContent>
//                   </Card>
//                 </FadeIn>
//               ))}
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* EXPLAINER TABS - Enhanced */}
//       <section className="py-16 md:py-24 relative bg-white">
//         <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
//           <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
//             <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
//               Everything You Need to Know
//             </h2>
//             <p className="text-lg text-slate-600">
//               Dive deeper into how Blueprint transforms your business
//             </p>
//           </FadeIn>

//           <Tabs
//             defaultValue="what"
//             value={activeTab}
//             onValueChange={setActiveTab}
//             className="w-full"
//           >
//             <TabsList className="w-full max-w-2xl mx-auto bg-slate-100 border border-slate-200 p-1 rounded-2xl mb-12 grid grid-cols-3">
//               <TabsTrigger
//                 value="what"
//                 className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl py-3 transition-all text-slate-700"
//               >
//                 <Lightbulb className="w-4 h-4 mr-2" />
//                 What It Is
//               </TabsTrigger>
//               <TabsTrigger
//                 value="why"
//                 className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl py-3 transition-all text-slate-700"
//               >
//                 <Target className="w-4 h-4 mr-2" />
//                 Why It Works
//               </TabsTrigger>
//               <TabsTrigger
//                 value="how"
//                 className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl py-3 transition-all text-slate-700"
//               >
//                 <Wand2 className="w-4 h-4 mr-2" />
//                 How It Works
//               </TabsTrigger>
//             </TabsList>

//             <AnimatePresence mode="wait">
//               <TabsContent value="what" className="mt-0">
//                 <motion.div
//                   initial={{ opacity: 0, y: 20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, y: -20 }}
//                   transition={{ duration: 0.3 }}
//                   className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
//                 >
//                   <div>
//                     <h3 className="text-2xl font-bold mb-4 text-slate-900">
//                       AI-Powered AR That Just Works
//                     </h3>
//                     <p className="text-slate-600 mb-6">
//                       Blueprint creates a smart digital layer over your physical
//                       space. Customers look at products, exhibits, or areas to
//                       unlock:
//                     </p>
//                     <ul className="space-y-4">
//                       {[
//                         "Interactive product information and 3D models",
//                         "Virtual try-ons and customization options",
//                         "Guided tours and contextual storytelling",
//                         "Gamified experiences and rewards",
//                         "Real-time offers and personalized content",
//                       ].map((item, idx) => (
//                         <FadeIn
//                           key={idx}
//                           Component="li"
//                           delay={idx * 0.1}
//                           yOffset={10}
//                           className="flex items-start gap-3"
//                         >
//                           <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
//                           <span className="text-slate-700">{item}</span>
//                         </FadeIn>
//                       ))}
//                     </ul>
//                   </div>

//                   <div className="relative">
//                     <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/20 to-violet-100/20 blur-3xl" />
//                     <Card className="relative bg-white border-slate-200 overflow-hidden shadow-xl">
//                       <CardContent className="p-0">
//                         <div className="p-6">
//                           <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mb-3">
//                             <Smartphone className="w-3 h-3 mr-1" />
//                             No App Required
//                           </Badge>
//                           <h4 className="text-xl font-bold mb-2 text-slate-900">
//                             Instant Access
//                           </h4>
//                           <p className="text-slate-600 text-sm">
//                             Customers scan a QR code and the AR experience
//                             launches in their browser. No downloads, no
//                             friction.
//                           </p>
//                         </div>
//                       </CardContent>
//                     </Card>
//                   </div>
//                 </motion.div>
//               </TabsContent>

//               <TabsContent value="why" className="mt-0">
//                 <motion.div
//                   initial={{ opacity: 0, y: 20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, y: -20 }}
//                   transition={{ duration: 0.3 }}
//                 >
//                     <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
//                     <div>
//                       <h3 className="text-2xl font-bold mb-6 text-slate-900">
//                         Proven Business Impact
//                       </h3>
//                       <p className="text-slate-600 mb-8">
//                         AR isn't just cool tech—it drives real business results.
//                         Our pilot participants see immediate, measurable
//                         improvements:
//                       </p>

//                       <div className="grid grid-cols-2 gap-4 mb-8">
//                         {[
//                           {
//                             metric: "40%",
//                             label: "Increase in dwell time",
//                             icon: Clock,
//                           },
//                           {
//                             metric: "3.5x",
//                             label: "More social shares",
//                             icon: Users,
//                           },
//                           {
//                             metric: "28%",
//                             label: "Higher conversion",
//                             icon: Target,
//                           },
//                           {
//                             metric: "92%",
//                             label: "Customer satisfaction",
//                             icon: Star,
//                           },
//                         ].map((stat, idx) => (
//                           <FadeIn
//                             key={idx}
//                             delay={idx * 0.1}
//                             yOffset={10}
//                             className="bg-slate-50 border border-slate-200 rounded-xl p-4"
//                           >
//                             <stat.icon className="w-5 h-5 text-indigo-600 mb-2" />
//                             <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text">
//                               {stat.metric}
//                             </p>
//                             <p className="text-xs text-slate-600">
//                               {stat.label}
//                             </p>
//                           </FadeIn>
//                         ))}
//                       </div>

//                       </div>

//                       <div className="lg:pl-6">
//                         <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-6 h-full flex flex-col justify-center">
//                           <h4 className="font-bold mb-4 text-slate-900">
//                             Why AR Works So Well:
//                           </h4>
//                           <ul className="space-y-2 text-sm text-slate-600">
//                             <li>• Creates memorable, shareable experiences</li>
//                             <li>• Provides instant product information</li>
//                             <li>• Reduces decision friction</li>
//                             <li>• Appeals to tech-savvy consumers</li>
//                             <li>• Differentiates from competitors</li>
//                           </ul>
//                         </div>
//                       </div>

//                       {/*
//                       Testimonials section temporarily hidden until real pilot feedback is collected.
//                       <div className="space-y-6">
//                         <h4 className="text-xl font-bold mb-4 text-slate-900">
//                           What Pilot Participants Say
//                         </h4>
//                         {testimonials.map((testimonial, idx) => (
//                           <motion.div
//                             key={idx}
//                             className="bg-white border border-slate-200 rounded-xl p-6 shadow-lg"
//                             initial={{ opacity: 0, x: 20 }}
//                             animate={{ opacity: 1, x: 0 }}
//                             transition={{ delay: idx * 0.15 }}
//                           >
//                             <div className="flex gap-1 mb-3">
//                               {[...Array(5)].map((_, i) => (
//                                 <Star
//                                   key={i}
//                                   className="w-4 h-4 text-yellow-500 fill-yellow-500"
//                                 />
//                               ))}
//                             </div>
//                             <p className="text-slate-600 italic mb-4">
//                               "{testimonial.quote}"
//                             </p>
//                             <div className="flex items-center justify-between">
//                               <div>
//                                 <p className="font-semibold text-slate-900">
//                                   {testimonial.author}
//                                 </p>
//                                 <p className="text-sm text-slate-500">
//                                   {testimonial.role}
//                                 </p>
//                               </div>
//                               <Badge className="bg-green-100 text-green-700 border-green-200">
//                                 {testimonial.metric}
//                               </Badge>
//                             </div>
//                           </motion.div>
//                         ))}
//                       </div>
//                       */}
//                     </div>
//                   </motion.div>
//                 </TabsContent>

//               <TabsContent value="how" className="mt-0">
//                 <motion.div
//                   initial={{ opacity: 0, y: 20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, y: -20 }}
//                   transition={{ duration: 0.3 }}
//                   className="max-w-4xl mx-auto"
//                 >
//                   <h3 className="text-2xl font-bold mb-8 text-center text-slate-900">
//                     The Technology Behind the Magic
//                   </h3>

//                   <div className="space-y-6">
//                     {[
//                       {
//                         step: "1",
//                         title: "LiDAR Space Mapping",
//                         description:
//                           "We use professional-grade LiDAR scanners to create a millimeter-accurate 3D model of your space. This digital twin serves as the foundation for your AR experience.",
//                         tech: "Apple LiDAR + Custom Algorithms",
//                       },
//                       {
//                         step: "2",
//                         title: "AI Content Generation",
//                         description:
//                           "Our proprietary AI analyzes your space, brand, and products to generate contextually relevant AR content. No generic templates—everything is custom.",
//                         tech: "Computer-Use + Computer Vision Models",
//                       },
//                       {
//                         step: "3",
//                         title: "WebXR Deployment",
//                         description:
//                           "The AR experience runs directly in web browsers using WebXR technology. Customers get instant access without app downloads.",
//                         tech: "WebXR + Cloud Infrastructure",
//                       },
//                       {
//                         step: "4",
//                         title: "Real-Time Analytics",
//                         description:
//                           "Track engagement, interactions, and conversions in real-time. Understand how customers explore your space and what captures their attention.",
//                         tech: "Custom Analytics Platform",
//                       },
//                     ].map((item, idx) => (
//                       <FadeIn
//                         key={idx}
//                         delay={idx * 0.1}
//                         yOffset={10}
//                         className="flex gap-6"
//                       >
//                         <div className="flex-shrink-0">
//                           <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-lg text-white">
//                             {item.step}
//                           </div>
//                         </div>
//                         <div className="flex-1">
//                           <h4 className="text-xl font-bold mb-2 text-slate-900">
//                             {item.title}
//                           </h4>
//                           <p className="text-slate-600 mb-2">
//                             {item.description}
//                           </p>
//                           <Badge className="bg-slate-100 text-slate-600 border-slate-300">
//                             <Zap className="w-3 h-3 mr-1" />
//                             {item.tech}
//                           </Badge>
//                         </div>
//                       </FadeIn>
//                     ))}
//                   </div>
//                 </motion.div>
//               </TabsContent>
//             </AnimatePresence>
//           </Tabs>
//         </div>
//       </section>

//       {/* BENEFITS - Enhanced */}
//       <section
//         id="benefits-section"
//         className="py-16 md:py-24 bg-gradient-to-b from-indigo-50/20 to-slate-50"
//       >
//         <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
//           {/* MOBILE VERSION */}
//           <div className="block md:hidden">
//             <MobileBenefitsCarousel benefits={benefits} />
//           </div>

//           {/* DESKTOP VERSION */}
//           <div className="hidden md:block">
//             <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
//               <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
//                 Why Join the Pilot Program?
//               </h2>
//               <p className="text-lg text-slate-600 max-w-3xl mx-auto">
//                 Experience the future of customer engagement with zero risk and
//                 maximum support
//               </p>
//             </FadeIn>

//             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
//               {benefits.map((benefit, idx) => (
//                 <FadeIn key={idx} yOffset={20} delay={idx * 0.1}>
//                   <Card className="h-full bg-white/90 border-slate-200 hover:shadow-2xl hover:border-indigo-300 transition-all group">
//                     <CardContent className="p-4 md:p-6">
//                       <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform">
//                         {React.cloneElement(benefit.icon, {
//                           className: "w-5 h-5 md:w-6 md:h-6 text-indigo-600",
//                         })}
//                       </div>
//                       <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mb-2 md:mb-3">
//                         {benefit.highlight}
//                       </Badge>
//                       <h3 className="text-lg md:text-xl font-bold mb-2 text-slate-900">
//                         {benefit.title}
//                       </h3>
//                       <p className="text-slate-600 text-sm md:text-base">
//                         {benefit.description}
//                       </p>
//                     </CardContent>
//                   </Card>
//                 </FadeIn>
//               ))}
//             </div>

//             <FadeIn yOffset={20} delay={0.3} className="mt-12 text-center">
//               <Button
//                 size="lg"
//                 className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-6 text-lg font-bold shadow-xl hover:shadow-2xl transition-all"
//                 onClick={showPilotToast}
//               >
//                 Reserve Your Free Pilot Spot
//                 <ArrowRight className="ml-2 w-5 h-5" />
//               </Button>
//               <p className="text-slate-500 mt-4">No credit card required</p>
//             </FadeIn>
//           </div>
//         </div>
//       </section>

//       {/* FAQ - Enhanced */}
//       <section className="py-16 md:py-24 bg-white">
//         <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
//           {/* MOBILE VERSION */}
//           <div className="block md:hidden">
//             <MobileFAQCarousel faqs={faqs} />
//           </div>

//           {/* DESKTOP VERSION */}
//           <div className="hidden md:block">
//             <FadeIn yOffset={20} delay={0.1} className="text-center mb-12">
//               <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
//                 Frequently Asked Questions
//               </h2>
//               <p className="text-lg text-slate-600">
//                 Got questions? We've got answers.
//               </p>
//             </FadeIn>

//             <div className="space-y-4">
//               {faqs.map((faq, idx) => (
//                 <FadeIn key={idx} yOffset={20} delay={idx * 0.05}>
//                   <button
//                     className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-6 transition-all"
//                     onClick={() =>
//                       setSelectedFaq(selectedFaq === idx ? null : idx)
//                     }
//                   >
//                     <div className="flex justify-between items-start gap-4">
//                       <h3 className="font-semibold text-lg pr-8 text-slate-900">
//                         {faq.q}
//                       </h3>
//                       <ChevronDown
//                         className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
//                           selectedFaq === idx ? "rotate-180" : ""
//                         }`}
//                       />
//                     </div>

//                     <AnimatePresence>
//                       {selectedFaq === idx && (
//                         <motion.div
//                           initial={{ height: 0, opacity: 0 }}
//                           animate={{ height: "auto", opacity: 1 }}
//                           exit={{ height: 0, opacity: 0 }}
//                           transition={{ duration: 0.3 }}
//                           className="overflow-hidden"
//                         >
//                           <p className="text-slate-600 mt-4 leading-relaxed">
//                             {faq.a}
//                           </p>
//                         </motion.div>
//                       )}
//                     </AnimatePresence>
//                   </button>
//                 </FadeIn>
//               ))}
//             </div>

//             <FadeIn
//               yOffset={20}
//               delay={0.1}
//               className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 text-center"
//             >
//               <h3 className="text-2xl font-bold mb-4 text-slate-900">
//                 Still Have Questions?
//               </h3>
//               <p className="text-slate-600 mb-6">
//                 Our team is here to help you understand how Blueprint can
//                 transform your business
//               </p>
//               <div className="flex flex-col sm:flex-row gap-4 justify-center">
//                 <Button
//                   variant="outline"
//                   className="border-slate-300 text-slate-700 hover:bg-slate-50"
//                   asChild
//                 >
//                   <a href="mailto:nijel@tryblueprint.io">
//                     <Send className="mr-2 w-4 h-4" />
//                     Email Us
//                   </a>
//                 </Button>
//                 <Button
//                   className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700"
//                   asChild
//                 >
//                   <a href="https://calendly.com/blueprintar/30min">
//                     Schedule a Call
//                     <ArrowRight className="ml-2 w-5 h-5" />
//                   </a>
//                 </Button>
//               </div>
//             </FadeIn>
//           </div>
//         </div>
//       </section>

//       {/* Waitlist Contact Form */}
//       <section
//         id="pilot-waitlist"
//         className="bg-gradient-to-b from-slate-50 to-white"
//       >
//         <ContactForm />
//       </section>

//       <Footer />
//     </div>
//   );
// }
