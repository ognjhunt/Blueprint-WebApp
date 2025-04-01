// ABOVE THIS LINE: (No code above; this is the file start)

"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Box, Square, Loader2 } from "lucide-react";

interface ViewModeToggleProps {
  mode: "2D" | "3D" | "WORKFLOW";
  onChange: (mode: "2D" | "3D" | "WORKFLOW") => void;
  has3DModel: boolean;
  isLoading?: boolean;
}

export default function ViewModeToggle({
  mode,
  onChange,
  has3DModel,
  isLoading = false,
}: ViewModeToggleProps) {
  return (
    <div className="fixed top-20 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-1 flex space-x-1">
        <Button
          variant={mode === "2D" ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange("2D")}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          <Square className="h-4 w-4" />
          2D
        </Button>
        <Button
          variant={mode === "3D" ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange("3D")}
          className="flex items-center gap-2"
          disabled={isLoading || !has3DModel}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Box className="h-4 w-4" />
          )}
          3D
        </Button>
        <Button
          variant={mode === "WORKFLOW" ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange("WORKFLOW")}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          Workflow
        </Button>
      </div>
    </div>
  );
}

// BELOW THIS LINE: (No more code in this file)
