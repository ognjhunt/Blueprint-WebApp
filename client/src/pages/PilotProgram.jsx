import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function PilotProgram() {
  const [isIntersected, setIsIntersected] = useState(false);
  const [activeTab, setActiveTab] = useState("what");
  const [selectedFaq, setSelectedFaq] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersected(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    const target = document.getElementById("benefits-section");
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, []);

  const showPilotToast = () => {
    toast.custom(
      (t) => (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center">
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
            Please use the unique URL we sent to your email to access the pilot
            program.
          </p>

          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Didn't receive a pilot invitation email?
            </p>
            <button
              onClick={() => {
                toast.dismiss(t);
                // Scroll to contact form
                const contactFormElement =
                  document.getElementById("pilot-waitlist");
                if (contactFormElement) {
                  contactFormElement.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
            >
              Join the Waitlist Instead
            </button>
            <button
              onClick={() => toast.dismiss(t)}
              className="w-full text-slate-500 hover:text-slate-700 px-4 py-2 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      ),
      {
        duration: 6000, // Don't auto-dismiss
        position: "top-center",
      },
    );
  };

  const timeline = [
    {
      icon: <MapPin className="w-6 h-6" />,
      title: "Day 0",
      subtitle: "3D Space Mapping",
      description:
        "We scan your venue in 30-60 minutes using advanced LiDAR technology to create a precise digital twin.",
      color: "from-blue-500 to-indigo-500",
      benefit: "Zero prep work required",
      details: [
        "Quick 30-60 min scan",
        "No business disruption",
        "Millimeter-accurate 3D model",
      ],
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Days 1-10",
      subtitle: "AI-Powered Creation",
      description:
        "Our AI generates custom AR experiences tailored to your brand, products, and customer journey.",
      color: "from-indigo-500 to-violet-500",
      benefit: "Fully customized for your business",
      details: [
        "AI-generated content",
        "Brand-aligned design",
        "Interactive elements",
      ],
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: "Days 11-13",
      subtitle: "Fine-Tuning",
      description:
        "We perfect every detail, place smart triggers, and prepare for your team's demo experience.",
      color: "from-violet-500 to-purple-500",
      benefit: "Polished to perfection",
      details: ["QR code placement", "Final adjustments", "Team briefing prep"],
    },
    {
      icon: <PlayCircle className="w-6 h-6" />,
      title: "Day 14",
      subtitle: "Live Demo Day",
      description:
        "Experience your space transformed with AR using cutting-edge devices. See the magic firsthand!",
      color: "from-purple-500 to-pink-500",
      benefit: "Hands-on experience",
      details: ["Vision Pro demo", "Team training", "Immediate feedback"],
    },
  ];

  const idealFor = [
    {
      icon: <Store className="w-8 h-8" />,
      title: "Retail Stores",
      description:
        "Transform shopping with interactive product demos and virtual try-ons",
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Museums & Galleries",
      description:
        "Bring exhibits to life with immersive storytelling and digital guides",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Showrooms",
      description:
        "Let customers visualize products in their space before buying",
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "Event Spaces",
      description:
        "Create unforgettable experiences with interactive AR installations",
    },
  ];

  const benefits = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Zero Risk",
      description: "14-day pilot with absolutely no cost or obligation",
      highlight: "100% FREE",
    },
    {
      icon: <Monitor className="w-6 h-6" />,
      title: "Premium Hardware",
      description: "Test with Apple Vision Pro and other cutting-edge devices",
      highlight: "No purchase needed",
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Real Analytics",
      description: "Track engagement, dwell time, and conversion metrics",
      highlight: "Data-driven insights",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Future-Ready",
      description: "Be first to market with next-gen customer experiences",
      highlight: "Competitive edge",
    },
  ];

  const testimonials = [
    {
      quote:
        "Blueprint's AR transformed our flagship store. Customers spend 40% more time engaging with products, and our conversion rate jumped 28%. It's like having a personal guide for every visitor.",
      author: "Jamie Chen",
      role: "Head of Innovation, RetailNext",
      metric: "+40% dwell time",
    },
    {
      quote:
        "The zero-commitment pilot made it a no-brainer. Within days, we saw how AR could revolutionize our customer experience. Now rolling out to all 12 locations.",
      author: "Alex Rivera",
      role: "COO, TechSpace",
      metric: "12 locations adopted",
    },
    {
      quote:
        "Our visitors are blown away. The AR layer adds context and interactivity that brings our exhibits to life in ways we never imagined possible.",
      author: "Sarah Johnson",
      role: "Museum Director, Future Gallery",
      metric: "5-star visitor reviews",
    },
  ];

  const faqs = [
    {
      q: "What exactly is Blueprint?",
      a: "Blueprint is the easiest way to create custom augmented reality experiences for physical spaces. Using AI and spatial computing, we transform your venue into an interactive digital environment. Customers access these experiences through their smart glasses - no app download required. Think of it as adding a smart, invisible layer to your space that enhances customer engagement, provides information, and creates memorable experiences.",
    },
    {
      q: "What does the pilot program cost?",
      a: "Nothing. Zero. Nada. The entire 14-day pilot is completely free with no hidden fees, no credit card required, and no obligation to continue. This includes the space mapping, AI-generated AR content, hardware demos, and analytics. We're investing in showing you the future because we believe seeing is believing.",
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
      a: "Just three things: 1) Access to your space for the initial mapping (30-60 min), 2) Basic information about your business, products, or exhibits, and 3) Your feedback during the coarse of the program. We handle everything else - the technology, content creation, and implementation.",
    },
    {
      q: "What kinds of AR experiences can you create?",
      a: "The possibilities are endless! For retail: virtual try-ons, product demos, and interactive catalogs. For museums: digital guides, historical recreations, and interactive exhibits. For restaurants: 3D menu visualizations and tableside ordering. For real estate: virtual staging and property tours. Each experience is custom-built for your specific needs.",
    },
    {
      q: "What happens after the 14-day pilot?",
      a: "You'll have three options: 1) Discuss future options with our team, 2) Take a break and come back when ready, or 3) Simply say thanks but no thanks. There's absolutely no pressure. We'll also provide a complete analytics report showing the impact on your business metrics.",
    },
    {
      q: "How do customers access the AR experience?",
      a: "Super simple! You'll get custom QR codes to place around your space. Customers scan with their glasses camera, and the AR experience launches instantly on their device. No downloads, no friction, just magic. If a customer already has the Blueprint app downloaded, then once the QR code is scanned, it will bring them straight to the app.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-indigo-50/20">
      <Toaster richColors position="top-center" />
      <Nav />

      {/* HERO SECTION - Improved clarity on what Blueprint does */}
      <section className="pt-20 md:pt-32 pb-16 md:pb-24 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] opacity-5" />
          <motion.div
            className="absolute top-20 -right-20 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl"
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{ duration: 20, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-20 -left-20 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl"
            animate={{
              x: [0, -50, 0],
              y: [0, 30, 0],
            }}
            transition={{ duration: 25, repeat: Infinity }}
          />
        </div>

        <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            <motion.div
              className="flex-1 text-center lg:text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              {/* What Blueprint is - Crystal Clear */}
              <Badge className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 border-indigo-200 mb-6 px-4 py-2">
                <Rocket className="w-4 h-4" />
                Limited Pilot Program - 13 Spots Left
              </Badge>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-slate-900">
                Turn Your Physical Space Into an
                <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 bg-clip-text text-transparent">
                  Interactive AR Experience
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                Blueprint uses AI to create custom augmented reality for your
                business. No apps needed - customers just scan and explore. Try
                it free for 14 days.
              </p>

              {/* Key points for instant understanding */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">
                    Works on all smart glasses
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">No app downloads</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">AI-generated content</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-6 sm:px-8 py-6 text-base sm:text-lg font-bold shadow-xl hover:shadow-2xl transition-all"
                  onClick={showPilotToast}
                >
                  Start Your Free 14-Day Pilot
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 px-6 sm:px-8 py-6 text-base sm:text-lg"
                  asChild
                >
                  <a href="#demo-video">
                    <Video className="mr-2 w-5 h-5" />
                    Watch 2-Min Demo
                  </a>
                </Button>
              </div>

              {/* Social proof */}
              <div className="flex items-center justify-center lg:justify-start gap-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-900">
                    47 businesses
                  </span>{" "}
                  transformed this month
                </p>
              </div>
            </motion.div>

            {/* Video Demo */}
            <motion.div
              className="flex-1 w-full max-w-2xl lg:max-w-none"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              id="demo-video"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/20 to-violet-100/20 z-10 pointer-events-none" />
                <video
                  className="w-full aspect-video object-cover"
                  src="/videos/Pilot Program.mp4"
                  controls
                  poster="/images/video-poster.jpg"
                />
              </div>
              <p className="text-center text-sm text-slate-600 mt-4">
                See Blueprint in action at a retail store
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR - New Section */}
      <section className="py-16 md:py-24 relative bg-gradient-to-b from-indigo-50/20 to-slate-50">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Perfect For Forward-Thinking Businesses
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              If you have a physical space and want to create unforgettable
              customer experiences, Blueprint is for you
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {idealFor.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group"
              >
                <Card className="h-full bg-white/80 border-slate-200 hover:bg-white hover:border-indigo-300 hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {React.cloneElement(item.icon, {
                        className: "w-8 h-8 text-indigo-600",
                      })}
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-900">
                      {item.title}
                    </h3>
                    <p className="text-slate-600 text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* KEY METRICS - Enhanced */}
      <section className="container mx-auto px-4 sm:px-6 py-16 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: "Investment Required",
              value: "$0",
              icon: <DollarSign className="w-6 h-6" />,
              description: "Completely free pilot program",
              gradient: "from-green-500 to-emerald-500",
            },
            {
              label: "Time to Launch",
              value: "14 days",
              icon: <Clock className="w-6 h-6" />,
              description: "From scan to live experience",
              gradient: "from-blue-500 to-cyan-500",
            },
            {
              label: "Setup Time",
              value: "< 1 hour",
              icon: <Zap className="w-6 h-6" />,
              description: "Quick venue scanning process",
              gradient: "from-violet-500 to-purple-500",
            },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="relative bg-white/90 border-slate-200 hover:shadow-xl transition-all group overflow-hidden">
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
                      className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} opacity-10 group-hover:opacity-20 transition-opacity`}
                    >
                      {React.cloneElement(stat.icon, {
                        className: "w-6 h-6 text-slate-900",
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TIMELINE - Enhanced */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-indigo-50/30">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 border-violet-200 mb-4 px-4 py-2">
              <CalendarCheck className="w-4 h-4" />
              Simple 14-Day Process
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              From First Scan to Live AR in Two Weeks
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Our streamlined process gets your AR experience up and running
              fast, with zero technical work on your end
            </p>
          </motion.div>

          <div className="relative">
            {/* Desktop Timeline Line */}
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 rounded-full" />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
              {timeline.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.15 }}
                  className="relative"
                >
                  <div className="lg:absolute lg:-top-3 lg:left-1/2 lg:-translate-x-1/2 mb-6 lg:mb-0">
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg relative z-10 mx-auto lg:mx-0 text-white`}
                    >
                      {step.icon}
                    </div>
                  </div>

                  <Card className="h-full bg-white/90 border-slate-200 hover:shadow-2xl transition-all lg:mt-20">
                    <CardContent className="p-6">
                      <div className="text-center mb-4">
                        <h3 className="text-2xl font-bold mb-1 text-slate-900">
                          {step.title}
                        </h3>
                        <p className="text-indigo-600 font-semibold">
                          {step.subtitle}
                        </p>
                      </div>

                      <p className="text-slate-600 mb-4 text-center">
                        {step.description}
                      </p>

                      <div className="space-y-2">
                        {step.details.map((detail, didx) => (
                          <div
                            key={didx}
                            className="flex items-center gap-2 text-sm"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-slate-700">{detail}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-sm font-semibold text-center text-violet-600">
                          {step.benefit}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* EXPLAINER TABS - Enhanced */}
      <section className="py-16 md:py-24 relative bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Everything You Need to Know
            </h2>
            <p className="text-lg text-slate-600">
              Dive deeper into how Blueprint transforms your business
            </p>
          </motion.div>

          <Tabs
            defaultValue="what"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full max-w-2xl mx-auto bg-slate-100 border border-slate-200 p-1 rounded-2xl mb-12 grid grid-cols-3">
              <TabsTrigger
                value="what"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl py-3 transition-all text-slate-700"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                What It Is
              </TabsTrigger>
              <TabsTrigger
                value="why"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl py-3 transition-all text-slate-700"
              >
                <Target className="w-4 h-4 mr-2" />
                Why It Works
              </TabsTrigger>
              <TabsTrigger
                value="how"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white rounded-xl py-3 transition-all text-slate-700"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                How It Works
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <TabsContent value="what" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
                >
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-slate-900">
                      AI-Powered AR That Just Works
                    </h3>
                    <p className="text-slate-600 mb-6">
                      Blueprint creates a smart digital layer over your physical
                      space. Customers look at products, exhibits, or areas to
                      unlock:
                    </p>
                    <ul className="space-y-4">
                      {[
                        "Interactive product information and 3D models",
                        "Virtual try-ons and customization options",
                        "Guided tours and contextual storytelling",
                        "Gamified experiences and rewards",
                        "Real-time offers and personalized content",
                      ].map((item, idx) => (
                        <motion.li
                          key={idx}
                          className="flex items-start gap-3"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">{item}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/20 to-violet-100/20 blur-3xl" />
                    <Card className="relative bg-white border-slate-200 overflow-hidden shadow-xl">
                      <CardContent className="p-0">
                        <img
                          src="/images/ar-visualization.jpg"
                          alt="AR Experience Demo"
                          className="w-full h-auto"
                        />
                        <div className="p-6">
                          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mb-3">
                            <Smartphone className="w-3 h-3 mr-1" />
                            No App Required
                          </Badge>
                          <h4 className="text-xl font-bold mb-2 text-slate-900">
                            Instant Access
                          </h4>
                          <p className="text-slate-600 text-sm">
                            Customers scan a QR code and the AR experience
                            launches in their browser. No downloads, no
                            friction.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="why" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div>
                      <h3 className="text-2xl font-bold mb-6 text-slate-900">
                        Proven Business Impact
                      </h3>
                      <p className="text-slate-600 mb-8">
                        AR isn't just cool tech—it drives real business results.
                        Our pilot participants see immediate, measurable
                        improvements:
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
                          <motion.div
                            key={idx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-4"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <stat.icon className="w-5 h-5 text-indigo-600 mb-2" />
                            <p className="text-3xl font-bold text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text">
                              {stat.metric}
                            </p>
                            <p className="text-xs text-slate-600">
                              {stat.label}
                            </p>
                          </motion.div>
                        ))}
                      </div>

                      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-6">
                        <h4 className="font-bold mb-2 text-slate-900">
                          Why AR Works So Well:
                        </h4>
                        <ul className="space-y-2 text-sm text-slate-600">
                          <li>• Creates memorable, shareable experiences</li>
                          <li>• Provides instant product information</li>
                          <li>• Reduces decision friction</li>
                          <li>• Appeals to tech-savvy consumers</li>
                          <li>• Differentiates from competitors</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-xl font-bold mb-4 text-slate-900">
                        What Pilot Participants Say
                      </h4>
                      {testimonials.map((testimonial, idx) => (
                        <motion.div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-xl p-6 shadow-lg"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.15 }}
                        >
                          <div className="flex gap-1 mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4 text-yellow-500 fill-yellow-500"
                              />
                            ))}
                          </div>
                          <p className="text-slate-600 italic mb-4">
                            "{testimonial.quote}"
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {testimonial.author}
                              </p>
                              <p className="text-sm text-slate-500">
                                {testimonial.role}
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              {testimonial.metric}
                            </Badge>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="how" className="mt-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-4xl mx-auto"
                >
                  <h3 className="text-2xl font-bold mb-8 text-center text-slate-900">
                    The Technology Behind the Magic
                  </h3>

                  <div className="space-y-6">
                    {[
                      {
                        step: "1",
                        title: "LiDAR Space Mapping",
                        description:
                          "We use professional-grade LiDAR scanners to create a millimeter-accurate 3D model of your space. This digital twin serves as the foundation for your AR experience.",
                        tech: "Apple LiDAR + Custom Algorithms",
                      },
                      {
                        step: "2",
                        title: "AI Content Generation",
                        description:
                          "Our proprietary AI analyzes your space, brand, and products to generate contextually relevant AR content. No generic templates—everything is custom.",
                        tech: "GPT-4 + Computer Vision Models",
                      },
                      {
                        step: "3",
                        title: "WebXR Deployment",
                        description:
                          "The AR experience runs directly in web browsers using WebXR technology. Customers get instant access without app downloads.",
                        tech: "WebXR + Cloud Infrastructure",
                      },
                      {
                        step: "4",
                        title: "Real-Time Analytics",
                        description:
                          "Track engagement, interactions, and conversions in real-time. Understand how customers explore your space and what captures their attention.",
                        tech: "Custom Analytics Platform",
                      },
                    ].map((item, idx) => (
                      <motion.div
                        key={idx}
                        className="flex gap-6"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-lg text-white">
                            {item.step}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-bold mb-2 text-slate-900">
                            {item.title}
                          </h4>
                          <p className="text-slate-600 mb-2">
                            {item.description}
                          </p>
                          <Badge className="bg-slate-100 text-slate-600 border-slate-300">
                            <Zap className="w-3 h-3 mr-1" />
                            {item.tech}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>
        </div>
      </section>

      {/* BENEFITS - Enhanced */}
      <section
        id="benefits-section"
        className="py-16 md:py-24 bg-gradient-to-b from-indigo-50/20 to-slate-50"
      >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Why Join the Pilot Program?
            </h2>
            <p className="text-lg text-slate-600 max-w-3xl mx-auto">
              Experience the future of customer engagement with zero risk and
              maximum support
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full bg-white/90 border-slate-200 hover:shadow-2xl hover:border-indigo-300 transition-all group">
                  <CardContent className="p-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      {React.cloneElement(benefit.icon, {
                        className: "w-6 h-6 text-indigo-600",
                      })}
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mb-3">
                      {benefit.highlight}
                    </Badge>
                    <h3 className="text-xl font-bold mb-2 text-slate-900">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-600">{benefit.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-6 text-lg font-bold shadow-xl hover:shadow-2xl transition-all"
              onClick={showPilotToast}
            >
              Reserve Your Free Pilot Spot
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-slate-500 mt-4">
              Only 13 spots remaining this month • No credit card required
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ - Enhanced */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-slate-600">
              Got questions? We've got answers.
            </p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
              >
                <button
                  className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-6 transition-all"
                  onClick={() =>
                    setSelectedFaq(selectedFaq === idx ? null : idx)
                  }
                >
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-semibold text-lg pr-8 text-slate-900">
                      {faq.q}
                    </h3>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
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
                        <p className="text-slate-600 mt-4 leading-relaxed">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-bold mb-4 text-slate-900">
              Still Have Questions?
            </h3>
            <p className="text-slate-600 mb-6">
              Our team is here to help you understand how Blueprint can
              transform your business
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                asChild
              >
                <a href="mailto:pilot@blueprint.ar">
                  <Send className="mr-2 w-4 h-4" />
                  Email Us
                </a>
              </Button>
              <Button
                className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700"
                asChild
              >
                <a href="https://calendly.com/blueprintar/30min">
                  Schedule a Call
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Waitlist Contact Form */}
      <section
        id="pilot-waitlist"
        className="bg-gradient-to-b from-slate-50 to-white"
      >
        <ContactForm />
      </section>

      <Footer />
    </div>
  );
}
