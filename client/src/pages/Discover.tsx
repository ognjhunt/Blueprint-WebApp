import React, { useRef, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { Link } from "wouter";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AIChatButton from "@/components/AIChatButton";
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
} from "lucide-react";
// Insert this block right after your import statements and before your Discover component

const ImageCarousel = () => {
  const slides = [
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 08_32_27 AM.png",
      alt: "Step 1: Your first step description",
      caption:
        "Step 1: Our mapping specialist will meet your contact at the scheduled date + time. (estimated time: 5 mins)",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 08_50_20 AM.png",
      alt: "Step 2: Your second step description",
      caption:
        "Step 2: After a brief overview, the mapper will start scanning your location. (estimated time: 20 mins)",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 10_28_16 AM.png",
      alt: "Step 3: Your third step description",
      caption:
        "Step 3: Within minutes, our AI Agent will create a customized AR experience for customers. The location contact has the option to test it out and further edit _____. (estimated time: 15 mins)",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 09_03_13 AM.png",
      alt: "Step 4: Your fourth step description",
      caption:
        "Step 4: Once finished, with the help of the location contact, we'll place QR codes in the ideal positions for customers. (estimated time: 15 mins)",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 09_08_15 AM.png",
      alt: "Step 5: Your final step description",
      caption:
        "Step 5: Customers with smart glasses can now easily enter a personalized experience at your location by scanning a QR code.",
    },
    {
      src: "/images/ChatGPT Image Apr 9, 2025, 10_33_42 AM.png",
      alt: "Step 6: Your final step description",
      caption:
        "Step 6: Continuous Improvement. Using data + analytics, Blueprint's Agent will continue to update your location's experience.",
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delay = 6000; // slide duration in milliseconds

  // Clear timeout before starting a new one
  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => {
    resetTimeout();
    timeoutRef.current = setTimeout(() => {
      setActiveIndex((prevIndex) =>
        prevIndex === slides.length - 1 ? 0 : prevIndex + 1,
      );
    }, delay);
    return () => {
      resetTimeout();
    };
  }, [activeIndex, slides.length]);

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
      <div className="relative w-full aspect-[3/2]">
        <AnimatePresence>
          <motion.img
            key={activeIndex}
            src={slides[activeIndex].src}
            alt={slides[activeIndex].alt}
            className="absolute top-0 left-0 w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        </AnimatePresence>
        {/* Caption overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 text-center">
          {slides[activeIndex].caption}
        </div>
      </div>
      {/* Manual Controls */}
      <div className="absolute inset-0 flex items-center justify-between px-4">
        <button
          onClick={() =>
            setActiveIndex(
              activeIndex === 0 ? slides.length - 1 : activeIndex - 1,
            )
          }
          className="bg-black bg-opacity-50 text-white p-2 rounded-full focus:outline-none"
        >
          Prev
        </button>
        <button
          onClick={() =>
            setActiveIndex(
              activeIndex === slides.length - 1 ? 0 : activeIndex + 1,
            )
          }
          className="bg-black bg-opacity-50 text-white p-2 rounded-full focus:outline-none"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const handleScrollToContactForm = () => {
  const contactFormElement = document.getElementById("contactForm");
  if (contactFormElement) {
    contactFormElement.scrollIntoView({ behavior: "smooth" });
  }
};

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

const steps = [
  {
    icon: <MapPin className="w-8 h-8" />,
    title: "Join Waitlist",
    description:
      "Provide your business details to secure early access to Blueprint.",
    benefits: ["Priority access", "Early adopter pricing", "Direct support"],
    color: "from-indigo-500 to-blue-600",
  },
  {
    icon: <Edit className="w-8 h-8" />,
    title: "Schedule 3D Mapping",
    description:
      "Once off the waitlist, you'll receive an email that contains a link to schedule a convenient time for us to map your location.",
    benefits: ["Flexible scheduling", "Professional team", "Quick process"],
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: <Wand2 className="w-8 h-8" />,
    title: "Customize & Preview",
    description:
      "After mapping, our AI generates a customized AR solution for the digital twin of your space, which you can preview in real-time.",
    benefits: ["AI-powered setup", "Real-time preview", "Custom features"],
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: <PlayCircle className="w-8 h-8" />,
    title: "Launch & Engage",
    description:
      "Go live with your AR experience and track customer engagement with your strategically placed QR codes.",
    benefits: ["Instant deployment", "Usage analytics", "Customer insights"],
    color: "from-fuchsia-500 to-pink-600",
  },
];

// Technology sections
const techSections = [
  {
    icon: <Layers className="w-8 h-8 text-indigo-500" />,
    title: "No App Required",
    description:
      "Our AR experiences work directly in mobile browsers, eliminating the friction of app downloads.",
  },
  {
    icon: <Code className="w-8 h-8 text-blue-500" />,
    title: "Easy Integration",
    description:
      "Seamlessly integrates with your existing systems, website, and marketing materials.",
  },
  {
    icon: <Globe className="w-8 h-8 text-teal-500" />,
    title: "Works Anywhere",
    description:
      "AR experiences are location-aware and can be triggered through QR codes or App Clips.",
  },
  {
    icon: <Users className="w-8 h-8 text-purple-500" />,
    title: "Multi-User Support",
    description:
      "Allow customers to interact with the same AR elements simultaneously.",
  },
  {
    icon: <PenTool className="w-8 h-8 text-pink-500" />,
    title: "Custom Designs",
    description:
      "Create unique AR elements that match your brand identity and space aesthetics.",
  },
  {
    icon: <Activity className="w-8 h-8 text-orange-500" />,
    title: "Analytics Dashboard",
    description:
      "Track user engagement, popular elements, and conversion metrics.",
  },
];

export default function Discover() {
  const contactFormRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: processRef,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [100, 0, 0, 100]);

  const scrollToContact = () => {
    contactFormRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-blue-50">
      {/* Animated background patterns */}
      <div className="fixed inset-0 z-[-2] opacity-70">
        <motion.div
          className="absolute w-[70vw] h-[70vw] rounded-full bg-gradient-to-r from-violet-300/30 to-fuchsia-300/30 blur-3xl"
          style={{ top: "-35vw", right: "-20vw" }}
          animate={{
            y: [0, 10, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        <motion.div
          className="absolute w-[50vw] h-[50vw] rounded-full bg-gradient-to-r from-blue-300/20 to-cyan-300/20 blur-3xl"
          style={{ bottom: "-20vw", left: "-10vw" }}
          animate={{
            y: [0, -15, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1,
          }}
        />
      </div>

      {/* Subtle grid pattern overlay */}
      <motion.div className="fixed inset-0 z-[-1] opacity-[0.07] bg-[url('/images/grid-pattern.svg')] bg-repeat" />

      <Nav />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 relative overflow-hidden">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              <div className="inline-block mb-3 bg-indigo-50 text-indigo-700 py-1 px-4 rounded-full text-sm font-medium tracking-wide">
                Implementation Process
              </div>
              <h1 className="text-5xl font-bold leading-tight text-gray-800">
                Transform Spaces Into{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                  Interactive Experiences
                </span>
              </h1>
              <p className="text-xl text-gray-600">
                Blueprint uses advanced AR and AI technology to create immersive
                environments that engage your customers without requiring any
                app downloads.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  size="lg"
                  className="py-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md hover:shadow-indigo-200/50 hover:scale-105 transition-all duration-300"
                  onClick={scrollToContact}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="py-6 text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-50 hover:scale-105 transition-all duration-300"
                  onClick={() => {
                    processRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  See How It Works
                  <ArrowDown className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative"
            >
              {/* Replace the static image with the carousel */}
              <ImageCarousel />
            </motion.div>
          </div>
        </div>
      </section>

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
              Our streamlined approach makes adopting AR technology simple and
              stress-free. Get your interactive experience live in under 24
              hours.
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
                        {/* Duration info - add step.duration to your steps array if needed */}
                        {step.title}
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
                          <span className="text-sm font-medium">{benefit}</span>
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
              See Pricing & Get Started
              <ArrowDown className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Technology Highlights */}
      <section className="py-24 px-4 bg-indigo-50/50">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-6 text-gray-800">
              Advanced Technology Made Simple
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Blueprint combines cutting-edge technology with user-friendly
              interfaces to make advanced AR accessible for every business.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
            {techSections.map((tech, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="mb-6">{tech.icon}</div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">
                      {tech.title}
                    </h3>
                    <p className="text-gray-600">{tech.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-20 text-center"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg hover:shadow-indigo-200/50 py-6 px-8 text-lg hover:scale-105 transition-all duration-300"
              onClick={scrollToContact}
            >
              Start Your AR Journey
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section ref={contactFormRef} className="py-24">
        <div className="container mx-auto max-w-7xl px-4">
          <ContactForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
