/**
 * ScrollReveal — lightweight scroll-triggered entrance wrapper.
 * Uses framer-motion `useInView` + GPU-friendly transforms (opacity + translateY).
 * Respects prefers-reduced-motion.
 */
import { motion, useReducedMotion, type Variant } from "framer-motion";
import { type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  /** Delay in seconds before animating in */
  delay?: number;
  /** Distance (px) the element slides up from */
  distance?: number;
  /** Duration of the entrance */
  duration?: number;
  /** IntersectionObserver margin — negative shrinks the trigger zone */
  viewMargin?: string;
  /** If true, animates every time it enters the viewport */
  once?: boolean;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span";
}

const hidden: Variant = { opacity: 0 };
const visible: Variant = { opacity: 1 };

export function ScrollReveal({
  children,
  delay = 0,
  distance = 32,
  duration = 0.6,
  viewMargin = "-60px 0px",
  once = true,
  className,
  as = "div",
}: ScrollRevealProps) {
  const shouldReduce = useReducedMotion();
  const Tag = motion[as] as any;

  return (
    <Tag
      initial={shouldReduce ? visible : { ...hidden, y: distance }}
      whileInView={shouldReduce ? visible : { ...visible, y: 0 }}
      viewport={{ once, margin: viewMargin }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for smooth decel
      }}
      className={className}
    >
      {children}
    </Tag>
  );
}
