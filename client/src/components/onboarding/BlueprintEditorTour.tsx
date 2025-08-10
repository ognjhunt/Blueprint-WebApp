import React, { useState } from "react";
import { BlueprintTooltip } from "@/components/onboarding/BlueprintTooltip";

interface TourProps {
  onFinish: () => void;
}

const steps = [
  {
    title: "Welcome to the Editor",
    description:
      "This is the Blueprint Editor. Here you can navigate your 3D space and add interactive elements.",
  },
  {
    title: "Mark Areas",
    description:
      "Use the Mark Areas tool to highlight important locations within your space.",
  },
  {
    title: "Elements Panel",
    description:
      "Add text, media and links using the elements panel on the left side.",
  },
  {
    title: "Activation",
    description:
      "When you're ready, activate your Blueprint to make it live.",
  },
];

export const BlueprintEditorTour: React.FC<TourProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  };

  const skip = () => {
    onFinish();
  };

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <BlueprintTooltip
        title={current.title}
        description={current.description}
        onNext={next}
        onSkip={skip}
        currentStep={step}
        totalSteps={steps.length}
        isFirstStep={step === 0}
        isLastStep={step === steps.length - 1}
      />
    </div>
  );
};

export default BlueprintEditorTour;
