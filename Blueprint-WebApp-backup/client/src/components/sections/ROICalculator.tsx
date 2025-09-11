import { useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";

export default function ROICalculator() {
  const [monthlyVisitors, setMonthlyVisitors] = useState(5000);
  const [avgOrderValue, setAvgOrderValue] = useState(50);
  const [conversionIncrease, setConversionIncrease] = useState(20);

  const calculateROI = () => {
    const currentRevenue = monthlyVisitors * avgOrderValue * 0.1; // Assuming 10% base conversion
    const newRevenue = monthlyVisitors * avgOrderValue * (0.1 + conversionIncrease / 100);
    const increase = newRevenue - currentRevenue;
    return Math.round(increase);
  };

  return (
    <section id="roi" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-4">
            Calculate Your ROI
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how Blueprint can impact your bottom line with our interactive calculator.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div>
              <label className="block text-sm font-medium mb-2">
                Monthly Visitors: {monthlyVisitors.toLocaleString()}
              </label>
              <Slider
                value={[monthlyVisitors]}
                onValueChange={(value) => setMonthlyVisitors(value[0])}
                max={50000}
                step={1000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Average Order Value: ${avgOrderValue}
              </label>
              <Slider
                value={[avgOrderValue]}
                onValueChange={(value) => setAvgOrderValue(value[0])}
                max={200}
                step={5}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Expected Conversion Rate Increase: {conversionIncrease}%
              </label>
              <Slider
                value={[conversionIncrease]}
                onValueChange={(value) => setConversionIncrease(value[0])}
                max={50}
                step={5}
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Card>
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-4">Projected Monthly Impact</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-600">Additional Monthly Revenue</p>
                    <p className="text-4xl font-bold text-primary">
                      ${calculateROI().toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500">
                    *Calculations are estimates based on industry averages and actual results may vary.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
