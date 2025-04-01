import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Nav from "@/components/Nav";
import Hero from "@/components/sections/Hero";
import Features from "@/components/sections/Features";
import ContactForm from "@/components/sections/ContactForm";
import Footer from "@/components/Footer";
import AIChatButton from "@/components/AIChatButton";
import Testimonials from "@/components/sections/Testimonials";
import LocationShowcase from "@/components/sections/LocationShowcase";
import { motion, useScroll, useTransform } from "framer-motion";

export default function Home() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const mainRef = useRef(null);

  // Parallax scrolling effect
  const { scrollYProgress } = useScroll({
    target: mainRef,
    offset: ["start start", "end start"],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  useEffect(() => {
    if (currentUser) {
      setLocation("/dashboard");
    }
  }, [currentUser, setLocation]);

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
        <Features />
        {/* <Testimonials /> */}
        <ContactForm />
      </main>

      <Footer />
      <AIChatButton />
    </div>
  );
}
