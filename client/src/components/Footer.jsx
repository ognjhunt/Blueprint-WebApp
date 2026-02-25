// ==================================
// File: src/components/Footer.jsx
// ==================================

import React from "react";
import { motion } from "framer-motion";

export default function Footer() {
  const year = new Date().getFullYear();
  const variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  };
  const item = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <footer className="relative bg-slate-950 text-slate-300 pt-14 pb-10 overflow-hidden border-t border-slate-800">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-emerald-500/60 via-cyan-400/60 to-emerald-500/60" />
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <motion.div
        className="container mx-auto px-6"
        variants={variants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <motion.div variants={item} className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/gradientBPLogo.png"
                alt="Blueprint Logo"
                className="w-10 h-10 rounded-xl"
              />
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                Blueprint
              </h3>
            </div>
            <p className="text-slate-400 max-w-xl">
              Simulation data that complements your real-world capture. Physics-accurate
              environments with domain randomization and sim2real validation, designed to
              boost your models by up to 38%.
            </p>
            <div className="flex items-center gap-4 mt-5 text-slate-400">
              <a
                href="#"
                aria-label="Twitter"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.23 4.23 0 001.85-2.33 8.38 8.38 0 01-2.67 1.03 4.19 4.19 0 00-7.13 3.82A11.9 11.9 0 013 4.79a4.18 4.18 0 001.3 5.59 4.17 4.17 0 01-1.9-.52v.05a4.19 4.19 0 003.36 4.11c-.46.13-.94.2-1.43.2-.35 0-.69-.03-1.02-.1a4.2 4.2 0 003.91 2.9A8.4 8.4 0 012 19.54a11.86 11.86 0 006.44 1.89c7.73 0 11.95-6.41 11.95-11.96 0-.18 0-.35-.01-.53A8.48 8.48 0 0024 5.56a8.3 8.3 0 01-2.4.66z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM0 8h5v15H0zM8 8h4.7v2.2h.1c.7-1.2 2.3-2.5 4.8-2.5 5.1 0 6 3.4 6 7.8V23H18v-6.3c0-1.5 0-3.4-2.1-3.4-2.1 0-2.4 1.6-2.4 3.3V23H8z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="GitHub"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.86 9.71.5.09.68-.22.68-.48 0-.24-.01-.87-.02-1.7-2.79.62-3.39-1.35-3.39-1.35-.45-1.16-1.12-1.47-1.12-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.26-4.56-1.12-4.56-4.98 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03.81-.23 1.68-.35 2.55-.35.87 0 1.73.12 2.54.35 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.3.68.92.68 1.86 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.04 10.04 0 0022 12.26C22 6.58 17.52 2 12 2z"
                  />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2.2c3.2 0 3.58.01 4.84.07 1.17.05 1.95.24 2.56.5.62.24 1.15.57 1.67 1.09.52.52.85 1.05 1.1 1.67.26.6.45 1.39.5 2.55.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.84c-.05 1.17-.24 1.95-.5 2.56-.24.62-.57 1.15-1.09 1.67-.52.52-1.05.85-1.67 1.1-.6.26-1.39.45-2.55.5-1.27.06-1.65.07-4.85.07s-3.58-.01-4.84-.07c-1.17-.05-1.95-.24-2.56-.5a4.8 4.8 0 01-1.67-1.09 4.8 4.8 0 01-1.1-1.67c-.26-.6-.45-1.39-.5-2.55C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.84c.05-1.17.24-1.95.5-2.56.24-.62.57-1.15 1.09-1.67.52-.52 1.05-.85 1.67-1.1.6-.26 1.39-.45 2.55-.5C8.42 2.21 8.8 2.2 12 2.2zm0 3.1c-3.14 0-3.51.01-4.75.07-.98.05-1.51.21-1.87.34-.47.18-.78.4-1.12.74-.34.34-.55.65-.74 1.12-.13.36-.29.9-.34 1.88-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05.98.21 1.51.34 1.87.18.47.4.78.74 1.12.34.34.65.55 1.12.74.36.13.9.29 1.88.34 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c.98-.05 1.51-.21 1.87-.34.47-.18.78-.4 1.12-.74.34-.34.55-.65.74-1.12.13-.36.29-.9.34-1.88.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-.98-.21-1.51-.34-1.87-.18-.47-.4-.78-.74-1.12a2.7 2.7 0 00-1.12-.74c-.36-.13-.9-.29-1.88-.34-1.24-.06-1.61-.07-4.75-.07zm0 3.76a4.94 4.94 0 110 9.88 4.94 4.94 0 010-9.88zm0 2.2a2.74 2.74 0 100 5.48 2.74 2.74 0 000-5.48zm5.42-3.23a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3z"
                  />
                </svg>
              </a>
            </div>
          </motion.div>

          {/* Resources */}
          <motion.div variants={item}>
            <h4 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">
              Resources
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="/why-simulation"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Why Simulation?
                </a>
              </li>
              <li>
                <a
                  href="/learn"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Getting Started
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Terms of Service
                </a>
              </li>
            </ul>
          </motion.div>
        </div>

        <motion.div
          variants={item}
          className="pt-6 mt-2 border-t border-slate-800 text-center md:flex md:items-center md:justify-between"
        >
          <p className="text-sm text-slate-500">
            © {year} Blueprint. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex justify-center md:justify-end gap-6">
            <a
              href="/privacy"
              className="text-sm text-slate-500 hover:text-slate-300 transition"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-sm text-slate-500 hover:text-slate-300 transition"
            >
              Terms of Service
            </a>
          </div>
        </motion.div>
      </motion.div>
    </footer>
  );
}

