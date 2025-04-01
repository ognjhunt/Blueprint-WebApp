import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WorkspaceNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  setWorkspaceName: (name: string) => void;
  onContinue: () => void; // Will trigger the checkout process
  isProcessing: boolean;
}

export function WorkspaceNameModal({
  isOpen,
  onClose,
  workspaceName,
  setWorkspaceName,
  onContinue,
  isProcessing,
}: WorkspaceNameModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Create workspace
          </DialogTitle>
          <DialogDescription>
            Set a workspace name for your team. The name can be changed at any
            time.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Acme Corp Marketing"
              disabled={isProcessing}
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessing}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={onContinue}
            disabled={!workspaceName.trim() || isProcessing} // Disable if name is empty or processing
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  {" "}
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>{" "}
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>{" "}
                </svg>
                Processing...
              </>
            ) : (
              "Select billing options"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
