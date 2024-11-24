import { motion } from "framer-motion";
import { BarChart3Icon, ShoppingBagIcon, UsersIcon, TrendingUpIcon } from "lucide-react";

const benefits = [
  {
    icon: BarChart3Icon,
    title: "Data-Driven Insights",
    description: "Gain valuable customer behavior analytics and optimize your operations with real-time data.",
  },
  {
    icon: ShoppingBagIcon,
    title: "Increased Revenue",
    description: "Boost sales through personalized recommendations and targeted promotions.",
  },
  {
    icon: UsersIcon,
    title: "Enhanced Engagement",
    description: "Create memorable experiences that keep customers coming back for more.",
  },
  {
    icon: TrendingUpIcon,
    title: "Operational Efficiency",
    description: "Streamline processes and reduce costs with AR-powered assistance.",
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
            Transform Your Business with AR
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Unlock new possibilities and drive growth with Blueprint's cutting-edge AR technology.
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
