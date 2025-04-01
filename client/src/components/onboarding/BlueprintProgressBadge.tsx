import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface ProgressBadgeProps {
  currentStep: number;
  totalSteps: number;
}

export const BlueprintProgressBadge: React.FC<ProgressBadgeProps> = ({
  currentStep,
  totalSteps,
}) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9997] shadow-lg"
    >
      <div className="flex items-center bg-white rounded-full px-4 py-2 border border-indigo-100 shadow-md">
        <div className="flex items-center space-x-2 mr-3">
          <div className="text-indigo-600 font-semibold text-sm">
            Onboarding Tour
          </div>
          <div className="text-gray-400">|</div>
          <div className="text-gray-600 text-sm">
            {currentStep + 1} of {totalSteps}
          </div>
        </div>
        <div className="w-24 h-2 bg-gray-200 rounded-full">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-indigo-600 to-blue-600 rounded-full"
          />
        </div>
        {currentStep === totalSteps - 1 && (
          <CheckCircle2 className="ml-2 h-4 w-4 text-green-500" />
        )}
      </div>
    </motion.div>
  );
};
