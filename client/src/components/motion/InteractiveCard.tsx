/**
 * InteractiveCard — card with GPU-friendly hover lift + subtle glow.
 * Uses transform + boxShadow only — no layout shifts.
 */
import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";

interface InteractiveCardProps {
  children: ReactNode;
  className?: string;
  /** Glow accent color (tailwind-style, e.g. "indigo" or "emerald") */
  accent?: "indigo" | "emerald" | "zinc" | "violet";
  /** Whether to show the hover glow border */
  glowOnHover?: boolean;
}

const accentMap = {
  indigo: {
    border: "hover:border-indigo-300",
    shadow: "0 8px 30px -8px rgba(99, 102, 241, 0.15)",
  },
  emerald: {
    border: "hover:border-emerald-300",
    shadow: "0 8px 30px -8px rgba(16, 185, 129, 0.15)",
  },
  zinc: {
    border: "hover:border-zinc-300",
    shadow: "0 8px 30px -8px rgba(63, 63, 70, 0.12)",
  },
  violet: {
    border: "hover:border-violet-300",
    shadow: "0 8px 30px -8px rgba(139, 92, 246, 0.15)",
  },
};

export function InteractiveCard({
  children,
  className = "",
  accent = "indigo",
  glowOnHover = true,
}: InteractiveCardProps) {
  const shouldReduce = useReducedMotion();
  const config = accentMap[accent];

  return (
    <motion.div
      whileHover={
        shouldReduce
          ? {}
          : {
              y: -4,
              boxShadow: glowOnHover ? config.shadow : "0 8px 24px -8px rgba(0,0,0,0.1)",
              transition: { duration: 0.25, ease: "easeOut" },
            }
      }
      whileTap={shouldReduce ? {} : { scale: 0.985, transition: { duration: 0.1 } }}
      className={`rounded-2xl border border-zinc-200 bg-white shadow-sm transition-colors ${glowOnHover ? config.border : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
