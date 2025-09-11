import React from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

export function ProgressBadge({ currentStep, totalSteps, className = "" }) {
  const progress = Math.round((currentStep / (totalSteps - 1)) * 100);

  return (
    <motion.div
      className={`fixed bottom-4 right-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full shadow-lg z-[990] flex items-center px-4 py-2 ${className}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mr-3">
        {progress < 100 ? (
          <span className="text-xs font-bold">{progress}%</span>
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-xs font-medium">Blueprint Tour</p>
        <p className="text-xs opacity-80">
          Step {currentStep + 1} of {totalSteps}
        </p>
      </div>
    </motion.div>
  );
}
