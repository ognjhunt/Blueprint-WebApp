import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Footer() {
  return (
    <footer className="bg-neutral-900 text-white py-12 mt-24">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand/Company */}
        <div className="md:col-span-1">
          <h3 className="text-2xl font-bold mb-2">Blueprint</h3>
          <p className="text-gray-400 leading-relaxed text-sm">
            Transforming spaces with cutting-edge AR technology for enhanced
            customer experiences.
          </p>
          <div className="flex items-center gap-3 mt-4 text-gray-400">
            <a href="#" aria-label="Facebook" className="hover:text-white">
              <i className="fab fa-facebook-f" />
            </a>
            <a href="#" aria-label="Twitter" className="hover:text-white">
              <i className="fab fa-twitter" />
            </a>
            <a href="#" aria-label="LinkedIn" className="hover:text-white">
              <i className="fab fa-linkedin-in" />
            </a>
            <a href="#" aria-label="Instagram" className="hover:text-white">
              <i className="fab fa-instagram" />
            </a>
          </div>
        </div>

        {/* Resources */}
        <div>
          <h4 className="text-lg font-semibold mb-3">Resources</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>
              <a href="#" className="hover:text-white">
                Support Center
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Pricing
              </a>
            </li>
          </ul>
        </div>

        {/* Another Column Example */}
        <div>
          <h4 className="text-lg font-semibold mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>
              <a href="#" className="hover:text-white">
                About Us
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Blog
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white">
                Careers
              </a>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="text-lg font-semibold mb-3">Stay Updated</h4>
          <p className="text-sm text-gray-400 mb-4">
            Subscribe to our newsletter for the latest updates and insights.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter your email"
              className="text-black"
            />
            <Button
              className="hover:scale-105 transition-transform"
              variant="default"
            >
              Subscribe
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="container mx-auto px-4 mt-8 border-t border-gray-700 pt-4">
        <p className="text-xs text-gray-500 text-center">
          © 2024 Blueprint. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
