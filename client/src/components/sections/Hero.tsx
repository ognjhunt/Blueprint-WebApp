import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Hero() {
  return (
    <section className="hero-gradient min-h-screen flex items-center relative overflow-hidden pt-16">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6">
              Transform Your Space with
              <span className="gradient-text block">Blueprint AR</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Revolutionize customer engagement with augmented reality experiences that drive revenue and operational efficiency.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/create-blueprint">
                <Button size="lg" className="text-lg">
                  Create Blueprint
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg">
                View Case Studies
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <img
              src="https://images.unsplash.com/photo-1580983219883-8463619d50e5"
              alt="AR Business Implementation"
              className="rounded-lg shadow-2xl w-full"
            />
            <div className="absolute -bottom-4 -right-4 bg-white p-4 rounded-lg shadow-lg">
              <p className="text-2xl font-bold text-primary">+45%</p>
              <p className="text-sm text-gray-600">Average Revenue Increase</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating Elements */}
      <motion.div
        animate={{
          y: [0, -20, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/4 right-10 w-16 h-16 bg-blue-500/10 rounded-full"
      />
      <motion.div
        animate={{
          y: [0, 20, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-1/4 left-10 w-24 h-24 bg-indigo-500/10 rounded-full"
      />
    </section>
  );
}
