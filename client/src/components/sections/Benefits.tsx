import { motion } from "framer-motion";
import { BarChart3Icon, ShoppingBagIcon, UsersIcon, TrendingUpIcon } from "lucide-react";

const benefits = [
  {
    icon: BarChart3Icon,
    title: "AI-Powered Analytics",
    description: "Harness advanced machine learning algorithms to derive actionable insights from customer interactions in real-time.",
  },
  {
    icon: ShoppingBagIcon,
    title: "Smart Revenue Growth",
    description: "Leverage predictive analytics and AR-driven recommendations to maximize sales opportunities.",
  },
  {
    icon: UsersIcon,
    title: "Immersive Experiences",
    description: "Pioneer next-generation customer engagement with interactive AR environments and personalized journeys.",
  },
  {
    icon: TrendingUpIcon,
    title: "Digital Transformation",
    description: "Lead your industry's evolution with cutting-edge AR technology and data-driven optimization.",
  },
];

export default function Benefits() {
  return (
    <section id="benefits" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-4">
            Technological Evolution Starts Here
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Embrace the future with Blueprint's revolutionary AR technology platform. Be at the forefront of digital transformation.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="scroll-section bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <benefit.icon className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
