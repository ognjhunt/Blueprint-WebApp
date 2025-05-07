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

      {/* Process Overview */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto max-w-7xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-800">
              The Implementation Process
            </h2>
            <p className="text-xl text-gray-600">
              Our streamlined approach makes adopting AR technology simple and
              stress-free. Here's how we transform your physical space into an
              interactive AR experience.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative mb-20">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-indigo-300 via-blue-300 to-violet-300 transform -translate-y-1/2" />

            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
                className="relative z-10"
              >
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6 text-left">
                    <div className="flex flex-col items-center mb-4">
                      <div
                        className={`w-16 h-16 rounded-full mb-6 flex items-center justify-center text-white bg-gradient-to-br ${step.color}`}
                      >
                        {step.icon}
                      </div>
                      <h3 className="text-xl font-semibold mb-2 text-gray-800">
                        {idx + 1}. {step.title}
                      </h3>
                      <p className="text-gray-600 mb-4 text-center">
                        {step.description}
                      </p>
                    </div>
                    <ul className="space-y-2">
                      {step.benefits.map((benefit, bidx) => (
                        <li
                          key={bidx}
                          className="flex items-center text-gray-600"
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                          <span className="text-sm">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    {idx === 0 && (
                      <Button
                        className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
                        onClick={scrollToContact}
                      >
                        Join Waitlist
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Process Section */}
      <section ref={processRef} className="py-24 px-4 relative">
        <motion.div
          style={{ opacity, y }}
          className="container mx-auto max-w-7xl"
        >
          <div className="text-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-violet-600 inline-block text-transparent bg-clip-text">
                How Blueprint Works
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Our technology combines advanced 3D mapping, artificial
                intelligence, and augmented reality to create seamless
                interactive experiences.
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-indigo-100">
                <div className="flex justify-between mb-6">
                  {steps.map((step, idx) => (
                    <button
                      key={idx}
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        activeStep === idx
                          ? `text-white bg-gradient-to-br ${step.color}`
                          : "bg-gray-100 text-gray-500"
                      }`}
                      onClick={() => setActiveStep(idx)}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      className={`w-16 h-16 rounded-full mb-6 flex items-center justify-center text-white bg-gradient-to-br ${steps[activeStep].color}`}
                    >
                      {steps[activeStep].icon}
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-800">
                      {activeStep + 1}. {steps[activeStep].title}
                    </h3>
                    <p className="text-lg text-gray-600 mb-6">
                      {steps[activeStep].description}
                    </p>
                    <div className="bg-indigo-50 rounded-xl p-4">
                      <h4 className="font-semibold text-indigo-800 mb-2">
                        Benefits:
                      </h4>
                      <ul className="space-y-2">
                        {steps[activeStep].benefits.map((benefit, idx) => (
                          <li
                            key={idx}
                            className="flex items-center text-gray-700"
                          >
                            <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="rounded-2xl overflow-hidden shadow-2xl"
                >
                  {activeStep === 0 && (
                    <div className="relative">
                      <img
                        src="/images/waitlist.jpeg"
                        alt="Join Waitlist"
                        className="w-full aspect-video object-cover"
                        onError={(e) => {
                          e.target.src = "/images/grocery-store.jpeg";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/30 to-transparent" />
                      <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-indigo-100">
                        <h4 className="font-bold text-indigo-800">
                          Priority Access
                        </h4>
                        <p className="text-gray-700">
                          Join our waitlist to get early access and special
                          pricing.
                        </p>
                      </div>
                    </div>
                  )}
                  {activeStep === 1 && (
                    <div className="relative">
                      <img
                        src="/images/3d-mapping.jpeg"
                        alt="3D Mapping"
                        className="w-full aspect-video object-cover"
                        onError={(e) => {
                          e.target.src = "/images/retail-ar.jpeg";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/30 to-transparent" />
                      <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-indigo-100">
                        <h4 className="font-bold text-indigo-800">
                          Professional 3D Mapping
                        </h4>
                        <p className="text-gray-700">
                          Our specialists create accurate digital
                          representations of your space.
                        </p>
                      </div>
                    </div>
                  )}
                  {activeStep === 2 && (
                    <div className="relative">
                      <img
                        src="/images/customize.jpeg"
                        alt="Customize"
                        className="w-full aspect-video object-cover"
                        onError={(e) => {
                          e.target.src = "/images/hotel-ar.jpeg";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/30 to-transparent" />
                      <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-indigo-100">
                        <h4 className="font-bold text-indigo-800">
                          AI-Powered Customization
                        </h4>
                        <p className="text-gray-700">
                          Add interactive elements and preview your AR
                          experience in real-time.
                        </p>
                      </div>
                    </div>
                  )}
                  {activeStep === 3 && (
                    <div className="relative">
                      <img
                        src="/images/launch.jpeg"
                        alt="Launch"
                        className="w-full aspect-video object-cover"
                        onError={(e) => {
                          e.target.src = "/images/museum-ar.jpeg";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/30 to-transparent" />
                      <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-indigo-100">
                        <h4 className="font-bold text-indigo-800">
                          Interactive Customer Engagement
                        </h4>
                        <p className="text-gray-700">
                          Track analytics and optimize your AR experience for
                          maximum impact.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* AR Indicators */}
              <motion.div
                className={`absolute top-[20%] right-[20%] w-12 h-12 rounded-full border-2 border-indigo-400 flex items-center justify-center ${activeStep > 1 ? "opacity-100" : "opacity-0"}`}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: activeStep > 1 ? [0.8, 1, 0.8] : 0,
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
              >
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
              </motion.div>
            </div>
          </div>
        </motion.div>
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
      <AIChatButton />
    </div>
  );
}
