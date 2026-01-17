import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, Edit3, Box, MapPin, QrCode } from "lucide-react";

interface WelcomeModalProps {
  show: boolean;
  onStart: () => void;
  onSkip: () => void;
}

export const BlueprintWelcomeModal: React.FC<WelcomeModalProps> = ({
  show,
  onStart,
  onSkip,
}) => {
  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl w-[600px] max-w-[90vw] max-h-[90vh] overflow-hidden"
          >
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={onSkip}
                aria-label="Skip tour"
              >
                <X className="h-5 w-5" />
              </Button>

              <h2 className="text-2xl font-bold">
                Welcome to Blueprint Editor
              </h2>
              <p className="text-indigo-100 mt-2">
                Let's take a quick tour to help you get started with creating
                amazing AR experiences
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-8">
                {[
                  {
                    icon: <Edit3 className="h-8 w-8 text-indigo-500" />,
                    title: "Design Your Space",
                    description:
                      "Easily create and customize interactive elements in your blueprint.",
                  },
                  {
                    icon: <Box className="h-8 w-8 text-blue-500" />,
                    title: "2D & 3D Views",
                    description:
                      "Switch between 2D and 3D views to visualize your space perfectly.",
                  },
                  {
                    icon: <MapPin className="h-8 w-8 text-purple-500" />,
                    title: "Place AR Elements",
                    description:
                      "Add markers, info cards, and interactive elements to your space.",
                  },
                  {
                    icon: <QrCode className="h-8 w-8 text-green-500" />,
                    title: "Generate QR Codes",
                    description:
                      "Create QR codes for easy access to your AR experiences.",
                  },
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.1 }}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                  >
                    <div className="rounded-full w-14 h-14 bg-white flex items-center justify-center shadow-sm mb-3">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="text-gray-500"
                >
                  Skip Tour
                </Button>

                <Button
                  onClick={onStart}
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6"
                >
                  Start Tour
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
