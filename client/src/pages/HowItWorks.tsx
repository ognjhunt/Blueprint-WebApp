"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Edit3, 
  Wand2, 
  PlayCircle, 
  Check, 
  ArrowRight,
  Smartphone,
  Eye,
  Zap,
  Users,
  Building,
  QrCode
} from "lucide-react";

const heroIllustration = "/images/apple-store-blueprint.jpeg";

const steps = [
  {
    icon: <Building className="w-10 h-10" />,
    title: "Create Your Digital Space",
    description: "Start fresh or claim an existing location Blueprint. Simply enter your business details and location—no technical skills required.",
    highlight: "30 seconds",
    details: ["Business information", "Location mapping", "Industry templates"]
  },
  {
    icon: <Edit3 className="w-10 h-10" />,
    title: "Design Your Experience", 
    description: "Upload your branding, menus, or product catalogs. Our AI transforms them into interactive AR elements automatically.",
    highlight: "Drag & Drop",
    details: ["Brand assets", "Product catalogs", "Custom content"]
  },
  {
    icon: <Wand2 className="w-10 h-10" />,
    title: "Place AR Elements",
    description: "Position interactive hotspots, 3D models, and information overlays exactly where you want them in your physical space.",
    highlight: "Real-time Preview",
    details: ["3D placement", "Interactive hotspots", "Live preview"]
  },
  {
    icon: <QrCode className="w-10 h-10" />,
    title: "Launch & Share",
    description: "Generate a QR code or shareable link. Customers can instantly access your AR experience through any smartphone browser.",
    highlight: "Instant Access",
    details: ["QR code generation", "Browser-based AR", "Analytics dashboard"]
  },
];

const benefits = [
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: "No App Required",
    description: "Works instantly in any browser"
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Launch in Minutes",
    description: "From setup to live in under 10 minutes"
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Boost Engagement",
    description: "3x higher customer interaction rates"
  }
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1">
        <HeroSection />
        <BenefitsSection />
        <StepsSection />
        <LiveDemoSection />
        <CallToActionSection />
      </main>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pt-20 pb-16">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.4"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
      </div>

      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Eye className="w-4 h-4 mr-2" />
              Augmented Reality Made Simple
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent leading-tight">
              Transform Any Space Into an Interactive Experience
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Blueprint lets businesses create stunning AR experiences that customers can access instantly through their phones—no app downloads required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                Start Creating
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="border-2 border-gray-300 hover:border-blue-600 px-8 py-4 text-lg rounded-xl transition-all duration-200">
                Watch Demo
                <PlayCircle className="w-5 h-5 ml-2" />
              </Button>
            </div>

            <div className="flex items-center justify-center lg:justify-start text-sm text-gray-500">
              <Check className="w-4 h-4 text-green-500 mr-2" />
              Free 14-day trial • No credit card required
            </div>
          </motion.div>

          {/* Right Illustration */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative bg-white rounded-2xl shadow-2xl p-4 lg:p-8 border border-gray-100">
              <img
                src={heroIllustration}
                alt="AR Blueprint Demo"
                className="w-full h-auto rounded-xl"
              />
              {/* Floating Cards */}
              <motion.div
                className="absolute -top-4 -right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Live AR View
              </motion.div>
              <motion.div
                className="absolute -bottom-4 -left-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              >
                No App Needed
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section className="py-16 bg-white border-b border-gray-100">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit, idx) => (
            <motion.div
              key={idx}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-xl mb-4">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Get Started in <span className="text-blue-600">4 Simple Steps</span>
          </h2>
          <p className="text-xl text-gray-600">
            Our streamlined process gets you from idea to live AR experience in under 10 minutes
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-16">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              className={`grid lg:grid-cols-2 gap-12 items-center ${
                idx % 2 === 1 ? 'lg:grid-flow-col-dense' : ''
              }`}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              {/* Content */}
              <div className={`${idx % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-2xl mr-4">
                    {step.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-blue-600 uppercase tracking-wide">
                      Step {idx + 1}
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-bold">{step.title}</h3>
                  </div>
                </div>

                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  {step.description}
                </p>

                <div className="bg-blue-50 rounded-xl p-6 mb-6">
                  <div className="flex items-center mb-4">
                    <Zap className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="font-semibold text-blue-800">{step.highlight}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {step.details.map((detail, detailIdx) => (
                      <div key={detailIdx} className="flex items-center text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <div className="flex items-center text-gray-400">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <ArrowRight className="w-5 h-5 mx-4" />
                    <span className="text-sm">Next Step</span>
                  </div>
                )}
              </div>

              {/* Visual */}
              <div className={`${idx % 2 === 1 ? 'lg:col-start-1' : ''}`}>
                <div className="relative bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center">
                    <div className="text-6xl opacity-20">
                      {step.icon}
                    </div>
                  </div>
                  {/* Step Number Badge */}
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                    {idx + 1}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveDemoSection() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            See Blueprint in Action
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Experience a live AR demo and discover how Blueprint can transform your business space
          </p>
          <Button 
            size="lg" 
            variant="outline" 
            className="bg-white text-blue-600 hover:bg-gray-50 border-0 px-8 py-4 text-lg rounded-xl shadow-lg"
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            Launch Interactive Demo
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function CallToActionSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-3xl p-12 lg:p-16 text-center border border-gray-100 shadow-lg"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-gray-900">
            Ready to Create Your First AR Experience?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses already using Blueprint to engage customers in revolutionary new ways
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Start Your Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-gray-300 hover:border-blue-600 px-8 py-4 text-lg rounded-xl transition-all duration-200"
            >
              Schedule a Demo
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center">
              <Check className="w-4 h-4 text-green-500 mr-2" />
              14-day free trial
            </div>
            <div className="flex items-center">
              <Check className="w-4 h-4 text-green-500 mr-2" />
              No setup fees
            </div>
            <div className="flex items-center">
              <Check className="w-4 h-4 text-green-500 mr-2" />
              Cancel anytime
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}