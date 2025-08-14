// This file defines the FAQ page component.
// This page provides answers to frequently asked questions about Blueprint.
// It includes an interactive FAQ section with expandable questions and answers.

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import { Button } from "@/components/ui/button";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ChevronDown, Send, ArrowRight } from "lucide-react";

/**
 * The FAQ component renders a page with frequently asked questions about Blueprint.
 * It includes an interactive FAQ section where users can expand/collapse questions.
 *
 * @returns {JSX.Element} The rendered FAQ page.
 */
export default function FAQ() {
  const [selectedFaq, setSelectedFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "What exactly is Blueprint?",
      a: "Blueprint is the easiest way to create custom augmented reality experiences for physical spaces. Using AI and spatial computing, we transform your venue into an interactive digital environment. We call these 'Blueprints'. Customers access Blueprints through their smart glasses - no app download required. Think of it as adding a smart, invisible layer to your space that enhances customer engagement, provides information, and creates memorable experiences.",
    },
    {
      q: "What does the pilot program cost?",
      a: "Nothing. Zero. Nada. The entire 2 week program is completely free with no hidden fees, no credit card required, and no obligation to continue. This includes the space mapping, AI-generated AR content, hardware demos, and analytics. We're investing in showing you the future because we believe seeing is believing.",
    },
    {
      q: "How long does the space mapping take?",
      a: "Most spaces under 5,000 sq ft are mapped in 30-60 minutes. Larger venues may take 1-2 hours. Our team uses professional LiDAR equipment to create a millimeter-accurate 3D model of your space. The process is quiet, non-invasive, and won't disrupt your business operations.",
    },
    {
      q: "Do we need special hardware for customers?",
      a: "No! That's the beauty of Blueprint. Your customers access the AR experience through their own devices via web browser - no app download needed. During the pilot, we bring Vision Pro and other devices for demos, but day-to-day operation only requires customer's devices.",
    },
    {
      q: "What do you need from us?",
      a: "Just three things: 1) Access to your space for the initial mapping (30-60 min), 2) Basic information about your business, products, or exhibits, and 3) Your feedback during the course of the program. We handle everything else - the technology, content creation, and implementation.",
    },
    {
      q: "What kinds of AR experiences can you create?",
      a: "The possibilities are endless! For retail: virtual try-ons, product demos, and interactive catalogs. For museums: digital guides, historical recreations, and interactive exhibits. For restaurants: 3D menu visualizations and tableside ordering. For real estate: virtual staging and property tours. Each experience is custom-built for your specific needs.",
    },
    {
      q: "What happens after the 2 week program?",
      a: "We'll send out a survey to all participants of the Demo Day asking about the whole Pilot Program experience. Any feedback from this survey helps us improve Blueprint! As of today, there are no options to discuss continuing with a full implementation of Blueprint for your space.",
    },
    {
      q: "How do customers access the AR experience?",
      a: "Super simple! You'll get custom QR codes to place around your space. Customers scan with their glasses camera, and the AR experience launches instantly on their device. No downloads, no friction, just magic. If a customer already has the Blueprint app downloaded, then once the QR code is scanned, it will bring them straight to the app.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
      </div>

      <Nav />

      {/* HERO SECTION */}
      <section className="pt-20 md:pt-28 lg:pt-40 pb-12 md:pb-16 lg:pb-24 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl opacity-40" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl opacity-40" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
          <FadeIn yOffset={20} delay={0.1} className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-white">
              Frequently Asked
              <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 bg-clip-text text-transparent">
                Questions
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Everything you need to know about Blueprint and our pilot program.
              Can't find what you're looking for? We're here to help.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <FadeIn key={idx} yOffset={20} delay={idx * 0.05}>
                <button
                  className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-6 transition-all"
                  onClick={() =>
                    setSelectedFaq(selectedFaq === idx ? null : idx)
                  }
                >
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-semibold text-lg pr-8 text-white">
                      {faq.q}
                    </h3>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-300 flex-shrink-0 transition-transform ${
                        selectedFaq === idx ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  <AnimatePresence>
                    {selectedFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
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
              Our team is here to help you understand how Blueprint can
              transform your business
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                className="border-white/30 text-black hover:bg-white/10 hover:text-black"
                asChild
              >
                <a href="mailto:nijel@tryblueprint.io">
                  <Send className="mr-2 w-4 h-4" />
                  Email Us
                </a>
              </Button>
              <Button
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white hover:from-emerald-600 hover:to-cyan-700"
                asChild
              >
                <a href="https://calendly.com/blueprintar/30min">
                  Schedule a Call
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-sky-500 text-white hover:from-cyan-700 hover:to-sky-600"
                asChild
              >
                <a href="/pilot-program">
                  Join Pilot Program
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
