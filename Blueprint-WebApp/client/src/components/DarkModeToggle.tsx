// components/DarkModeToggle.tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <motion.button
      className="fixed bottom-4 right-4 z-50 p-3 rounded-full 
                 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 
                 shadow-md hover:shadow-lg transition-shadow"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => setIsDark(!isDark)}
    >
      {isDark ? "☀️" : "🌙"}
    </motion.button>
  );
}
