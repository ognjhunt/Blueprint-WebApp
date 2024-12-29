import { motion } from "framer-motion";
import {
  BarChart3Icon,
  ShoppingBagIcon,
  UsersIcon,
  TrendingUpIcon,
} from "lucide-react";

const benefits = [
  {
    title: "AI Insights",
    description:
      "Leverage real-time analytics to unlock customer trends and optimize engagement.",
    icon: BarChart3Icon,
  },
  {
    title: "Immersive AR",
    description:
      "Transform ordinary spaces into extraordinary experiences with interactive AR.",
    icon: UsersIcon,
  },
  {
    title: "Effortless Integration",
    description:
      "Implement Blueprint seamlessly—no custom development required.",
    icon: TrendingUpIcon,
  },
];

export default function Benefits() {
  return (
    <section id="benefits" className="py-24 relative overflow-hidden bg-white">
      {/* Decorative shape at top */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />

      <motion.div
        className="container mx-auto px-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: { opacity: 0, y: 50 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.8 },
          },
        }}
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Unlock the Power of AR + AI
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Blueprint helps you create exceptional customer experiences with
            advanced AR technology.
          </p>
        </div>

        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              className="group bg-gray-50 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow relative"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icon */}
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 text-blue-600 mb-4">
                <benefit.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
