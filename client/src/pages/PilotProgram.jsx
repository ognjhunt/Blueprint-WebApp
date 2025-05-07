import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Nav from "@/components/Nav";
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

  const timeline = [
    {
      icon: <MapPin className="w-6 h-6" />,
      title: "Day 0",
      subtitle: "Mapping Session",
      description:
        "We scan your venue in 30-60 minutes, creating a precise 3D digital twin.",
      color: "from-blue-500 to-indigo-500",
      benefit: "No preparation needed on your end",
    },
    {
      icon: <Camera className="w-6 h-6" />,
      title: "Days 1-10",
      subtitle: "Experience Build",
      description:
        "Our AI & design team generate a custom AR layer for your space and run internal QA.",
      color: "from-indigo-500 to-violet-500",
      benefit: "Get a fully customized AR experience",
    },
    {
      icon: <ClipboardList className="w-6 h-6" />,
      title: "Days 11-13",
      subtitle: "Polish & Prep",
      description:
        "We refine content, place QR/App Clip codes and schedule Demo Day.",
      color: "from-violet-500 to-purple-500",
      benefit: "Fine-tuned to your specific needs",
    },
    {
      icon: <PlayCircle className="w-6 h-6" />,
      title: "Day 14",
      subtitle: "Demo Day",
      description:
        "Your team experiences the live AR environment with Apple Vision Pro on-site.",
      color: "from-purple-500 to-pink-500",
      benefit: "Hands-on with cutting-edge hardware",
    },
  ];

  const benefits = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Zero Risk",
      description: "14-day pilot with absolutely no cost or obligation",
    },
    {
      icon: <Monitor className="w-6 h-6" />,
      title: "Hardware Access",
      description: "Hands-on experience with Vision Pro technology",
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Visitor Analytics",
      description: "Actionable insights on customer engagement",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Priority Access",
      description: "Get first access to new features and updates",
    },
  ];

  const testimonials = [
    {
      quote:
        "Blueprint transformed how customers interact with our products. The spatial computing experience they created increased our in-store dwell time by 40%.",
      author: "Jamie Chen",
      role: "Head of Innovation, RetailNext",
    },
    {
      quote:
        "Being able to test the technology with zero commitment made this an easy decision. We were so impressed that we rolled out Blueprint to all our locations.",
      author: "Alex Rivera",
      role: "COO, TechSpace",
    },
    {
      quote:
        "The mapping process was seamless and the AR layer they created went beyond our expectations. Our visitors are amazed by the experience.",
      author: "Sarah Johnson",
      role: "Museum Director, Future Gallery",
    },
  ];

  const faqs = [
    {
      q: "What does it cost?",
      a: "Nothing. The entire 14-day pilot is completely free with zero obligation or credit card required. This Pilot is mostly for internal ____, which will help operations once the market _______.",
    },
    {
      q: "How long does on-site mapping take?",
      a: "Most locations (≤5,000 sq ft) are scanned in under one hour. Our specialized equipment creates detailed 3D digital twins quickly with minimal disruption to your operations.",
    },
    {
      q: "Do we need our own hardware?",
      a: "No. Blueprint supplies all scanning devices and brings an Apple Vision Pro for Demo Day. Your team and selected guests can experience the technology without any hardware investment.",
    },
    {
      q: "What does Blueprint need from me?",
      a: "During the sign up process, you'll provide a contact who we'll meet at your location at the date & time you've chosen for mapping your space. At this time, we'll give the contact an overview of the process, and ______. Other than that, any information, documents, data, etc. that is NOT found online that you would want to add to your AR experience would be helpful to be shared (via email or online Dashboard portal).\n\nEx: Assuming you run a restaurant, you would NOT need to provide us with a menu if this menu can be found on your website. However, if you have _______ and would like to display this within the experience, then this would be nice to share.",
    },
    {
      q: "Can our team collaborate during the trial?",
      a: "Yes—the user who initially signed up for the Pilot Program will get access to our platform where they can view, comment on, and suggest changes to the AR layer before Demo Day. This ensures the experience meets your specific needs.\n\n*Note: If you want to add collaborators to your team, so they gain access to the work-in-progress Blueprint prior to Demo Day, please email: founders@blueprint.com",
    },
    {
      q: "What kinds of spaces work best?",
      a: "Our technology works in virtually any indoor environment: retail stores, museums, offices, showrooms, galleries, restaurants, and more. The pilot program is ideal for spaces where visitor engagement and experience matter.",
    },
    {
      q: "What happens after the 14-day pilot?",
      a: "We'll send out a survey to yourself and any other collaborators that participated in the creation of the experience or the Demo Day. Our goal is to get as much first-hand data out of this Pilot Program as we can! Outside of the survey, any other feedback is also appreciated.",
    },
  ];

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-blue-50">
      <Nav />

      {/* HERO */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] opacity-10 bg-repeat -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 2 }}
        />

        {/* 3D geometric shapes floating in background */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          <motion.div
            className="absolute w-64 h-64 rounded-full bg-indigo-600/10 blur-3xl"
            animate={{
              x: ["-20%", "5%", "-10%"],
              y: ["10%", "30%", "15%"],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-96 h-96 rounded-full bg-violet-600/10 blur-3xl"
            animate={{
              x: ["60%", "40%", "55%"],
              y: ["5%", "25%", "10%"],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 mb-4 py-1.5 pl-2 pr-3">
                  <Rocket className="w-4 h-4 mr-1" /> Limited Availability
                </Badge>
              </motion.div>

              <motion.h1
                className="text-4xl md:text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                Experience the Future of Spatial Computing
              </motion.h1>

              <motion.p
                className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto lg:mx-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
              >
                Get a free 14-day trial of Blueprint's AI-generated AR
                experiences in your own space. Zero cost, zero risk, endless
                possibilities.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.6 }}
              >
                <Button
                  size="lg"
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-6 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all text-lg"
                  asChild
                >
                  <a href="https://calendly.com/blueprintar/30min">
                    Book Your Free Pilot <ArrowRight className="ml-2 w-5 h-5" />
                  </a>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-slate-700 text-slate-200 hover:bg-slate-800 px-8 py-6 transition-all text-lg"
                  asChild
                >
                  <a href="#learn-more">
                    <Video className="mr-2 w-5 h-5" /> Watch Demo
                  </a>
                </Button>
              </motion.div>

              <motion.div
                className="mt-8 flex items-center justify-center lg:justify-start gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 1 }}
              >
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 border-2 border-slate-900 flex items-center justify-center text-xs font-bold"
                    >
                      {i}
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 text-sm">
                  <span className="font-bold text-white">13</span> slots
                  remaining this month
                </p>
              </motion.div>
            </div>

            <motion.div
              className="flex-1"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <div className="bg-gradient-to-br from-indigo-900/60 to-violet-900/60 backdrop-blur-lg rounded-2xl border border-indigo-700/20 p-1.5 shadow-xl shadow-indigo-900/25">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800">
                  <video
                    className="w-full h-full object-cover"
                    src="/videos/Pilot Program.mp4"
                    controls
                    loop
                    muted
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* KEY METRICS */}
      <section className="container mx-auto px-6 pb-24 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: "Investment",
              value: "$0",
              icon: <DollarSign className="w-6 h-6 text-green-400" />,
              description: "Zero cost, zero obligation",
            },
            {
              label: "Duration",
              value: "14 days",
              icon: <Clock className="w-6 h-6 text-blue-400" />,
              description: "From first scan to final demo",
            },
            {
              label: "All-Access",
              value: "Demo",
              icon: <UserPlus className="w-6 h-6 text-violet-400" />,
              description: "Pilot culminates with a fun demo",
            },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl hover:shadow-2xl hover:bg-slate-800/70 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-5xl font-extrabold bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent mb-1">
                        {stat.value}
                      </p>
                      <p className="uppercase tracking-wide text-slate-400 text-xs font-medium">
                        {stat.label}
                      </p>
                      <p className="text-slate-300 text-sm mt-2">
                        {stat.description}
                      </p>
                    </div>
                    <div className="bg-slate-700/50 p-3 rounded-full">
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* EXPLAINER SECTION */}
      <section
        className="bg-gradient-to-b from-slate-900 to-slate-950 py-24 relative overflow-hidden"
        id="learn-more"
      >
        <div className="absolute inset-0 opacity-40">
          <motion.div
            className="absolute top-40 right-[20%] w-72 h-72 rounded-full bg-indigo-700/20 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent mb-6">
              Blueprint Pilot Program
            </h2>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto">
              Our 14-day free pilot brings spatial computing to your venue with
              zero risk or commitment. Experience how augmented reality can
              revolutionize customer engagement.
            </p>
          </motion.div>

          <Tabs
            defaultValue="what"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full bg-slate-800/50 border border-slate-700/50 p-1 rounded-xl mb-8 max-w-2xl mx-auto">
              <TabsTrigger
                value="what"
                className="flex-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg py-3"
              >
                What It Is
              </TabsTrigger>
              <TabsTrigger
                value="why"
                className="flex-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg py-3"
              >
                Why It Works
              </TabsTrigger>
              <TabsTrigger
                value="how"
                className="flex-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg py-3"
              >
                How It Works
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="what"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <motion.div
                className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <motion.div variants={fadeInUp}>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    Transform Your Space with AI-Powered AR
                  </h3>
                  <p className="text-slate-300 mb-6">
                    The Blueprint Pilot Program brings cutting-edge spatial
                    computing technology to your venue with zero upfront cost or
                    commitment. We create a custom augmented reality layer for
                    your space that can:
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Enhance customer engagement and interaction",
                      "Provide interactive product information and demonstrations",
                      "Create memorable, shareable experiences that drive word-of-mouth",
                      "Collect valuable data on customer behavior and preferences",
                      "Differentiate your space from competitors",
                    ].map((item, idx) => (
                      <motion.li
                        key={idx}
                        className="flex items-start gap-3"
                        variants={fadeInUp}
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div className="relative" variants={fadeInUp}>
                  <div className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 backdrop-blur-sm rounded-2xl border border-indigo-700/20 p-6 shadow-xl">
                    <div className="relative aspect-square">
                      {/* This would be replaced with an actual 3D render or image of the AR experience */}
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-800/20 to-violet-800/20 rounded-xl flex items-center justify-center">
                        <div className="w-full h-full bg-[url('/images/ar-visualization.jpg')] bg-cover bg-center opacity-90 rounded-xl">
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent rounded-xl" />
                          <div className="absolute bottom-6 left-6 right-6">
                            <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-500/40 mb-2">
                              <Wand2 className="w-3 h-3 mr-1" /> AI-Generated
                            </Badge>
                            <h4 className="text-xl font-bold text-white">
                              Custom AR Layer
                            </h4>
                            <p className="text-sm text-slate-300">
                              Tailored to your specific space and needs
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </TabsContent>

            <TabsContent
              value="why"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <motion.div
                className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <motion.div variants={fadeInUp}>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    The Business Impact of Spatial Computing
                  </h3>
                  <p className="text-slate-300 mb-6">
                    Augmented Reality isn't just a novelty—it's a powerful tool
                    for business growth. Our clients see measurable results
                    after implementing Blueprint AR experiences:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {[
                      { stat: "37%", desc: "Increase in customer engagement" },
                      { stat: "42%", desc: "Longer dwell time in venue" },
                      { stat: "28%", desc: "Higher conversion rates" },
                      { stat: "3.5x", desc: "More social media shares" },
                    ].map((item, idx) => (
                      <motion.div
                        key={idx}
                        className="bg-slate-800/50 border border-slate-700/20 rounded-lg p-4"
                        variants={fadeInUp}
                      >
                        <p className="text-2xl font-bold text-indigo-400">
                          {item.stat}
                        </p>
                        <p className="text-sm text-slate-300">{item.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                  <p className="text-slate-300">
                    These aren't just numbers—they represent real business
                    growth. And with our risk-free pilot program, you can see
                    the potential impact on your own business before making any
                    investment.
                  </p>
                </motion.div>

                <motion.div variants={fadeInUp}>
                  <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/20 p-6">
                    <h4 className="text-xl font-bold text-white mb-4">
                      Client Success Stories
                    </h4>

                    <div className="space-y-5">
                      {testimonials.map((testimonial, idx) => (
                        <motion.div
                          key={idx}
                          className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-5"
                          variants={fadeInUp}
                        >
                          <div className="flex mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4 text-yellow-400 fill-yellow-400"
                              />
                            ))}
                          </div>
                          <p className="text-slate-300 italic mb-3">
                            "{testimonial.quote}"
                          </p>
                          <div>
                            <p className="font-medium text-white">
                              {testimonial.author}
                            </p>
                            <p className="text-sm text-slate-400">
                              {testimonial.role}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </TabsContent>

            <TabsContent
              value="how"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <motion.h3
                  className="text-2xl font-bold text-white mb-6 text-center"
                  variants={fadeInUp}
                >
                  The 14-Day Blueprint Journey
                </motion.h3>

                <motion.div className="max-w-4xl mx-auto" variants={fadeInUp}>
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-violet-500 hidden md:block" />

                    <div className="space-y-12">
                      {timeline.map((step, idx) => (
                        <motion.div
                          key={idx}
                          className="flex flex-col md:flex-row gap-6"
                          variants={fadeInUp}
                        >
                          <div className="flex md:flex-col items-center md:items-start">
                            <div
                              className={`w-8 h-8 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center z-10`}
                            >
                              {step.icon}
                            </div>
                            <div className="md:mt-3 ml-4 md:ml-0">
                              <h4 className="font-bold text-white text-lg">
                                {step.title}
                              </h4>
                              <p className="text-indigo-300">{step.subtitle}</p>
                            </div>
                          </div>

                          <div className="md:ml-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/20 p-5 flex-1">
                            <p className="text-slate-300 mb-3">
                              {step.description}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              <span>{step.benefit}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* BENEFITS SECTION */}
      <section id="benefits-section" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-950/40" />

        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent mb-6">
              Why Join Our Pilot Program?
            </h2>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto">
              Experience the future of spatial computing without any financial
              commitment or technical complexity.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            animate={isIntersected ? "visible" : "hidden"}
            variants={staggerContainer}
          >
            {benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 rounded-xl p-6 hover:bg-slate-800/60 hover:border-indigo-700/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-900/60 flex items-center justify-center mb-4">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {benefit.title}
                </h3>
                <p className="text-slate-300">{benefit.description}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button
              size="lg"
              className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-6 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all text-lg"
              asChild
            >
              <a href="https://calendly.com/blueprintar/30min">
                Reserve Your Spot <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <p className="text-slate-400 mt-4">
              Limited spots available this month. No credit card required.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-24 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-slate-300 max-w-3xl mx-auto">
              Everything you need to know about our pilot program.
            </p>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {faqs.map((faq, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full text-left p-5 flex justify-between items-center"
                  onClick={() =>
                    setSelectedFaq(selectedFaq === idx ? null : idx)
                  }
                >
                  <h3 className="font-medium text-lg text-white">{faq.q}</h3>
                  {selectedFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                <AnimatePresence>
                  {selectedFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-5 pb-5 text-slate-300 border-t border-slate-700/40 pt-3 whitespace-pre-line">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-12 bg-gradient-to-r from-indigo-900/40 to-violet-900/40 backdrop-blur-sm rounded-2xl border border-indigo-700/20 p-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-2xl font-bold text-white mb-4">
              Still Have Questions?
            </h3>
            <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
              Our team is ready to answer any questions you might have about the
              pilot program and how it can benefit your business.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                className="rounded-full border-slate-700 text-slate-200 hover:bg-slate-800"
                asChild
              >
                <a href="mailto:pilot@blueprint.ar">
                  <Send className="mr-2 w-4 h-4" /> Email Us
                </a>
              </Button>
              <Button
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white"
                asChild
              >
                <a href="https://calendly.com/blueprintar/30min">
                  <Video className="mr-2 w-4 h-4" /> Schedule a Call
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-indigo-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-700/10 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-violet-700/10 blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 mb-4 py-1.5 pl-2 pr-3">
                <Rocket className="w-4 h-4 mr-1" /> Limited Time Offer
              </Badge>
            </motion.div>

            <motion.h2
              className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Ready to Experience the Future?
            </motion.h2>

            <motion.p
              className="text-lg md:text-xl text-slate-300 mb-10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Join our exclusive pilot program today and transform your space
              with cutting-edge AR technology. Zero cost, zero risk, endless
              possibilities.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Button
                size="lg"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-6 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all text-lg"
                asChild
              >
                <a href="https://calendly.com/blueprintar/30min">
                  Book Your Free Pilot <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
            </motion.div>

            <motion.p
              className="text-slate-400 mt-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              Only 13 slots remaining this month. Reserve yours now.
            </motion.p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
