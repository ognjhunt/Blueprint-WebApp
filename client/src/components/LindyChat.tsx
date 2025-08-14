"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINDY_EMBED_ID = "9620fed7-bdfb-4329-ada0-b60963170c59";
const LINDY_IFRAME_URL = `https://chat.lindy.ai/embedded/lindyEmbed/${LINDY_EMBED_ID}`;

// If you really want to allow an override from env in Next.js builds,
// this guard avoids touching `process` at runtime in the browser.
const LINDY_EMBED_URL =
  (typeof process !== "undefined" &&
    (process as any)?.env?.NEXT_PUBLIC_LINDY_EMBED_URL) ||
  LINDY_IFRAME_URL;

export default function LindyChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 p-0 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-lg hover:from-emerald-400 hover:to-cyan-500 z-40"
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            // Responsive size; feels like a proper chat dock
            className="fixed bottom-6 right-6 w-[min(28rem,92vw)] h-[min(70vh,80vh)] bg-slate-900/95 text-slate-100 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Lindy Support Chat"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-cyan-600 text-white p-3 flex justify-between items-center">
              <div className="flex items-center">
                <MessageCircle className="w-5 h-5 mr-2" />
                <h3 className="font-semibold">Blueprint × Lindy</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white hover:text-white/80 transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lindy iFrame */}
            <div className="w-full h-[calc(100%-48px)] bg-slate-900">
              <iframe
                src={LINDY_EMBED_URL}
                title="Lindy Support Chat"
                className="w-full h-full"
                // allow microphone/camera if your embed uses them
                allow="clipboard-write; microphone; camera; autoplay"
                // keeping sandbox relaxed; tighten if your flow allows
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

