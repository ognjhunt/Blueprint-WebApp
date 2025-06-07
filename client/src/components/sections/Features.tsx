import { motion } from "framer-motion";
import {
  CubeTransparentIcon,
  BoltIcon,
  ChartBarIcon,
  UserGroupIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

export default function Features() {
  const features = [
    {
      icon: CubeTransparentIcon,
      title: "AR Visualization",
      description:
        "Create immersive experiences that overlay digital information on the physical world in real-time.",
      color: "from-blue-400 to-indigo-500",
    },
    {
      icon: BoltIcon,
      title: "No App Required",
      description:
        "Your customers access AR experiences directly through their browser – no app download needed.",
      color: "from-emerald-400 to-teal-500",
    },
    {
      icon: ChartBarIcon,
      title: "Analytics Dashboard",
      description:
        "Track engagement, conversions, and customer behavior with detailed analytics.",
      color: "from-purple-400 to-indigo-500",
    },
    {
      icon: UserGroupIcon,
      title: "Customer Insights",
      description:
        "Gain valuable data on how customers interact with your physical space and AR elements.",
      color: "from-pink-400 to-rose-500",
    },
    {
      icon: DevicePhoneMobileIcon,
      title: "Multi-Platform",
      description:
        "Works seamlessly across iOS and Android devices without compatibility issues.",
      color: "from-amber-400 to-orange-500",
    },
    {
      icon: ShieldCheckIcon,
      title: "AI Integration",
      description:
        "Integrate your own existing AI solutions into your Blueprint's experience.",
      color: "from-sky-400 to-blue-500",
    },
  ];

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 50,
      },
    },
  };

  return (
    <section className="py-24 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-white to-indigo-50/50 -z-10" />
      <motion.div
        className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-30 -z-10"
      />

      <div className="container mx-auto px-4">
        <motion.div
          className="text-center max-w-3xl mx-auto mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-violet-600 inline-block text-transparent bg-clip-text">
            Powerful Features to Elevate Your Space
          </h2>
          <p className="text-xl text-gray-600">
            Blueprint combines cutting-edge technology with intuitive design to
            help you create extraordinary customer experiences.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl hover:border-indigo-100 transition-all duration-300"
              variants={item}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
            >
              <div
                className={`w-14 h-14 rounded-xl mb-6 flex items-center justify-center bg-gradient-to-br ${feature.color}`}
              >
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-800">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
