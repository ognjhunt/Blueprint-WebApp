"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, MoonStar } from "lucide-react";

export default function ThemeToggleFab() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = (theme ?? resolvedTheme) === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed bottom-4 right-4 z-[9999] rounded-full shadow-lg
                 backdrop-blur border transition
                 bg-white/90 text-slate-900 hover:bg-white
                 dark:bg-white/10 dark:text-slate-100 dark:border-white/20
                 dark:hover:bg-white/15
                 w-12 h-12 flex items-center justify-center"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <MoonStar className="w-5 h-5" />}
    </button>
  );
}
