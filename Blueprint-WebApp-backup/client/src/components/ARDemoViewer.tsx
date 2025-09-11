import { useEffect, useRef, useState } from 'react';
import { ThreeScene } from '@/lib/three-scene';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function ARDemoViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initScene = async () => {
      try {
        if (!containerRef.current) {
          throw new Error("Container element not found");
        }

        setIsLoading(true);
        setError(null);
        
        console.log("Initializing AR Demo Viewer...");
        const scene = new ThreeScene(containerRef.current);
        scene.addMouseInteraction(containerRef.current);
        sceneRef.current = scene;
        
        setIsLoading(false);
        console.log("AR Demo Viewer initialized successfully");
      } catch (err) {
        console.error("Failed to initialize AR Demo Viewer:", err);
        setError(err instanceof Error ? err.message : "Failed to load AR demo");
        setIsLoading(false);
      }
    };

    initScene();

    const handleResize = () => {
      if (containerRef.current && sceneRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        console.log("Resizing AR Demo Viewer to:", width, "x", height);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        console.log("Disposing AR Demo Viewer...");
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div className="relative w-full h-[400px] rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-red-500 font-medium mb-2">Failed to load AR demo</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative w-full h-[400px] lg:h-[500px] rounded-lg overflow-hidden shadow-xl"
      ref={containerRef}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-sm font-medium">Loading AR demo...</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-4 left-4 text-white">
        <p className="text-sm font-medium">Interactive AR Demo</p>
        <p className="text-xs opacity-75">Move your mouse to explore</p>
      </div>
    </motion.div>
  );
}
