import { useEffect, useRef } from 'react';
import { ThreeScene } from '@/lib/three-scene';
import { motion } from 'framer-motion';

export default function ARDemoViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeScene | null>(null);

  useEffect(() => {
    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new ThreeScene(containerRef.current);
      sceneRef.current.addMouseInteraction(containerRef.current);
    }

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-xl"
      ref={containerRef}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-4 left-4 text-white">
        <p className="text-sm font-medium">Interactive AR Demo</p>
        <p className="text-xs opacity-75">Move your mouse to explore</p>
      </div>
    </motion.div>
  );
}
