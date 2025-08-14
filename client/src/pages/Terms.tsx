// app/terms/page.tsx or pages/terms.tsx
//import React, { useState, useEffect } from "react";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import FadeIn from "@/components/FadeIn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Nav from "@/components/Nav";
// Add these to your existing imports
import { toast } from "sonner"; // You'll need to install sonner: npm install sonner
import { Toaster } from "sonner";
import ContactForm from "@/components/sections/ContactForm"; // Import your ContactForm
import Footer from "@/components/Footer";
import { Helmet } from "react-helmet";
import {
  Rocket,
  MapPin,
  Camera,
  Wand2,
  PlayCircle,
  Users,
  ClipboardList,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Award,
  ArrowRight,
  ChevronRight,
  Shield,
  Zap,
  Lightbulb,
  Monitor,
  Target,
  UserPlus,
  Star,
  ChevronDown,
  Video,
  Send,
  ChevronUp,
  Sparkles,
  Store,
  Palette,
  Building2,
  Smartphone,
} from "lucide-react";

export default function TermsOfService() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  return (
    <>
      <Helmet>
        <title>Terms of Service - Blueprint</title>
        <meta
          name="description"
          content="Blueprint's Terms of Service - Learn about the terms and conditions for using our AR platform."
        />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100">
        <Nav />
        <main className="flex-grow py-12">
          <motion.div
            className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
            initial="initial"
            animate="animate"
            variants={fadeInUp}
          >
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-slate-400">
              Effective Date: July 1, 2025 | Last Updated: July 1, 2025
            </p>
          </div>

          {/* Table of Contents */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4 text-white">
              Table of Contents
            </h3>
            <nav className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <a
                href="#acceptance"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                1. Acceptance of Terms
              </a>
              <a
                href="#services"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                2. Description of Services
              </a>
              <a
                href="#accounts"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                3. User Accounts
              </a>
              <a
                href="#acceptable-use"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                4. Acceptable Use Policy
              </a>
              <a
                href="#intellectual-property"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                5. Intellectual Property
              </a>
              <a
                href="#payment"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                6. Payment Terms
              </a>
              <a
                href="#privacy"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                7. Privacy and Data
              </a>
              <a
                href="#disclaimers"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                8. Disclaimers
              </a>
              <a
                href="#limitation"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                9. Limitation of Liability
              </a>
              <a
                href="#indemnification"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                10. Indemnification
              </a>
              <a
                href="#termination"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                11. Termination
              </a>
              <a
                href="#governing-law"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                12. Governing Law
              </a>
              <a
                href="#changes"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                13. Changes to Terms
              </a>
              <a
                href="#contact"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                14. Contact Information
              </a>
            </nav>
          </div>

          {/* Content */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 prose prose-invert prose-lg max-w-none">
            <section id="acceptance" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Welcome to Blueprint ("Blueprint," "Company," "we," "us," or
                "our"). These Terms of Service ("Terms") govern your use of
                Blueprint's AI-powered augmented reality platform, website,
                mobile applications, and related services (collectively, the
                "Services").
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                By accessing or using our Services, you agree to be bound by
                these Terms. If you disagree with any part of these Terms, you
                may not access or use our Services.
              </p>
              <p className="text-slate-300 leading-relaxed">
                These Terms apply to all visitors, users, and others who access
                or use our Services, including venue partners, content creators,
                and end users.
              </p>
            </section>

            <section id="services" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                2. Description of Services
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Blueprint provides an AI-powered augmented reality platform that
                creates custom AR experiences for physical spaces. Our Services
                include:
              </p>
              <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
                <li>
                  Web and mobile applications for AR content creation and
                  management
                </li>
                <li>
                  AI-powered AR experience generation based on spatial data
                </li>
                <li>Location-based AR content delivery</li>
                <li>Spatial mapping and scanning tools</li>
                <li>Analytics and performance monitoring</li>
                <li>Integration with venue partner systems</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any
                aspect of our Services at any time with reasonable notice.
              </p>
            </section>

            <section id="accounts" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                3. User Accounts and Responsibilities
              </h2>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Account Creation
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                To access certain features, you must create an account. You
                agree to provide accurate, current, and complete information and
                to update such information as necessary.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Account Security
              </h3>
              <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
                <li>
                  You are responsible for maintaining the confidentiality of
                  your account credentials
                </li>
                <li>
                  You agree to notify us immediately of any unauthorized use of
                  your account
                </li>
                <li>
                  You are responsible for all activities that occur under your
                  account
                </li>
                <li>
                  You must be at least 13 years old to create an account (with
                  parental consent if under 18)
                </li>
              </ul>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Business Accounts
              </h3>
              <p className="text-slate-300 leading-relaxed">
                Venue partners and business users may have additional terms and
                responsibilities as outlined in separate agreements.
              </p>
            </section>

            <section id="acceptable-use" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                4. Acceptable Use Policy
              </h2>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Permitted Uses
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                You may use our Services for lawful purposes consistent with
                these Terms and applicable laws.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Prohibited Uses
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon intellectual property rights of others</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>
                  Use our Services to create inappropriate, offensive, or
                  harmful AR content
                </li>
                <li>
                  Interfere with or disrupt the integrity or performance of our
                  Services
                </li>
                <li>Collect or harvest personal information of other users</li>
                <li>
                  Use our Services for commercial purposes without proper
                  authorization
                </li>
                <li>Create AR experiences that pose safety risks to users</li>
                <li>
                  Reverse engineer, decompile, or disassemble our software
                </li>
              </ul>
            </section>

            <section id="intellectual-property" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                5. Intellectual Property Rights
              </h2>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Our Property
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Blueprint retains all rights, title, and interest in our
                Services, including software, algorithms, AI models, trademarks,
                and proprietary technology. Our Services are protected by
                copyright, patent, trademark, and other intellectual property
                laws.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Your Content
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                You retain ownership of content you create or upload. By using
                our Services, you grant Blueprint a worldwide, non-exclusive,
                royalty-free license to use, reproduce, and display your content
                solely for providing and improving our Services.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                AI-Generated Content
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Content generated by our AI systems based on your inputs may be
                used by Blueprint to improve our Services. You have the right to
                use AI-generated content created specifically for your account.
              </p>
            </section>

            <section id="payment" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                6. Payment Terms
              </h2>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Subscription Fees
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Certain features require paid subscriptions. Fees are charged in
                advance and are non-refundable except as required by law.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Payment Processing
              </h3>
              <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
                <li>
                  Payments are processed through secure third-party providers
                </li>
                <li>You authorize us to charge your selected payment method</li>
                <li>
                  You are responsible for maintaining valid payment information
                </li>
                <li>
                  We may suspend Services for non-payment after reasonable
                  notice
                </li>
              </ul>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Refunds
              </h3>
              <p className="text-slate-300 leading-relaxed">
                Refunds are provided at our discretion and in accordance with
                applicable laws. Contact us at nijel@tryblueprint.io for refund
                requests.
              </p>
            </section>

            <section id="privacy" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                7. Privacy and Data
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Your privacy is important to us. Our Privacy Policy explains how
                we collect, use, and protect your information when you use our
                Services.
              </p>
              <p className="text-slate-300 leading-relaxed">
                By using our Services, you consent to the collection and use of
                information as described in our{" "}
                <a
                  href="/privacy"
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </section>

            <section id="disclaimers" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                8. Disclaimers
              </h2>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="text-slate-300 leading-relaxed font-medium">
                  OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                  WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                </p>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                We disclaim all warranties, including but not limited to:
              </p>
              <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
                <li>Merchantability and fitness for a particular purpose</li>
                <li>Non-infringement of third-party rights</li>
                <li>Accuracy, completeness, or timeliness of content</li>
                <li>Uninterrupted or error-free operation</li>
                <li>Security or virus-free operation</li>
              </ul>
              <p className="text-slate-300 leading-relaxed">
                AR experiences may vary based on device capabilities,
                environmental conditions, and other factors beyond our control.
              </p>
            </section>

            <section id="limitation" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                9. Limitation of Liability
              </h2>
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <p className="text-slate-300 leading-relaxed font-medium">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, BLUEPRINT SHALL NOT BE
                  LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                  OR PUNITIVE DAMAGES.
                </p>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                Our total liability for any claims arising from these Terms or
                your use of our Services shall not exceed the amount you paid us
                in the twelve months preceding the claim.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Some jurisdictions do not allow limitations on liability, so
                these limitations may not apply to you.
              </p>
            </section>

            <section id="indemnification" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                10. Indemnification
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                You agree to indemnify and hold Blueprint harmless from any
                claims, damages, losses, and expenses (including reasonable
                attorney fees) arising from:
              </p>
              <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
                <li>Your use of our Services</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another party</li>
                <li>Content you upload or create using our Services</li>
              </ul>
            </section>

            <section id="termination" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                11. Termination
              </h2>

              <h3 className="text-xl font-medium text-slate-200 mb-3">By You</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                You may terminate your account at any time by contacting us or
                using account settings.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">By Us</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                We may suspend or terminate your access for violations of these
                Terms, non-payment, or other reasons with appropriate notice.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Effect of Termination
              </h3>
              <p className="text-slate-300 leading-relaxed">
                Upon termination, your right to use our Services ceases
                immediately. We may delete your account and content, though some
                data may be retained as required by law or legitimate business
                purposes.
              </p>
            </section>

            <section id="governing-law" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                12. Governing Law and Disputes
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                These Terms are governed by the laws of North Carolina, United
                States, without regard to conflict of law principles.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                Any disputes arising from these Terms or your use of our
                Services shall be resolved through binding arbitration in
                Durham, North Carolina, except for claims that may be brought in
                small claims court.
              </p>
              <p className="text-slate-300 leading-relaxed">
                You waive any right to participate in class action lawsuits or
                class-wide arbitration.
              </p>
            </section>

            <section id="changes" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                13. Changes to Terms
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                We may update these Terms periodically. We will notify you of
                material changes via email or through our Services at least 30
                days before they take effect.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Your continued use of our Services after changes take effect
                constitutes acceptance of the new Terms.
              </p>
            </section>

            <section id="miscellaneous" className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-4">
                14. Miscellaneous
              </h2>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Entire Agreement
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                These Terms constitute the entire agreement between you and
                Blueprint regarding our Services.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">
                Severability
              </h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                If any provision of these Terms is found unenforceable, the
                remaining provisions will remain in full force and effect.
              </p>

              <h3 className="text-xl font-medium text-slate-200 mb-3">Waiver</h3>
              <p className="text-slate-300 leading-relaxed">
                No waiver of any term or condition shall be deemed a further or
                continuing waiver of such term or any other term.
              </p>
            </section>

            <section id="contact" className="mb-8 bg-white/5 p-6 rounded-lg border border-white/10">
              <h2 className="text-2xl font-semibold text-white mb-4">
                15. Contact Information
              </h2>
              <p className="text-slate-300 mb-4">
                If you have questions about these Terms of Service, please
                contact us:
              </p>
              <div className="text-slate-300">
                <p>
                  <strong>Blueprint Legal Team</strong>
                </p>
                <p>
                  Email:{" "}
                  <a
                    href="mailto:nijel@tryblueprint.io"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    nijel@tryblueprint.io
                  </a>
                </p>
                <p>Address: 1005 Crete Street, Durham, NC 27707</p>
                <p>
                  Phone:{" "}
                  <a
                    href="tel:9196389913"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    (919) 638-9913
                  </a>
                </p>
              </div>
            </section>
          </div>

          {/* Back to Top Button */}
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-8 right-8 bg-emerald-500 text-white p-3 rounded-full shadow-lg hover:bg-emerald-600 transition-colors z-50"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </motion.button>
          </motion.div>
        </main>
        <Footer />
      </div>
    </>
  );
}
