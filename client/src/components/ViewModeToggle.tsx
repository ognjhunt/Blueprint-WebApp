import { Button } from "@/components/ui/button";
import { Box, Square } from "lucide-react";

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
  return (
    <div className="fixed top-20 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-1 flex space-x-1">
        <Button
          variant={mode === "2D" ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange("2D")}
          className="flex items-center gap-2"
        >
          <Square className="h-4 w-4" />
          2D
        </Button>
        <Button
          variant={mode === "3D" ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange("3D")}
          className="flex items-center gap-2"
        >
          <Box className="h-4 w-4" />
          3D {!has3DModel && "(Upload)"}
        </Button>
      </div>
    </div>
  );
};

export default ViewModeToggle;
