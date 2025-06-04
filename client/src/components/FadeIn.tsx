import React, { useState, useEffect, useRef } from "react";

// Add this CSS-based animation alternative
const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
};

// Simple fade-in component to replace heavy Framer Motion
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  threshold?: number; // Add threshold to props
  yOffset?: number; // Add yOffset for subtle upward animation
}

const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  className = "",
  threshold = 0.1,
  yOffset = 20,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Apply delay only if not preferring reduced motion
          if (!prefersReducedMotion) {
            setTimeout(() => setIsVisible(true), delay * 1000);
          } else {
            setIsVisible(true);
          }
        }
      },
      { threshold }, // Use threshold from props
    );

    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) {
        observer.unobserve(ref.current); // Clean up observer
      }
      observer.disconnect();
    };
  }, [delay, prefersReducedMotion, threshold]); // Add prefersReducedMotion and threshold to dependency array

  const transformStyle =
    isVisible || prefersReducedMotion
      ? "translateY(0)"
      : `translateY(${yOffset}px)`;

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        // Changed to transition-all and ease-out
        isVisible || prefersReducedMotion ? "opacity-100" : "opacity-0"
      } ${className}`}
      style={{ transform: transformStyle }} // Apply transform for subtle upward animation
    >
      {children}
    </div>
  );
};

export default FadeIn;
