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
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade to Plus">
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Usage Summary</h3>
          <div className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span>Monthly Customers:</span>
              <span>{usageDetails.numberOfCustomers}</span>
            </p>
            <p className="flex justify-between">
              <span>Average Visit Time:</span>
              <span>{usageDetails.averageVisitTime} hours</span>
            </p>
            <p className="flex justify-between">
              <span>Total Hours:</span>
              <span>{usageDetails.totalHours} hours</span>
            </p>
            <p className="flex justify-between font-semibold">
              <span>Monthly Total:</span>
              <span>${usageDetails.monthlyTotal.toFixed(2)}</span>
            </p>
          </div>
        </div>

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
              Upgrade Now - ${usageDetails.monthlyTotal.toFixed(2)}/month
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
