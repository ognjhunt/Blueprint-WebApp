/**
 * Public-site motion primitives.
 *
 * Two invariants, because the public pages are prerendered to static HTML by
 * `scripts/prerender.tsx` and must be readable with no JavaScript at all:
 *
 * 1. **Never ship hidden content.** These helpers render their children plainly
 *    and fully visible on the server and on the first client paint. The enter
 *    animation is only armed after mount, and only for elements that are still
 *    outside the viewport at that moment — so above-the-fold content is never
 *    animated from `opacity: 0` (which would flash) and prerendered HTML never
 *    contains invisible text.
 * 2. **Reduced motion wins outright.** Under `prefers-reduced-motion: reduce`
 *    nothing here animates; every helper stays in its static branch.
 *
 * Transforms and opacity only, so nothing here triggers layout.
 */
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type SVGMotionProps,
} from "framer-motion";

import { cn } from "@/lib/utils";

const EASE_OUT_BP = [0.16, 1, 0.3, 1] as const;

/**
 * useArmedReveal — decides whether an element may animate in.
 *
 * Returns a ref to attach to the static element, and `armed`. `armed` starts
 * false (server render, first paint, reduced motion, and anything already on
 * screen) and only flips true after mount for elements still below the fold.
 * Callers render plain markup while `armed` is false.
 */
function useArmedReveal<T extends Element>() {
  const ref = useRef<T | null>(null);
  const shouldReduce = useReducedMotion();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (shouldReduce || typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    // Only arm what the reader has not seen yet; anything on screen stays put.
    if (!alreadyVisible) setArmed(true);
  }, [shouldReduce]);

  return { ref, armed };
}

type RevealDirection = "up" | "left" | "right" | "none";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds of delay before the reveal starts. */
  delay?: number;
  /** Seconds the reveal takes. */
  duration?: number;
  /** Offset direction the element travels from. */
  from?: RevealDirection;
  /** Travel distance in px. */
  distance?: number;
  /** Render as a different element (default `div`). */
  as?: "div" | "li" | "section" | "article" | "span";
}

const offsetFor = (from: RevealDirection, distance: number) => {
  switch (from) {
    case "left":
      return { x: -distance, y: 0 };
    case "right":
      return { x: distance, y: 0 };
    case "none":
      return { x: 0, y: 0 };
    default:
      return { x: 0, y: distance };
  }
};

/**
 * Reveal — fades and slides a block in the first time it enters the viewport.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.7,
  from = "up",
  distance = 22,
  as = "div",
}: RevealProps) {
  const { ref, armed } = useArmedReveal<HTMLElement>();
  const offset = offsetFor(from, distance);

  // Static branch: server render, first paint, reduced motion, and anything
  // already on screen. Content is fully visible here.
  if (!armed) {
    const Tag = as;
    return (
      <Tag ref={ref as React.Ref<never>} className={className}>
        {children}
      </Tag>
    );
  }

  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      transition={{ duration, delay, ease: EASE_OUT_BP }}
    >
      {children}
    </MotionTag>
  );
}

export interface RevealStaggerProps {
  children: ReactNode;
  className?: string;
  /** Seconds between each child. */
  step?: number;
  /** Seconds before the first child. */
  delay?: number;
  from?: RevealDirection;
  distance?: number;
  /** Element for the wrapper and each child slot. */
  as?: "div" | "ol" | "ul";
  childAs?: "div" | "li" | "article";
}

/**
 * RevealStagger — wraps each direct child in a Reveal with an increasing delay,
 * so grids and lists arrive in reading order instead of all at once.
 */
export function RevealStagger({
  children,
  className,
  step = 0.07,
  delay = 0,
  from = "up",
  distance = 18,
  as: Wrapper = "div",
  childAs = "div",
}: RevealStaggerProps) {
  const items = Children.toArray(children).filter(isValidElement);

  return (
    <Wrapper className={className}>
      {items.map((child, index) => (
        <Reveal
          key={child.key ?? index}
          as={childAs}
          from={from}
          distance={distance}
          delay={delay + index * step}
        >
          {child}
        </Reveal>
      ))}
    </Wrapper>
  );
}

/**
 * ParallaxMedia — nudges large media against the scroll direction. The shift is
 * deliberately small (default 40px total) so the frame never detaches from its
 * caption. Under reduced motion the child renders in place.
 */
export function ParallaxMedia({
  children,
  className,
  shift = 40,
}: {
  children: ReactNode;
  className?: string;
  shift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [shift, -shift]);

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.div
        className="h-full w-full"
        style={shouldReduce ? undefined : ({ y } as MotionStyle)}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * ScrollProgressRail — a vertical hairline whose brass fill tracks how far the
 * reader has scrolled through the wrapped section. Used to bind long stepped
 * sections together. Renders a static full rail under reduced motion.
 */
export function ScrollProgressRail({
  children,
  className,
  railClassName,
}: {
  children: ReactNode;
  className?: string;
  railClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 60%"],
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        aria-hidden="true"
        className={cn("absolute bottom-0 top-0 w-px bg-line", railClassName)}
      >
        <motion.div
          className="h-full w-full origin-top bg-brass-deep"
          style={shouldReduce ? { transform: "scaleY(1)" } : ({ scaleY } as MotionStyle)}
        />
      </div>
      {children}
    </div>
  );
}

/**
 * DrawIn — animates an SVG path's `stroke-dashoffset` from hidden to drawn once
 * the path scrolls into view. The path renders fully drawn under reduced motion.
 *
 * Callers pass the same props they would give `<path>`; `pathLength={1}`
 * normalises the dash math so no measurement pass is needed.
 */
export function DrawIn({
  d,
  className,
  delay = 0,
  duration = 1.4,
  ...pathProps
}: {
  d: string;
  className?: string;
  delay?: number;
  duration?: number;
} & Omit<SVGMotionProps<SVGPathElement>, "d" | "className" | "ref">) {
  const { ref, armed } = useArmedReveal<SVGPathElement>();
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  // Static branch renders the path fully drawn, so prerendered SVG is never blank.
  if (!armed) {
    return <path ref={ref} d={d} className={className} {...(pathProps as object)} />;
  }

  return (
    <motion.path
      d={d}
      className={className}
      pathLength={1}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: inView ? 1 : 0, opacity: inView ? 1 : 0 }}
      transition={{
        pathLength: { duration, delay, ease: EASE_OUT_BP },
        opacity: { duration: 0.2, delay },
      }}
      {...pathProps}
    />
  );
}

/**
 * GrowIn — scales a mark from its baseline when scrolled into view. `origin`
 * picks which edge stays pinned, so bars grow out of their axis rather than
 * out of their own centre.
 */
export function GrowIn({
  children,
  className,
  delay = 0,
  duration = 0.75,
  origin = "left",
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  origin?: "left" | "bottom";
  style?: CSSProperties;
}) {
  const { ref, armed } = useArmedReveal<HTMLDivElement>();
  const axis = origin === "left" ? "scaleX" : "scaleY";

  // Static branch renders the mark at full size, so a prerendered bar is not
  // collapsed to zero width.
  if (!armed) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={{ ...style, transformOrigin: origin === "left" ? "left center" : "bottom center" }}
      initial={{ [axis]: 0, opacity: 0.35 }}
      whileInView={{ [axis]: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration, delay, ease: EASE_OUT_BP }}
    >
      {children}
    </motion.div>
  );
}

/**
 * useHasMounted — guards client-only motion so prerendered HTML and the first
 * client paint agree. The prerender pass ships the resolved layout.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
