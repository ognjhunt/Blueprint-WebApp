import React from "react";
import { motion } from "framer-motion";

export function Spotlight({
  children,
  targetRef,
  show,
  spotlightClassName = "",
  contentClassName = "",
  spotlightSize = 20, // in px
  spotlightColor = "rgba(99, 102, 241, 0.4)", // Indigo color with opacity
  onClick,
  onComplete,
}) {
  const [position, setPosition] = React.useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // Update position when target element changes or on window resize
  React.useEffect(() => {
    const updatePosition = () => {
      if (targetRef && targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const scrollX = window.scrollX || document.documentElement.scrollLeft;

        setPosition({
          left: rect.left + scrollX,
          top: rect.top + scrollY,
          width: rect.width,
          height: rect.height,
        });

        // If element is not in view, scroll to it
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          targetRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [targetRef, show]);

  if (!show || !targetRef || !targetRef.current) {
    return null;
  }

  return (
    <motion.div
      className={`fixed inset-0 z-[999] pointer-events-none ${spotlightClassName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onAnimationComplete={onComplete}
    >
      {/* Dimmed background with spotlight effect */}
      <div
        className="absolute inset-0 bg-black/50"
        style={{
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 ${spotlightSize}px ${spotlightColor} inset`,
          borderRadius: "8px",
          left: position.left - spotlightSize / 2,
          top: position.top - spotlightSize / 2,
          width: position.width + spotlightSize,
          height: position.height + spotlightSize,
        }}
        onClick={onClick}
      />

      {/* Content positioned near the highlighted element */}
      <motion.div
        className={`absolute z-[1000] pointer-events-auto max-w-xs ${contentClassName}`}
        style={{
          left: position.left + position.width / 2,
          top: position.top + position.height + 10,
          transform: "translateX(-50%)",
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
