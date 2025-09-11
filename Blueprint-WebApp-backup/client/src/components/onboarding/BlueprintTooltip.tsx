import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface TooltipProps {
  title: string;
  description: string;
  onNext: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  currentStep: number;
  totalSteps: number;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  isNextDisabled?: boolean;
}

export const BlueprintTooltip: React.FC<TooltipProps> = ({
  title,
  description,
  onNext,
  onPrev,
  onSkip,
  currentStep,
  totalSteps,
  isFirstStep = false,
  isLastStep = false,
  isNextDisabled = false,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-xl p-5 max-w-md border-2 border-indigo-100 w-80">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {onSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-gray-600">{description}</p>
        {isNextDisabled && (
          <p className="text-red-500 text-sm mt-2">
            Please complete the required action to proceed.
          </p>
        )}
        <div className="flex justify-between pt-2">
          <div className="text-xs text-gray-500">
            Step {currentStep + 1} of {totalSteps}
          </div>
          <div className="flex space-x-2">
            {!isFirstStep && onPrev && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPrev}
                className="text-gray-600 border-gray-300"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={onNext}
              disabled={isNextDisabled}
              className={`bg-gradient-to-r ${
                isLastStep
                  ? "from-green-500 to-emerald-600"
                  : "from-indigo-600 to-blue-600"
              } ${isNextDisabled ? "opacity-50 cursor-not-allowed" : "hover:from-indigo-700 hover:to-blue-700"} text-white shadow-md`}
            >
              {isLastStep ? "Finish" : "Next"}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
