'use client'

import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/Modal"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  usageDetails: {
    numberOfCustomers: number
    averageVisitTime: number
    totalHours: number
    monthlyTotal: number
  }
}

export function UpgradeModal({ isOpen, onClose, usageDetails }: UpgradeModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle payment submission
    console.log("Processing payment...")
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enter Payment Information">
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-name">Cardholder Name</Label>
            <Input id="card-name" placeholder="John Smith" required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="card-number">Card Number</Label>
            <Input id="card-number" placeholder="4242 4242 4242 4242" required />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input id="expiry" placeholder="MM/YY" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvc">CVC</Label>
              <Input id="cvc" placeholder="123" required />
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button type="submit" className="w-full">
              Save Billing Information
            </Button>
          </motion.div>
        </form>

        <p className="text-xs text-gray-500 text-center">
          Your card will be charged monthly based on actual usage.
          Cancel anytime.
        </p>
      </div>
    </Modal>
  )
}
