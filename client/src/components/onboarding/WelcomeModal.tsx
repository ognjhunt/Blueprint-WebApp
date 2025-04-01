import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Building2, Rocket, LineChart, Award, ArrowRight } from "lucide-react";

export function WelcomeModal({ show, onStart, onSkip }) {
  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden max-w-xl w-full"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Colorful header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white relative overflow-hidden">
              <div className="absolute w-64 h-64 rounded-full bg-white/10 -top-32 -right-32" />
              <div className="absolute w-32 h-32 rounded-full bg-white/10 top-10 -right-10" />

              <h2 className="text-2xl font-bold relative z-10">
                Welcome to Blueprint!
              </h2>
              <p className="relative z-10 mt-1">
                Your 3D space is ready to explore
              </p>
            </div>

            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your space has been successfully scanned and is now ready for
                you to explore. Let's take a quick tour to help you get the most
                out of Blueprint.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  {
                    icon: <Building2 className="h-5 w-5 text-indigo-600" />,
                    title: "View Your Space",
                    description: "Explore your 3D space and see how it looks.",
                  },
                  {
                    icon: <LineChart className="h-5 w-5 text-violet-600" />,
                    title: "Track Analytics",
                    description: "Monitor visitor engagement and interaction.",
                  },
                  {
                    icon: <Award className="h-5 w-5 text-amber-500" />,
                    title: "Customize Experience",
                    description: "Add interactive elements to engage visitors.",
                  },
                  {
                    icon: <Rocket className="h-5 w-5 text-rose-600" />,
                    title: "Share & Promote",
                    description: "Get your space in front of customers.",
                  },
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-8">
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="text-gray-500"
                >
                  Skip tour
                </Button>
                <Button
                  onClick={onStart}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6"
                >
                  Start tour <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
