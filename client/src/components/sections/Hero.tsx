"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Link } from "wouter";
import { PlayIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { Info } from "lucide-react";

export default function Hero() {
  const headlines = [
    {
      text: "Reimagine Your Business",
      highlight: "With Blueprint AR",
      description:
        "Transform physical spaces into interactive experiences that delight your customers and drive results.",
    },
    {
      text: "Reimagine Customer Engagement",
      highlight: "Without Building an App",
      description:
        "Create immersive AR experiences that work directly in your customers' browsers—no downloads required.",
    },
    {
      text: "Reimagine Physical Spaces",
      highlight: "With Digital Interactions",
      description:
        "Bridge the physical and digital worlds with AR experiences that enhance how customers engage with your brand.",
    },
    {
      text: "Reimagine What's Possible",
      highlight: "With Blueprint",
      description:
        "Join forward-thinking businesses already transforming their spaces with our cutting-edge AR technology.",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const heroRef = useRef(null);
  const isInView = useInView(heroRef, { once: true });

  const handleScrollToContactForm = () => {
    const contactFormElement = document.getElementById("contactForm");
    if (contactFormElement) {
      contactFormElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [headlines.length]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-[90vh] flex items-center justify-center py-16 md:py-20 lg:py-24 overflow-hidden"
    >
      {/* Animated elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-violet-300/30 to-fuchsia-300/30 blur-3xl"
          animate={{
            y: [0, 15, 0],
            x: [0, 10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
        />
        <motion.div
          className="absolute bottom-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-tr from-blue-300/20 to-cyan-300/20 blur-3xl"
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1,
          }}
        />
      </div>

      {/* 3D Device Mock */}
      <motion.div
        className="absolute -right-[10%] lg:right-0 bottom-0 w-[60%] h-full max-w-xl"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: isInView ? 1 : 0, x: isInView ? 0 : 100 }}
        transition={{ duration: 1.2, delay: 0.5 }}
      >
        <div className="h-full relative flex items-center justify-center">
          <img
            src="/images/grocerystoreafter2.png"
            alt="AR on smartphone"
            className="w-full h-auto object-contain"
          />

          {/* AR indicators */}
          <motion.div
            className="absolute top-[30%] left-[20%] w-12 h-12 rounded-full border-2 border-indigo-400 flex items-center justify-center"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 0.8, 1] }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
          </motion.div>

          <motion.div
            className="absolute top-[28%] left-[18%] text-sm font-medium bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-indigo-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.5 }}
          >
            <span className="text-indigo-600">AR Object</span>
          </motion.div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 text-center lg:text-left relative z-10 lg:max-w-3xl lg:ml-20 xl:ml-32">
        <motion.div
          className="inline-block mb-3 bg-indigo-50 text-indigo-700 py-1 px-4 rounded-full text-sm font-medium tracking-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
          transition={{ duration: 0.6 }}
        >
          Next-Generation AR + AI Platform
        </motion.div>

        {/* Modified headline container - no fixed height, using min-height instead */}
        <div className="min-h-[200px] sm:min-h-[180px] md:min-h-[220px] flex flex-col mb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              className="w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-tight text-gray-800">
                {headlines[currentIndex].text}{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-transparent bg-clip-text">
                  {headlines[currentIndex].highlight}
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0">
                {headlines[currentIndex].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <Button
            size="lg"
            className="text-lg px-8 py-6 tracking-wide shadow-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 hover:scale-105 transition-all duration-300"
            onClick={handleScrollToContactForm}
          >
            Join Waitlist
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </Button>

          {/* <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6 tracking-wide border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:scale-105 transition-all duration-300"
          >
            <PlayIcon className="w-5 h-5 mr-2" />
            Watch Demo
          </Button> */}
          <Link href="/discover">
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 tracking-wide border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:scale-105 transition-all duration-300"
            >
              <Info className="w-5 h-5 mr-2" />
              How It Works
            </Button>
          </Link>
        </motion.div>

        <motion.div
          className="mt-12 flex items-center justify-center lg:justify-start gap-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-white overflow-hidden"
              >
                <img
                  src={`/images/avatar-${i}.jpg`}
                  alt="User avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=User+${i}&background=818cf8&color=fff`;
                  }}
                />
              </div>
            ))}
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center border-2 border-white font-medium">
              +2k
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">2,000+</span>{" "}
            businesses trust Blueprint
          </div>
        </motion.div>
      </div>
    </section>
  );
}
