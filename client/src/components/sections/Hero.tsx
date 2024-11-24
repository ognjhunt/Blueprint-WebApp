import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "wouter";
import ARDemoViewer from "@/components/ARDemoViewer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Hero() {
  return (
    <section className="min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white pt-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Transform Your Business with Next-Gen AR Technology
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Revolutionize customer experiences with AI-powered AR blueprints. Join the future of business interaction and unlock unprecedented growth potential.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/create-blueprint">
                <Button size="lg" className="text-lg px-8">
                  Create Blueprint
                </Button>
              </Link>
              <Link href="/claim-blueprint">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Claim Existing Blueprint
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Join 1,000+ businesses already using Blueprint AR
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
