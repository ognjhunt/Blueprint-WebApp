"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CodeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
}

export function CodeEntryModal({
  isOpen,
  onClose,
  onSubmit,
}: CodeEntryModalProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(code);
    setCode("");
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Verification Code</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              placeholder="Enter 6-character code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              required
              className="text-center text-2xl tracking-widest"
            />
            <p className="text-sm text-gray-500">
              Enter the 6-character alphanumeric verification code sent to your
              business contact.
            </p>
          </div>
          <Button type="submit" className="w-full">
            Verify Code
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
