import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Box, MousePointer } from "lucide-react";

interface DragDropDemonstrationProps {
  sourceRef: React.RefObject<HTMLElement>;
  targetRef: React.RefObject<HTMLElement>;
  onComplete?: () => void;
}

const DragDropDemonstration: React.FC<DragDropDemonstrationProps> = ({
  sourceRef,
  targetRef,
  onComplete,
}) => {
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedModel, setSelectedModel] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (sourceRef.current && targetRef.current) {
      const sRect = sourceRef.current.getBoundingClientRect();
      const tRect = targetRef.current.getBoundingClientRect();

      setSourceRect(sRect);
      setTargetRect(tRect);

      // Initial cursor position at center of source
      setCursor({
        x: sRect.left + sRect.width / 2,
        y: sRect.top + sRect.height / 2,
      });

      // Set demo model dimensions
      const modelItem = sourceRef.current.querySelector("div");
      if (modelItem) {
        const modelRect = modelItem.getBoundingClientRect();
        setSelectedModel({
          top: modelRect.top,
          left: modelRect.left,
          width: modelRect.width,
          height: modelRect.height,
        });
      }
    }
  }, [sourceRef, targetRef]);

  useEffect(() => {
    if (sourceRect && targetRect && !isComplete) {
      const demoSequence = async () => {
        // Move cursor to the model
        await animateCursor(
          selectedModel.left + selectedModel.width / 2,
          selectedModel.top + selectedModel.height / 2,
        );

        // Click and hold
        setIsDragging(true);
        await delay(300);

        // Drag to the target
        await animateCursor(
          targetRect.left + targetRect.width / 2,
          targetRect.top + targetRect.height / 2,
        );

        // Release
        setIsDragging(false);
        setIsComplete(true);

        // Wait a bit then notify completion
        await delay(1000);
        if (onComplete) onComplete();
      };

      // Start the demo after a delay
      const timer = setTimeout(() => {
        demoSequence();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [sourceRect, targetRect, selectedModel, isComplete, onComplete]);

  const animateCursor = async (x: number, y: number) => {
    // Simple animation function using timeouts
    const startX = cursor.x;
    const startY = cursor.y;
    const endX = x;
    const endY = y;
    const duration = 1000; // 1 second
    const steps = 30;

    for (let step = 0; step <= steps; step++) {
      const progress = step / steps;
      const newX = startX + (endX - startX) * progress;
      const newY = startY + (endY - startY) * progress;

      setCursor({ x: newX, y: newY });
      await delay(duration / steps);
    }
  };

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  if (!sourceRect || !targetRect) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {/* The cursor */}
      <motion.div
        className="absolute z-[9999]"
        style={{
          position: "absolute",
          top: cursor.y,
          left: cursor.x,
          transform: "translate(-50%, -50%)",
        }}
      >
        <MousePointer className="text-blue-600 h-6 w-6 stroke-[2.5px]" />
      </motion.div>

      {/* The dragged item */}
      {isDragging && (
        <motion.div
          className="absolute bg-white border-2 border-blue-500 rounded-lg shadow-lg p-2 flex items-center justify-center"
          style={{
            top: cursor.y,
            left: cursor.x,
            width: 100,
            height: 80,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Box className="text-blue-500 h-8 w-8" />
          <span className="ml-2 text-sm font-medium">Model</span>
        </motion.div>
      )}
    </div>
  );
};

export default DragDropDemonstration;
