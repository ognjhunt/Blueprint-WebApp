import { Button } from "@/components/ui/button";
import { Box, Square, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface ViewModeToggleProps {
  mode: "2D" | "3D";
  onChange: (mode: "2D" | "3D") => void;
  has3DModel: boolean;
}

const ViewModeToggle = ({
  mode,
  onChange,
  has3DModel,
}: ViewModeToggleProps) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Reset loading state when mode changes
    setIsLoading(false);
  }, [mode]);

  const handleModeChange = async (newMode: "2D" | "3D") => {
    if (newMode === "3D" && !has3DModel) {
      return;
    }

    if (newMode === "3D") {
      setIsLoading(true);
      try {
        await onChange(newMode);
      } catch (error) {
        console.error("Error loading 3D model:", error);
        // Reset to 2D mode on error
        onChange("2D");
      } finally {
        setIsLoading(false);
      }
    } else {
      onChange(newMode);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-1 flex space-x-1">
        <Button
          variant={mode === "2D" ? "default" : "ghost"}
          size="sm"
          onClick={() => handleModeChange("2D")}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          <Square className="h-4 w-4" />
          2D
        </Button>
        <Button
          variant={mode === "3D" ? "default" : "ghost"}
          size="sm"
          onClick={() => handleModeChange("3D")}
          className="flex items-center gap-2"
          disabled={isLoading || !has3DModel}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Box className="h-4 w-4" />
          )}
          3D {!has3DModel && "(Upload)"}
        </Button>
      </div>
    </div>
  );
};

export default ViewModeToggle;
