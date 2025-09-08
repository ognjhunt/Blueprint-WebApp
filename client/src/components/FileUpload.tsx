import { useState, useRef } from "react";
import { FileUp, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFile3DSelect?: (file: File) => void;
  show3DUpload?: boolean;
  loading: boolean;
}

const FileUpload = ({
  onFileSelect,
  onFile3DSelect,
  show3DUpload,
  loading,
}: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (show3DUpload) {
      if (
        file &&
        (file.type === "model/usdz" ||
          file.type === "model/gltf-binary" ||
          file.type === "model/gltf+json" ||
          file.name.endsWith(".usdz") ||
          file.name.endsWith(".glb") ||
          file.name.endsWith(".gltf"))
      ) {
        onFile3DSelect?.(file);
      }
    } else {
      if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
        onFileSelect(file);
      }
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (show3DUpload) {
        if (
          file.type === "model/usdz" ||
          file.type === "model/gltf-binary" ||
          file.type === "model/gltf+json" ||
          file.name.endsWith(".usdz") ||
          file.name.endsWith(".glb") ||
          file.name.endsWith(".gltf")
        ) {
          onFile3DSelect?.(file);
        }
      } else {
        if (file.type === "image/png" || file.type === "image/jpeg") {
          onFileSelect(file);
        }
      }
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md mx-auto p-4"
      >
        <Card
          className={cn(
            "relative transition-all duration-200",
            isDragging ? "scale-105 shadow-2xl" : "scale-100 shadow-lg",
          )}
        >
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-6">
              <motion.div
                className="p-6 rounded-full bg-primary/10"
                animate={{ scale: isDragging ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <FileUp className="w-12 h-12 text-primary" />
              </motion.div>

              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-semibold tracking-tight">
                  Upload your {show3DUpload ? "3D floor plan" : "floor plan"}
                </h3>
                <p className="text-base text-muted-foreground">
                  Drag and drop your file here, or
                </p>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={
                      show3DUpload
                        ? ".usdz,.glb,.gltf,model/usdz,model/gltf-binary,model/gltf+json"
                        : "image/png,image/jpeg,image/jpg"
                    }
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  <Button
                    variant="default"
                    disabled={loading}
                    size="lg"
                    className="min-w-[180px] h-12"
                    onClick={handleButtonClick}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5 mr-2" />
                        Choose File
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  {show3DUpload
                    ? "Supported formats: USDZ, GLB, GLTF (max 50MB)"
                    : "Supported formats: PNG, JPG (max 10MB)"}
                </p>
              </div>

              <AnimatePresence>
                {isDragging && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-primary/5 rounded-lg flex items-center justify-center border-2 border-primary border-dashed"
                  >
                    <p className="text-primary font-medium text-lg">
                      Drop your file here
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default FileUpload;
