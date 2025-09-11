import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface SpotlightProps {
  targetRef: React.RefObject<HTMLElement>;
  show: boolean;
  children?: React.ReactNode;
  contentClassName?: string;
}

export const BlueprintSpotlight: React.FC<
  SpotlightProps & { allowPointerEvents?: boolean }
> = ({
  targetRef,
  show,
  children,
  contentClassName = "",
  allowPointerEvents = true,
}) => {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
  });

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!show) {
      setIsReady(false);
      return;
    }

    if (targetRef.current) {
      const timer = setTimeout(() => {
        const updatePosition = () => {
          const rect = targetRef.current?.getBoundingClientRect();
          if (rect) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            setPosition({
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              centerX,
              centerY,
            });
            setIsReady(true);
          }
        };

        updatePosition();

        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition);

        return () => {
          window.removeEventListener("resize", updatePosition);
          window.removeEventListener("scroll", updatePosition);
        };
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [show, targetRef, targetRef.current]);

  if (!show || !isReady) return null;

  const padding = 8;

  return (
    <div
      className={`fixed inset-0 z-[9998] ${allowPointerEvents ? "" : "pointer-events-none"}`}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full"
          style={{
            background: `radial-gradient(circle at ${position.centerX}px ${position.centerY}px, transparent ${Math.max(position.width, position.height) / 1.5}px, rgba(0, 0, 0, 0.3) ${Math.max(position.width, position.height) / 1.5 + 1}px)`,
            pointerEvents: "none",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="absolute rounded-lg pointer-events-none"
        style={{
          top: position.top - padding,
          left: position.left - padding,
          width: position.width + padding * 2,
          height: position.height + padding * 2,
          boxShadow:
            "0 0 0 3px rgba(99, 102, 241, 0.9), 0 0 0 6px rgba(99, 102, 241, 0.4)",
          zIndex: 10000,
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{
          opacity: [0.2, 0.5, 0.2],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className="absolute rounded-lg pointer-events-none"
        style={{
          top: position.top - padding,
          left: position.left - padding,
          width: position.width + padding * 2,
          height: position.height + padding * 2,
          boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.6)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={`absolute z-[10001] pointer-events-auto ${contentClassName}`}
        style={{
          // Special case for step 5 - Origin Point (large container target)
          ...(position.height > window.innerHeight * 0.5
            ? {
                // Position tooltip at the center-top of the screen for large containers
                top: 100,
                right: 16,
              }
            : position.top > window.innerHeight * 0.7
              ? {
                  // Position tooltip ABOVE the element when it's near the bottom
                  bottom: window.innerHeight - position.top + 16,
                  left: position.centerX,
                  transform: "translateX(-50%)",
                }
              : contentClassName.includes("right-")
                ? {
                    // Use right positioning if right class is present
                    top: position.top + position.height + 16,
                    right: 16,
                  }
                : {
                    // Default positioning below the element
                    top: position.top + position.height + 16,
                    left: position.centerX,
                    transform: "translateX(-50%)",
                  }),
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};
