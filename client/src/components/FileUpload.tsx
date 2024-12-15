import { useState, useRef } from "react";
import { FileUp, ImageIcon, Cube as CubeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFile3DSelect?: (file: File) => void;
  show3DUpload?: boolean;
  loading: boolean;
  selectedFile?: File | null;
}

const FileUpload = ({
  onFileSelect,
  onFile3DSelect,
  show3DUpload,
  loading,
  selectedFile,
}: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setError(null);

    if (show3DUpload) {
      if (!file.name.toLowerCase().endsWith(".usdz")) {
        setError("Only USDZ files are allowed");
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError("File size must be less than 50MB");
        return false;
      }
    } else {
      if (!["image/png", "image/jpeg"].includes(file.type)) {
        setError("Only PNG and JPEG files are allowed");
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return false;
      }
    }
    return true;
  };

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

    if (!file) return;

    if (validateFile(file)) {
      if (show3DUpload) {
        onFile3DSelect?.(file);
      } else {
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
    if (!file) return;

    if (validateFile(file)) {
      if (show3DUpload) {
        onFile3DSelect?.(file);
      } else {
        onFileSelect(file);
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
                {show3DUpload ? (
                  <CubeIcon className="w-12 h-12 text-primary" />
                ) : (
                  <FileUp className="w-12 h-12 text-primary" />
                )}
              </motion.div>

              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-semibold tracking-tight">
                  Upload your {show3DUpload ? "3D floor plan" : "floor plan"}
                </h3>

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium text-green-600">
                      Selected file: {selectedFile.name}
                    </p>
                    {loading && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-600">
                          Uploading...
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-base text-muted-foreground">
                    Drag and drop your file here, or
                  </p>
                )}

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={show3DUpload ? ".usdz" : "image/png,image/jpeg"}
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
                        {show3DUpload ? (
                          <CubeIcon className="w-5 h-5 mr-2" />
                        ) : (
                          <ImageIcon className="w-5 h-5 mr-2" />
                        )}
                        Choose File
                      </>
                    )}
                  </Button>
                </div>

                {error && (
                  <p className="text-sm text-red-500 font-medium">{error}</p>
                )}

                <p className="text-sm text-muted-foreground">
                  {show3DUpload
                    ? "Supported format: USDZ (max 50MB)"
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
