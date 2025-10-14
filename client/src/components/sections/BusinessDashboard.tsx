import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Users, TrendingUp, Eye, Clock, ArrowUp } from "lucide-react";

export default function BusinessDashboard() {
  const metrics = [
    {
      label: "Daily Interactions",
      value: "2,847",
      change: "+24%",
      icon: Eye,
    },
    {
      label: "Avg. Session Duration",
      value: "4.2m",
      change: "+12%",
      icon: Clock,
    },
    {
      label: "Customer Engagement",
      value: "78%",
      change: "+15%",
      icon: Users,
    },
    {
      label: "Revenue Impact",
      value: "$12.4k",
      change: "+32%",
      icon: TrendingUp,
    },
  ];

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-4">
            Your Future Dashboard
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get a preview of how Blueprint will transform your business metrics
          </p>
        </motion.div>

        <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-semibold">Business Overview</h3>
              <p className="text-gray-500">Last 30 days</p>
            </div>
            <BarChart3 className="w-8 h-8 text-primary" />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <metric.icon className="w-6 h-6 text-primary" />
                      <span className="text-emerald-500 text-sm font-medium flex items-center">
                        <ArrowUp className="w-4 h-4 mr-1" />
                        {metric.change}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{metric.label}</p>
                    <p className="text-2xl font-bold">{metric.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Feature Preview */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h4 className="text-lg font-semibold mb-4">Popular AI Glasses Moments</h4>
                <div className="space-y-4">
                  {[
                    { name: "Guided Onboarding Prompts", usage: "85%" },
                    { name: "Hands-Free Navigation", usage: "72%" },
                    { name: "Instant Answer Overlays", usage: "68%" },
                  ].map((feature) => (
                    <div key={feature.name} className="flex items-center justify-between">
                      <span className="text-gray-600">{feature.name}</span>
                      <span className="font-medium">{feature.usage}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h4 className="text-lg font-semibold mb-4">Customer Satisfaction</h4>
                <div className="space-y-4">
                  {[
                    { rating: "5 stars", percentage: "64%" },
                    { rating: "4 stars", percentage: "28%" },
                    { rating: "3 stars", percentage: "8%" },
                  ].map((rating) => (
                    <div key={rating.rating} className="flex items-center justify-between">
                      <span className="text-gray-600">{rating.rating}</span>
                      <span className="font-medium">{rating.percentage}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
