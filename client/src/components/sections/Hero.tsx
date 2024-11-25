import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import ARDemoViewer from "@/components/ARDemoViewer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Hero() {
  const headlines = [
    {
      title: "Enter the Spatial Era with Blueprint",
      subtitle: "Transform your business with powerful AR technology—no custom app required."
    },
    {
      title: "Enter the Spatial Era with Blueprint",
      subtitle: "Create immersive customer experiences that drive engagement and growth."
    },
    {
      title: "Enter the Spatial Era with Blueprint",
      subtitle: "Join industry leaders using AR to revolutionize customer interactions."
    },
    {
      title: "Enter the Spatial Era with Blueprint",
      subtitle: "Blueprint provides a powerful, all-in-one platform—streamlining customer engagement and enhancing your in-person experiences."
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % headlines.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white pt-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1 
              className="text-4xl md:text-5xl font-bold mb-6"
              key={`title-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {headlines[currentIndex].title}
            </motion.h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={`subtitle-${currentIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
              >
                {headlines[currentIndex].subtitle}
              </motion.p>
            </AnimatePresence>
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
