/**
 * StaggerGroup — wraps children with staggered scroll-triggered entrance.
 * Each direct child gets a sequential delay.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";

interface StaggerGroupProps {
  children: ReactNode;
  /** Base delay before first child animates */
  baseDelay?: number;
  /** Incremental delay between children */
  stagger?: number;
  /** Slide distance in px */
  distance?: number;
  /** Animation duration per child */
  duration?: number;
  className?: string;
  once?: boolean;
  viewMargin?: string;
}

const containerVariants = {
  hidden: {},
  visible: (custom: { stagger: number; baseDelay: number }) => ({
    transition: {
      staggerChildren: custom.stagger,
      delayChildren: custom.baseDelay,
    },
  }),
};

export function StaggerGroup({
  children,
  baseDelay = 0,
  stagger = 0.1,
  distance = 28,
  duration = 0.5,
  className,
  once = true,
  viewMargin = "-40px 0px",
}: StaggerGroupProps) {
  const shouldReduce = useReducedMotion();

  const childVariants = {
    hidden: shouldReduce ? { opacity: 1 } : { opacity: 0, y: distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: viewMargin }}
      custom={{ stagger, baseDelay }}
      className={className}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return (
          <motion.div variants={childVariants}>
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
