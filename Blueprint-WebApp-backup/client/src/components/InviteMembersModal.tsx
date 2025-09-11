import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea"; // Use Textarea for multi-line input
import { Info } from "lucide-react";

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export function InviteMembersModal({
  isOpen,
  onClose,
  workspaceName,
}: InviteMembersModalProps) {
  const [emails, setEmails] = useState<string>("");

  const handleInvite = () => {
    // TODO: Implement actual invitation logic here
    // - Parse emails string (split by comma, newline, etc.)
    // - Validate email formats
    // - Send invitation requests to your backend API
    console.log(
      "Inviting emails:",
      emails
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter((e) => e),
    );
    onClose(); // Close modal after attempting invites
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Invite members to {workspaceName}
          </DialogTitle>
          <DialogDescription>
            You have now created a team workspace. You can invite members to
            join the workspace. You can also do so at any time from the
            workspace settings page.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {/* Option 1: Email Input */}
          <div>
            <Label htmlFor="invite-emails" className="text-sm font-medium">
              Emails
            </Label>
            <Textarea
              id="invite-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="Type or paste emails, separated by commas or newlines..."
              rows={4}
              className="mt-1"
            />
          </div>

          {/* Option 2: CSV Upload (Optional UI Element) */}
          {/*
             <div className="text-sm">
                <span className="font-medium">Import from CSV</span>
                <Button variant="outline" size="sm" className="ml-2">Upload</Button>
                <p className="text-xs text-gray-500 mt-1">
                    File must include email and an optional role (member, admin, owner) on each line. <a href="#" className="text-indigo-600 hover:underline">Show Example</a>
                </p>
             </div>
             */}

          {/* Info Box */}
          <div className="flex items-start space-x-2 bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-md text-sm">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
            <span>
              Users that accept invites will be included as additional seats on
              your next invoice, unless they are removed before the billing
              cycle renews.
            </span>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
          {/* Skip button closes the modal */}
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!emails.trim()} // Disable if no emails entered
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Send Invites
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
