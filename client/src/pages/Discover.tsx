"use client";

import React from "react";
import Nav from "@/components/Nav";
import { Link } from "wouter";

import Footer from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Rocket, Sparkle, Zap, Users, Check } from "lucide-react";

// Example placeholder images; swap with your own or remove
const dummyTestimonials = [
  {
    id: 1,
    quote:
      "Blueprint has transformed how we engage with customers. Our AR experiences are off the charts!",
    name: "Jane Doe",
    title: "CEO at ARRetail",
    avatarUrl: "/avatars/01.png",
  },
  {
    id: 2,
    quote:
      "We saw a 30% increase in on-site engagement. The best part? No complicated app needed!",
    name: "John Smith",
    title: "Head of Marketing at VR Bistro",
    avatarUrl: "/avatars/02.png",
  },
  {
    id: 3,
    quote:
      "The AI-driven insights are incredible. Blueprint gave us data that changed our entire strategy.",
    name: "Alicia Lake",
    title: "Founder at Future Spaces",
    avatarUrl: "/avatars/03.png",
  },
];

export default function Discover() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <Nav />

      {/* Main Content */}
      <main className="flex-1 mt-16">
        {/* Hero Section */}
        <HeroSection />

        {/* Features Section */}
        <FeaturesSection />

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* CTA Section */}
        <CallToActionSection />
      </main>

      {/* Footer */}
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
      {/* Background swirl or shape (optional) */}
      <motion.div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-white to-blue-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.0 }}
      />

      <div className="container mx-auto px-4 py-24 flex flex-col lg:flex-row items-center justify-center gap-12">
        <motion.div
          className="max-w-xl text-center lg:text-left"
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-gray-800">
            Discover What’s Possible with Blueprint
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            Transform ordinary environments into interactive AR experiences—all
            powered by advanced AI. Let’s redefine how your customers see the
            world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Button size="lg" className="text-lg px-8">
              Get Started For Free
            </Button>

            <Link href="/how-it-works">
              <Button size="lg" variant="outline" className="text-lg px-8">
                How It Works
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Example 3D or illustration (replace or remove) */}
        <motion.div
          className="w-full max-w-md mx-auto"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <img
            src="/images/hero-illustration.png"
            alt="Discover AR"
            className="w-full h-auto object-contain"
          />
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------
// 2. Features Section
// ---------------------------------------------------------
function FeaturesSection() {
  const features = [
    {
      icon: <Sparkle className="h-8 w-8 text-blue-600" />,
      title: "Next-Level AR",
      description:
        "Seamlessly place digital experiences in real-world spaces—no custom app needed.",
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-blue-600" />,
      title: "Secure & Scalable",
      description:
        "Backed by robust cloud infrastructure, ensuring performance at scale.",
    },
    {
      icon: <Zap className="h-8 w-8 text-blue-600" />,
      title: "Real-time Insights",
      description:
        "Our AI analytics track engagement patterns, providing data you can act on immediately.",
    },
    {
      icon: <Rocket className="h-8 w-8 text-blue-600" />,
      title: "Rapid Deployment",
      description:
        "Launch interactive experiences in hours—not weeks. Move fast, stay agile.",
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4">
        {/* Heading */}
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <motion.h2
            className="text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Why Businesses Choose Blueprint
          </motion.h2>
          <motion.p
            className="text-xl text-gray-600"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            From small retailers to global brands, everyone’s unlocking new
            potential with spatial AR.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              className="bg-gray-50 rounded-lg p-6 shadow hover:shadow-md transition-shadow"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------
// 3. Testimonials Section
// ---------------------------------------------------------
function TestimonialsSection() {
  return (
    <section className="py-24 bg-gradient-to-r from-blue-50 to-white">
      <div className="container mx-auto px-4">
        <motion.h2
          className="text-4xl font-bold text-center mb-10"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Trusted by Visionaries
        </motion.h2>

        <motion.div
          className="flex flex-col lg:flex-row gap-8 justify-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {dummyTestimonials.map((test) => (
            <div
              key={test.id}
              className="bg-white rounded-lg p-6 shadow hover:shadow-lg transition-shadow flex-1"
            >
              <p className="text-gray-700 italic mb-4">“{test.quote}”</p>
              <div className="flex items-center gap-3">
                {test.avatarUrl ? (
                  <img
                    src={test.avatarUrl}
                    alt={test.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-300" />
                )}
                <div>
                  <p className="font-semibold">{test.name}</p>
                  <p className="text-xs text-gray-500">{test.title}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------
// 4. CTA Section
// ---------------------------------------------------------
function CallToActionSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Go Spatial?
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Take your first step into the AR revolution. Create or Claim your
            Blueprint today and see your environment come to life.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="text-lg px-8 flex items-center">
              Create Blueprint
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Claim Existing Blueprint
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
