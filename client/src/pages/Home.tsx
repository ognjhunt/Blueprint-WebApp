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
//import AIChatButton from "@/components/AIChatButton";
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
} from "lucide-react";

export default function Home() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const mainRef = useRef(null);
  const contactFormRef = useRef(null);

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
    // Check if the Lindy script is already added to prevent duplicates
    const lindyScriptId = "lindy-embed-script";
    if (document.getElementById(lindyScriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = lindyScriptId;
    script.src =
      "https://api.lindy.ai/api/lindyEmbed/lindyEmbed.js?a=9620fed7-bdfb-4329-ada0-b60963170c59";
    script.async = true;
    script.crossOrigin = "use-credentials"; // In JS, HTML 'crossorigin' attribute is 'crossOrigin'

    document.body.appendChild(script);

    // Optional: Cleanup function to remove the script when the component unmounts
    // This might be desired if Home component can unmount and you want to clean up.
    // For a chatbot that should persist, you might omit the cleanup or make it conditional.
    return () => {
      const existingScript = document.getElementById(lindyScriptId);
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount

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
      <motion.div
        className="fixed inset-0 z-[-1] opacity-[0.07] bg-[url('/images/grid-pattern.svg')] bg-repeat"
        style={{ y: backgroundY }}
      />

      <Nav />

      <main ref={mainRef} className="flex-1 relative z-10">
        <Hero />

        {/* Floating badges section */}
        <div className="relative py-12 overflow-hidden">
          <div className="container mx-auto px-4">
            <motion.div
              className="flex flex-wrap justify-center gap-3 py-6"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ staggerChildren: 0.1, delayChildren: 0.1 }}
            >
              {[
                "Fast Setup",
                "No App Required",
                "Easy Integration",
                "Real-time Analytics",
                "Customizable",
              ].map((badge, index) => (
                <motion.div
                  key={badge}
                  className="bg-white/80 backdrop-blur-sm border border-indigo-100 rounded-full px-4 py-2 shadow-sm text-indigo-800 font-medium text-sm"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 50,
                  }}
                >
                  {badge}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        <LocationShowcase />
        {/* <Features /> */}
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
                          onClick={handleScrollToContactForm}
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
        {/* <Testimonials /> */}
        <ContactForm />
      </main>

      <Footer />
    </div>
  );
}
