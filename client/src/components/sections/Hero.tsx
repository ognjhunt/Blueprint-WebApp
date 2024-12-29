import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

export default function Hero() {
  // Your headlines (each with a \n so “Blueprint” sits on its own line)
  const headlines = [
    { text: "Reimagine your business with\nBlueprint" },
    { text: "Reimagine your customer experience with\nBlueprint" },
    { text: "Reimagine your brand presence with\nBlueprint" },
    { text: "Reimagine your environment with\nBlueprint" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  // Cycle through headlines every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % headlines.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [headlines.length]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated background shapes */}
      <motion.div
        className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] bg-cover bg-center opacity-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2 }}
      />

      {/* Hero content */}
      <div className="container mx-auto px-4 text-center relative z-10">
        <AnimatePresence mode="wait">
          <motion.h1
            key={currentIndex} // Important: helps AnimatePresence track the current text
            className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight text-gray-800 whitespace-pre-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
          >
            {headlines[currentIndex].text}
          </motion.h1>
        </AnimatePresence>

        <motion.p
          className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          The all-in-one platform for creating immersive, AR-driven customer
          experiences. Transform any environment—no custom app required.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <Link href="/create-blueprint">
            <Button
              size="lg"
              className="text-lg px-8 tracking-wide shadow-lg hover:scale-105 transition-transform"
            >
              Create Blueprint
            </Button>
          </Link>
          <Link href="/discover">
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 tracking-wide shadow hover:scale-105 transition-transform"
            >
              Discover How It Works
            </Button>
          </Link>
        </motion.div>

        <motion.p
          className="mt-6 text-sm text-gray-500"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Join <span className="font-semibold">1,000+</span> businesses already
          using Blueprint
        </motion.p>
      </div>
    </section>
  );
}

//   return (
//     <section className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white pt-16">
//       <div className="container mx-auto px-4">
//         <div className="max-w-3xl mx-auto text-center">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.5 }}
//           >
//             <motion.h1
//               className="text-4xl md:text-5xl font-bold mb-6"
//               key={`title-${currentIndex}`}
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               transition={{ duration: 0.5 }}
//             >
//               {headlines[currentIndex].title}
//             </motion.h1>
//             <AnimatePresence mode="wait">
//               <motion.p
//                 key={`subtitle-${currentIndex}`}
//                 initial={{ opacity: 0, y: 10 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 exit={{ opacity: 0, y: -10 }}
//                 transition={{ duration: 0.5 }}
//                 className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
//               >
//                 {headlines[currentIndex].subtitle}
//               </motion.p>
//             </AnimatePresence>
//             <div className="flex flex-col sm:flex-row gap-4 justify-center">
//               <Link href="/create-blueprint">
//                 <Button size="lg" className="text-lg px-8">
//                   Create Blueprint
//                 </Button>
//               </Link>
//               <Link href="/claim-blueprint">
//                 <Button size="lg" variant="outline" className="text-lg px-8">
//                   Claim Existing Blueprint
//                 </Button>
//               </Link>
//             </div>
//             <p className="mt-6 text-sm text-gray-500">
//               Join 1,000+ businesses already using Blueprint
//             </p>
//           </motion.div>
//         </div>
//       </div>
//     </section>
//   );
// }
