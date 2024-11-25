import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "wouter";
import ARDemoViewer from "@/components/ARDemoViewer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Hero() {
  const headlines = [
    {
      title: "Enter the Spatial Era with Blueprint",
      subtitle: "Transform your business with our powerful AR platform—no custom app required.",
    },
    {
      title: "Revolutionize Customer Experience with AR",
      subtitle: "Join industry leaders using Blueprint to create immersive, memorable experiences that drive growth.",
    },
    {
      title: "Your Business, Enhanced by AR Technology",
      subtitle: "Streamline engagement and boost revenue with Blueprint's seamless AR integration platform.",
    },
    {
      title: "Step Into the Future of Business",
      subtitle: "Blueprint makes AR technology accessible and impactful for businesses of all sizes.",
    }
  ];

  const [currentHeadline, setCurrentHeadline] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeadline((current) => (current + 1) % headlines.length);
    }, 5000); // Change headline every 5 seconds

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white pt-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            key={currentHeadline}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={{
              hidden: { opacity: 0, x: -20 },
              visible: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: 20 }
            }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <motion.h1 
              className="text-4xl md:text-5xl font-bold mb-6"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: -20 }
              }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {headlines[currentHeadline].title}
            </motion.h1>
            <motion.p 
              className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: -20 }
              }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {headlines[currentHeadline].subtitle}
            </motion.p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create-blueprint">
                <Button size="lg" className="text-lg px-8">
                  Create Blueprint
                </Button>
              </Link>
              <Link href="/claim-blueprint">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Claim Existing Blueprint
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Join 1,000+ businesses already using Blueprint AR
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
