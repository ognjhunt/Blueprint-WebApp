import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

const caseStudies = [
  {
    company: "Fine Dining Co.",
    result: "Representative review path",
    quote: "The useful buyer question is whether one approved route has capture proof, rights context, and a hosted review path before any smart-glasses demo is discussed.",
    image: "https://images.unsplash.com/photo-1493857671505-72967e2e2760",
    avatar: "https://i.pravatar.cc/150?u=1",
    name: "Sarah Chen",
    role: "Digital Innovation Director",
  },
  {
    company: "Tech Retail",
    result: "Representative capture path",
    quote: "Phone capture stays first. Google/Meta smart glasses belong on approved repeat walkthroughs only when the assignment and downstream package proof are ready.",
    image: "https://images.unsplash.com/photo-1520333789090-1afc82db536a",
    avatar: "https://i.pravatar.cc/150?u=2",
    name: "Michael Roberts",
    role: "Chief Technology Officer",
  },
];

export default function CaseStudies() {
  return (
    <section id="case-studies" className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-4">
            Representative Proof Paths
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how Blueprint frames site review without inventing customer outcomes or hardware readiness.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {caseStudies.map((study, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
            >
              <Card className="overflow-hidden">
                <div className="relative h-48">
                  <img
                    src={study.image}
                    alt={study.company}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-xl font-semibold">{study.company}</h3>
                    <p className="text-emerald-400 font-semibold">{study.result}</p>
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-gray-600 mb-6 italic">"{study.quote}"</p>
                  <div className="flex items-center">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={study.avatar} alt={study.name} />
                    </Avatar>
                    <div className="ml-4">
                      <p className="font-semibold">{study.name}</p>
                      <p className="text-sm text-gray-600">{study.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
