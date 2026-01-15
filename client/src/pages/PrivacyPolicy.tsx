// app/privacy/page.tsx or pages/privacy.tsx
import React, { useState, useEffect } from "react";
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

export default function PrivacyPolicy() {
  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  return (
    <>
      <Helmet>
        <title>Privacy Policy - Blueprint</title>
        <meta
          name="description"
          content="Blueprint's Privacy Policy - Learn how we collect, use, and protect your information."
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
                Privacy Policy
              </h1>
              <p className="text-lg text-slate-400">
                Effective Date: July 1, 2025 | Last Updated: July 1, 2025
              </p>
            </div>

            {/* Content */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-8 prose prose-invert prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-white mb-4">
                  1. Introduction
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  Welcome to Blueprint ("Blueprint," "we," "us," or "our").
                  Blueprint provides an AI-powered robotics data platform
                  for spatial context and autonomous systems ("Services"). This Privacy Policy explains how we collect,
                  use, disclose, and safeguard your information when you use our
                  website, mobile application, and Services.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Please read this Privacy Policy carefully. By using our
                  Services, you agree to the collection and use of information
                  in accordance with this policy. If you do not agree with the
                  terms of this Privacy Policy, please do not access our
                  Services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-white mb-4">
                  2. Information We Collect
                </h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  We collect information from and about users of our Services,
                  including:
                </p>

                <h3 className="text-xl font-medium text-slate-200 mb-3">
                  A. Personal Information
                </h3>
                <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-6">
                  <li>
                    <strong>Account Information:</strong> Name, email address,
                    phone number, username, password, and profile information
                  </li>
                  <li>
                    <strong>Business Information:</strong> Company name,
                    business address, job title, and business contact details
                    (for venue partners)
                  </li>
                  <li>
                    <strong>Payment Information:</strong> Credit card numbers,
                    billing addresses, and transaction history (processed
                    through secure third-party payment processors)
                  </li>
                  <li>
                    <strong>Communications:</strong> Messages, feedback, and
                    correspondence you send to us
                  </li>
                </ul>

                {/* Continue with other sections... */}
              </section>

              {/* Add all other sections from your privacy policy document */}

              <section className="mb-8 bg-white/5 p-6 rounded-lg border border-white/10">
                <h2 className="text-2xl font-semibold text-white mb-4">
                  Contact Us
                </h2>
                <p className="text-slate-300 mb-4">
                  For questions about this Privacy Policy or our privacy
                  practices:
                </p>
                <div className="text-slate-300">
                  <p>
                    <strong>Blueprint Privacy Team</strong>
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
          </motion.div>
        </main>
        <Footer />
      </div>
    </>
  );
}
