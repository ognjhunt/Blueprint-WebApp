/**
 * HeroPipelineGraphic — animated SVG-based hero graphic showing the
 * Capture → Qualify → World Model pipeline. Replaces the static hero SVG.
 * Uses pure CSS + framer-motion for drawing effects.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Camera, ShieldCheck, Globe } from "lucide-react";

export function HeroPipelineGraphic() {
  const shouldReduce = useReducedMotion();

  const stages = [
    { icon: Camera, label: "Capture", sublabel: "Walk & scan", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
    { icon: ShieldCheck, label: "Qualify", sublabel: "Auto-verify", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    { icon: Globe, label: "World Model", sublabel: "Robot-ready", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  ];

  return (
    <motion.div
      initial={shouldReduce ? {} : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative"
    >
      {/* Glow behind */}
      <div className="absolute -inset-4 rounded-3xl bg-indigo-500/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
        {/* Title */}
        <motion.p
          initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400"
        >
          How It Works
        </motion.p>

        {/* Pipeline steps */}
        <div className="flex items-center gap-3">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.label}
              initial={shouldReduce ? {} : { opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.5 + i * 0.15,
                duration: 0.5,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="flex flex-1 flex-col items-center"
            >
              {/* Icon circle */}
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 ${stage.border} ${stage.bg} shadow-sm`}>
                <stage.icon className={`h-6 w-6 ${stage.color}`} />
              </div>
              <p className="mt-2 text-sm font-bold text-zinc-900">{stage.label}</p>
              <p className="text-xs text-zinc-500">{stage.sublabel}</p>

              {/* Arrow between steps */}
              {i < stages.length - 1 && (
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.7 + i * 0.15, duration: 0.4 }}
                  style={{ transformOrigin: "left" }}
                  className="absolute"
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Connecting arrows (overlay) */}
        <svg
          className="absolute left-0 right-0 top-[5.5rem] mx-auto h-4 w-[65%] overflow-visible"
          viewBox="0 0 200 16"
          preserveAspectRatio="none"
        >
          {/* First arrow */}
          <motion.path
            d="M 0 8 L 85 8"
            stroke="url(#arrow-grad-1)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            initial={shouldReduce ? {} : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.7, duration: 0.5, ease: "easeOut" }}
          />
          <motion.polygon
            points="83,4 91,8 83,12"
            fill="#818cf8"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.2 }}
          />
          {/* Second arrow */}
          <motion.path
            d="M 109 8 L 194 8"
            stroke="url(#arrow-grad-2)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            initial={shouldReduce ? {} : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.9, duration: 0.5, ease: "easeOut" }}
          />
          <motion.polygon
            points="192,4 200,8 192,12"
            fill="#8b5cf6"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3, duration: 0.2 }}
          />
          <defs>
            <linearGradient id="arrow-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="arrow-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Bottom stats bar */}
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.4 }}
          className="mt-6 flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
        >
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">15-30 min</p>
            <p className="text-xs text-zinc-500">capture session</p>
          </div>
          <div className="h-6 w-px bg-zinc-200" />
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">Auto-scored</p>
            <p className="text-xs text-zinc-500">quality gates</p>
          </div>
          <div className="h-6 w-px bg-zinc-200" />
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">Robot-ready</p>
            <p className="text-xs text-zinc-500">world models</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
