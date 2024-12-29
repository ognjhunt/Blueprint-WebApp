import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GenerateImageSectionProps {
  lumaPrompt: string;
  setLumaPrompt: (prompt: string) => void;
  isGeneratingImage: boolean;
  generateImageWithLuma: (prompt: string) => Promise<void>;
  lumaStatus: "idle" | "dreaming" | "completed" | "failed";
  lumaError: string | null;
}

export function GenerateImageSection({
  lumaPrompt,
  setLumaPrompt,
  isGeneratingImage,
  generateImageWithLuma,
  lumaStatus,
  lumaError,
}: GenerateImageSectionProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Wand2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Generate Image with AI</h3>
      </div>

      <Card className="border border-gray-200">
        <CardHeader className="pb-0 pt-4 px-4">
          <p className="text-xs text-muted-foreground">
            Describe the image you want to create using natural language
          </p>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Input
              id="prompt-input"
              placeholder="E.g. A modern office space with large windows..."
              value={lumaPrompt}
              onChange={(e) => setLumaPrompt(e.target.value)}
              className="pr-24"
              disabled={isGeneratingImage}
            />
            <Button
              size="sm"
              onClick={() => generateImageWithLuma(lumaPrompt)}
              disabled={isGeneratingImage || !lumaPrompt.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
              variant={isGeneratingImage ? "secondary" : "default"}
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3 w-3" />
                  Generate
                </>
              )}
            </Button>
          </div>

          {lumaStatus === "dreaming" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Dreaming up your image...
            </div>
          )}

          {lumaError && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-md py-2 px-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {lumaError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
