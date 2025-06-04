import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog"; // Assuming Dialog is from shadcn
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";

interface TeamSeatSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  seats: number;
  setSeats: (seats: number) => void;
  onContinue: () => void;
  monthlyCost: number;
}

const MIN_SEATS = 2;
const MAX_SEATS = 100;

// Ensure this function name matches the export and the import
export function TeamSeatSelectorModal({
  isOpen,
  onClose,
  seats,
  setSeats,
  onContinue,
  monthlyCost,
}: TeamSeatSelectorModalProps) {
  const handleSeatChange = (newSeats: number) => {
    if (newSeats >= MIN_SEATS && newSeats <= MAX_SEATS) {
      setSeats(newSeats);
    }
  };

  const incrementSeats = () => handleSeatChange(seats + 1);
  const decrementSeats = () => handleSeatChange(seats - 1);

  // Handle direct input, ensuring it's within bounds
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value)) {
      setSeats(MIN_SEATS); // Or keep current seats, or show error
    } else {
      handleSeatChange(value);
    }
  };
  // Adjust value on blur if out of bounds
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < MIN_SEATS) {
      setSeats(MIN_SEATS);
    } else if (value > MAX_SEATS) {
      setSeats(MAX_SEATS);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] grid-cols-1 md:grid-cols-2 gap-8 p-8">
        {/* Left Side: Seat Selection */}
        <div>
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-semibold">
              Select your Team plan
            </DialogTitle>
            {/* Optional: Add description if needed */}
            {/* <DialogDescription>Choose the number of seats for your workspace.</DialogDescription> */}
          </DialogHeader>

          <div className="space-y-4 mb-6">
            {/* Billing Cycle Options - Simplified to Monthly Only for now */}
            <div className="border rounded-md p-4 border-indigo-500 bg-indigo-50/50">
              <Label
                htmlFor="monthly-plan"
                className="flex items-center cursor-pointer"
              >
                <input
                  type="radio"
                  id="monthly-plan"
                  name="billing-cycle"
                  value="monthly"
                  checked
                  readOnly
                  className="mr-2 accent-indigo-600"
                />
                <div>
                  <span className="font-medium text-gray-800">Monthly</span>
                  <p className="text-sm text-gray-600">
                    USD $10 per user/month
                  </p>
                  <ul className="mt-2 text-xs text-gray-500 list-disc list-inside space-y-1">
                    <li>Billed monthly</li>
                    <li>Minimum {MIN_SEATS} users</li>
                    <li>Add or remove users as needed</li>
                  </ul>
                </div>
              </Label>
            </div>
            {/* Add Annual option here if needed later */}
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-seats" className="text-base font-medium">
              Users
            </Label>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementSeats}
                disabled={seats <= MIN_SEATS}
                aria-label="Decrease seats"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="team-seats"
                type="number"
                value={seats}
                onChange={handleInputChange}
                onBlur={handleInputBlur} // Validate on blur
                min={MIN_SEATS}
                max={MAX_SEATS}
                className="w-20 text-center"
                aria-label="Number of seats"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={incrementSeats}
                disabled={seats >= MAX_SEATS}
                aria-label="Increase seats"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Minimum {MIN_SEATS}, Maximum {MAX_SEATS} users.
            </p>
          </div>
        </div>

        {/* Right Side: Summary */}
        <div className="bg-slate-50 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-4">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Blueprint Team ({seats} users)</span>
                <span>${monthlyCost}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Discount</span>
                <span>$0</span>
              </div>
              <hr className="my-3" />
              <div className="flex justify-between font-semibold text-base">
                <span>Today's total</span>
                <span>USD ${monthlyCost}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Billed monthly starting Today
              </p>
            </div>
          </div>

          <Button
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700"
            onClick={onContinue}
          >
            Continue to billing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
