import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Features from "@/components/sections/Features";
import { Button } from "@/components/ui/button";
import ContactForm from "@/components/sections/ContactForm";
import { Card, CardContent } from "@/components/ui/card";
import Footer from "@/components/Footer";
import Testimonials from "@/components/sections/Testimonials";
import LocationShowcase from "@/components/sections/LocationShowcase";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ShieldCheck,
  Rocket,
  Sparkle,
  Zap,
  MapPin,
  Edit,
  Wand2,
  PlayCircle,
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
  Clock,
  Star,
  Smartphone,
  Brain,
} from "lucide-react";

export default function Home() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const mainRef = useRef(null);

  const steps = [
    {
      icon: <Users className="w-6 h-6 md:w-8 md:h-8" />,
      title: "Join Waitlist",
      description:
        "Secure your spot in our exclusive early access program. Priority onboarding for our free pilot program available.",
      benefits: [
        "Priority access",
        "Free 14-day pilot",
        "Dedicated support",
      ],
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
      duration: "1-2 hours",
    },
    {
      icon: <Brain className="w-6 h-6 md:w-8 md:h-8" />,
      title: "AI-Powered Setup",
      description:
        "Our AI generates custom AR experiences tailored to your business goals and customer journey.",
      benefits: [
        "Intelligent content placement",
        "Custom interactions",
        "Brand integration",
      ],
      color: "from-violet-500 to-purple-600",
      duration: "30 minutes",
    },
    {
      icon: <Rocket className="w-6 h-6 md:w-8 md:h-8" />,
      title: "Launch & Scale",
      description:
        "Go live instantly with QR codes. Track engagement and optimize your AR experience with real-time analytics.",
      benefits: [
        "Instant deployment",
        "Performance analytics",
        "Continuous optimization",
      ],
      color: "from-fuchsia-500 to-pink-600",
      duration: "Same day",
    },
  ];

  // Trust indicators with enhanced context
  const trustMetrics = [
    {
      label: "Faster Setup",
      value: "10x",
      icon: <Clock className="w-5 h-5" />,
      context: "vs. building solutions in-house",
      tooltip:
        "Average business takes ~10 days to build AR solutions vs. Blueprint's 1-day deployment",
    },
    {
      label: "Customer Engagement",
      value: "200%",
      icon: <Star className="w-5 h-5" />,
      context: "vs. non-AR experiences",
      tooltip:
        "AR experiences deliver significantly higher interactivity compared to traditional digital interactions",
    },
    {
      label: "No App Required",
      value: "N/A",
      icon: <Smartphone className="w-5 h-5" />,
      context: "Works via QR codes",
      tooltip:
        "Customers access AR experiences instantly through their glasses's camera - no downloads needed",
    },
  ];

  // Parallax scrolling effect
  const { scrollYProgress } = useScroll({
    target: mainRef,
    offset: ["start start", "end start"],
  });

  const handleScrollToContactForm = () => {
    const contactFormElement = document.getElementById("contactForm");
    if (contactFormElement) {
      contactFormElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  useEffect(() => {
    if (currentUser) {
      setLocation("/dashboard");
    }
  }, [currentUser, setLocation]);

  useEffect(() => {
    // Lindy script loading
    const lindyScriptId = "lindy-embed-script";
    if (document.getElementById(lindyScriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = lindyScriptId;
    script.src =
      "https://api.lindy.ai/api/lindyEmbed/lindyEmbed.js?a=9620fed7-bdfb-4329-ada0-b60963170c59";
    script.async = true;
    script.crossOrigin = "use-credentials";

    document.body.appendChild(script);

    return () => {
      const existingScript = document.getElementById(lindyScriptId);
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-white">
      {/* Enhanced background patterns */}
      <div className="fixed inset-0 z-[-2] bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">
        <motion.div
          className="absolute w-[120vw] h-[120vw] md:w-[80vw] md:h-[80vw] rounded-full bg-gradient-to-r from-indigo-100/40 via-violet-100/30 to-fuchsia-100/20 blur-3xl"
          style={{ top: "-60vw", right: "-40vw" }}
          animate={{
            y: [0, 20, 0],
            scale: [1, 1.1, 1],
            rotate: [0, 45, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <motion.div
          className="absolute w-[100vw] h-[100vw] md:w-[60vw] md:h-[60vw] rounded-full bg-gradient-to-r from-blue-100/30 via-cyan-100/20 to-emerald-100/15 blur-3xl"
          style={{ bottom: "-50vw", left: "-30vw" }}
          animate={{
            y: [0, -25, 0],
            scale: [1, 1.15, 1],
            rotate: [0, -30, 0],
          }}
          transition={{
            duration: 35,
            repeat: Infinity,
            repeatType: "reverse",
            delay: 2,
          }}
        />
      </div>

      <Nav />

      <main ref={mainRef} className="flex-1 relative z-10">
        <Hero />

        {/* Trust metrics section */}
        <section className="py-12 md:py-16 bg-gradient-to-b from-indigo-50/30 via-white/60 to-slate-50/40 backdrop-blur-sm">
          <div className="container mx-auto px-6">
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
            >
              {trustMetrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  className="text-center p-6 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 group relative"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  {/* Tooltip */}
                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="relative">
                      <Info className="w-5 h-5 text-slate-400 hover:text-slate-600 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50">
                        {metric.tooltip}
                        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center text-white">
                      {metric.icon}
                    </div>
                  </div>
                  <div className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                    {metric.value}
                  </div>
                  <div className="text-slate-600 font-medium mb-1">
                    {metric.label}
                  </div>
                  {/* Context text */}
                  <div className="text-xs text-slate-500 italic">
                    {metric.context}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <LocationShowcase />

        {/* Enhanced Process Overview */}
        <section className="py-16 md:py-24 px-6 relative bg-gradient-to-b from-slate-50 to-white">
          <div className="container mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl mx-auto text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 mb-4 bg-indigo-50 text-indigo-700 py-2 px-4 rounded-full text-sm font-semibold">
                <Zap className="w-4 h-4" />
                Simple 4-Step Process
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-6 text-slate-900">
                From Concept to{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text">
                  Live AR Experience
                </span>
              </h2>
              <p className="text-xl text-slate-600 leading-relaxed">
                Our streamlined approach makes implementing cutting-edge AR
                technology effortless. Get your interactive experience up and
                running in under 24 hours.
              </p>
            </motion.div>

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

            {/* Call-to-action below process */}
            <motion.div
              className="text-center mt-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <p className="text-lg text-slate-600 mb-6">
                Ready to transform your customer experience?
              </p>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-10 py-6 font-semibold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-300"
                onClick={handleScrollToContactForm}
              >
                Learn More & Get Started
                <ArrowDown className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </section>

        <ContactForm />
      </main>

      <Footer />

      {/* Enhanced mobile floating action button */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
        <Button
          onClick={handleScrollToContactForm}
          className="w-full py-6 flex items-center justify-center gap-3 text-lg font-semibold shadow-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl border-0 hover:scale-105 transition-all duration-300"
        >
          <Rocket className="w-6 h-6" />
          Get Early Access
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
