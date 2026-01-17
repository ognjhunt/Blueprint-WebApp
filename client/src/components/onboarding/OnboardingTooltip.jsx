import React from "react";
import { motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingTooltip({
  title,
  description,
  onNext,
  onSkip,
  onPrev,
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  className = "",
}) {
  return (
    <motion.div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-64 ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
          {title}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onSkip}
          aria-label="Skip tour"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {description}
      </p>

      {/* Steps indicator - centered */}
      <div className="flex justify-center space-x-1 mb-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-6 rounded-full ${
              i === currentStep
                ? "bg-indigo-600 dark:bg-indigo-500"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Navigation buttons - centered below steps */}
      <div className="flex justify-center items-center space-x-2">
        {!isFirstStep && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-4 bg-transparent"
            // onClick={onPrev}
            onClick={onNext}
          >
            Back
          </Button>
        )}
        <Button
          className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center"
          size="sm"
          onClick={onNext}
        >
          {isLastStep ? "Finish" : "Next"}
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}
