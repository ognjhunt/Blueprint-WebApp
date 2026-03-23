/**
 * PipelineDiagram — animated step-by-step pipeline with connecting lines.
 * Each step reveals sequentially as it scrolls into view.
 * Connecting lines draw themselves between steps using clip-path.
 */
import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";

interface PipelineStep {
  step: string;
  title: string;
  description: string;
  icon: ReactNode;
}

interface PipelineDiagramProps {
  steps: PipelineStep[];
  className?: string;
}

export function PipelineDiagram({ steps, className }: PipelineDiagramProps) {
  const shouldReduce = useReducedMotion();

  return (
    <div className={className}>
      {/* Desktop: horizontal connected pipeline */}
      <div className="hidden md:block" aria-hidden="true">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px 0px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.2 } },
          }}
          className="relative"
        >
          {/* Connecting line */}
          <motion.div
            variants={{
              hidden: { scaleX: 0 },
              visible: {
                scaleX: 1,
                transition: { duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 },
              },
            }}
            style={{ transformOrigin: "left", "--steps": steps.length } as React.CSSProperties}
            className="absolute left-[calc(100%/var(--steps)*0.5)] right-[calc(100%/var(--steps)*0.5)] top-[2.25rem] h-[2px] bg-gradient-to-r from-indigo-400 via-emerald-400 to-indigo-400"
          />

          <div
            className="relative grid gap-4"
            style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                variants={{
                  hidden: shouldReduce
                    ? { opacity: 1 }
                    : { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
                  },
                }}
                className="group relative flex flex-col items-center text-center"
              >
                {/* Step circle */}
                <motion.div
                  variants={{
                    hidden: shouldReduce ? { scale: 1 } : { scale: 0.5 },
                    visible: {
                      scale: 1,
                      transition: { duration: 0.4, ease: "backOut" },
                    },
                  }}
                  className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border-2 border-indigo-200 bg-white shadow-md transition-colors group-hover:border-indigo-400 group-hover:shadow-lg"
                >
                  <div className="text-indigo-600">{step.icon}</div>
                </motion.div>

                {/* Step number */}
                <span className="mt-3 font-mono text-xs font-bold text-indigo-500">
                  {step.step}
                </span>

                <h3 className="mt-1 text-base font-bold text-zinc-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Mobile: vertical timeline */}
      <div className="md:hidden">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px 0px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
          className="relative space-y-6 pl-10"
        >
          {/* Vertical connecting line */}
          <motion.div
            variants={{
              hidden: { scaleY: 0 },
              visible: {
                scaleY: 1,
                transition: { duration: 1, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 },
              },
            }}
            style={{ transformOrigin: "top" }}
            className="absolute bottom-0 left-[1.15rem] top-0 w-[2px] bg-gradient-to-b from-indigo-400 via-emerald-400 to-indigo-400"
          />

          {steps.map((step) => (
            <motion.div
              key={step.step}
              variants={{
                hidden: shouldReduce
                  ? { opacity: 1 }
                  : { opacity: 0, x: -16 },
                visible: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
                },
              }}
              className="relative"
            >
              {/* Dot */}
              <div className="absolute -left-10 top-1 flex h-9 w-9 items-center justify-center rounded-xl border-2 border-indigo-200 bg-white shadow-sm">
                <div className="text-indigo-600">{step.icon}</div>
              </div>

              <span className="font-mono text-xs font-bold text-indigo-500">{step.step}</span>
              <h3 className="mt-0.5 text-base font-bold text-zinc-900">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
