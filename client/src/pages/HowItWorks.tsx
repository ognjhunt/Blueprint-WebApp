"use client";

import React from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ContactForm from "@/components/sections/ContactForm";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
// Replace MagicWand with Wand2 here:
import { MapPin, Edit, Wand2, PlayCircle, Check } from "lucide-react";

// Example placeholder illustration; replace or remove
const heroIllustration = "/images/apple-store-blueprint.jpeg";

// The step icons and copy for the process
const steps = [
  {
    icon: <MapPin className="w-8 h-8 text-blue-600" />,
    title: "1. Create or Claim",
    description:
      "Start fresh or claim an existing Blueprint. No coding, no fuss—just your business info, location, and a spark of imagination.",
  },
  {
    icon: <Edit className="w-8 h-8 text-blue-600" />,
    title: "2. Add Your Details",
    description:
      "Quickly add your branding, menus, or product info. Our AI seamlessly organizes it into a dynamic AR experience.",
  },
  {
    // Replace MagicWand with Wand2 here:
    icon: <Wand2 className="w-8 h-8 text-blue-600" />,
    title: "3. Customize & Preview",
    description:
      "Place interactive AR elements anywhere in your space. Explore it in real time, make adjustments, and see the magic unfold.",
  },
  {
    icon: <PlayCircle className="w-8 h-8 text-blue-600" />,
    title: "4. Launch & Engage",
    description:
      "Share a single link or QR code—customers access your AR experience instantly in their browsers. Watch engagement soar!",
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <Nav />

      <main className="flex-1 mt-16">
        <HeroSection />
        <StepsSection />
        <CallToActionSection />
      </main>

      <Footer />
    </div>
  );
}

// ---------------------------------------------------------
// 1. Hero Section
// ---------------------------------------------------------
function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Optional background gradient */}
      <motion.div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-white to-blue-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.0 }}
      />

      <div className="container mx-auto px-4 py-24 flex flex-col-reverse lg:flex-row items-center justify-center gap-12">
        {/* Left Copy */}
        <motion.div
          className="max-w-xl text-center lg:text-left"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-gray-800">
            How Blueprint Works
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            We’ve reinvented augmented reality so that you can easily transform
            your physical space—without any technical headaches.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Button size="lg" className="text-lg px-8">
              Start Now
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              See a Demo
            </Button>
          </div>
        </motion.div>

        {/* Right Illustration */}
        <motion.div
          className="w-full max-w-md mx-auto"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <img
            src={heroIllustration}
            alt="How Blueprint Works"
            className="w-full h-auto object-contain"
          />
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------
// 2. Steps Section
// ---------------------------------------------------------
function StepsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4">
        {/* Heading */}
        <motion.div
          className="mb-12 text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Effortless Setup in Four Steps
          </h2>
          <p className="text-lg text-gray-600">
            From concept to launch, Blueprint handles everything under the hood
            so you can focus on your business.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              className="bg-gray-50 rounded-lg p-6 shadow hover:shadow-md transition-shadow text-center flex flex-col items-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
            >
              <div className="mb-4">{step.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-gray-600 text-sm">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------
// 3. CTA Section
// ---------------------------------------------------------
function CallToActionSection() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-50 to-white">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to See It in Action?
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Claim your Blueprint or create a brand-new one. In just a few
            minutes, you’ll have an AR experience ready for your customers.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="text-lg px-8 flex items-center">
              Create a Blueprint
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Claim Existing Blueprint
            </Button>
          </div>
        </motion.div>
      </div>

      <ContactForm />
    </section>
  );
}
