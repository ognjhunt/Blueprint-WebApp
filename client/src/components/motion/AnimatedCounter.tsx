/**
 * AnimatedCounter — counts up from 0 to a target number when scrolled into view.
 * GPU-friendly: only manipulates text content, no layout thrashing.
 */
import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

interface AnimatedCounterProps {
  /** Target value to count up to */
  value: number;
  /** Prefix to show before the number (e.g. "$") */
  prefix?: string;
  /** Suffix to show after the number (e.g. "%", "+") */
  suffix?: string;
  /** Duration of the count animation in ms */
  duration?: number;
  /** CSS class for the number */
  className?: string;
}

export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1200,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px 0px" });
  const shouldReduce = useReducedMotion();
  const [display, setDisplay] = useState(shouldReduce ? value : 0);

  useEffect(() => {
    if (!inView || shouldReduce) {
      if (shouldReduce) setDisplay(value);
      return;
    }

    let start: number | null = null;
    let raf: number;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));

      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, shouldReduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}
