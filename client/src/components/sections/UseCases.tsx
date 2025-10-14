import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

const useCases = [
  {
    title: "Restaurants",
    description: "Interactive menus, personalized recommendations, and seamless ordering experiences.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4",
  },
  {
    title: "Retail Stores",
    description: "Product visualization, interactive displays, and smart shopping assistance.",
    image: "https://images.unsplash.com/photo-1552871419-81ba9b1aa9c9",
  },
  {
    title: "Museums",
    description: "Immersive exhibits, interactive tours, and educational AI glasses companions.",
    image: "https://images.unsplash.com/photo-1581094651181-35942459ef62",
  },
];

export default function UseCases() {
  return (
    <section id="use-cases" className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-4">
            Blueprint in Action
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how businesses across industries are leveraging Blueprint to create extraordinary customer experiences.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48">
                  <img
                    src={useCase.image}
                    alt={useCase.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{useCase.title}</h3>
                  <p className="text-gray-600">{useCase.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
