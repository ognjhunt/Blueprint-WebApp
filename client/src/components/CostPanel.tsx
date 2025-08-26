// FILE: src/components/CostPanel.tsx
import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Image as ImageIcon,
  Video,
  Music2,
  Box,
  Globe,
  Type,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CostPanelProps {
  imageCount: number;
  videoCount: number;
  audioCount: number;
  modelCount: number;
  webpageCount: number;
  textCount: number;
}

const BASE_RATE = 0.75;
const IMAGE_RATE = 0.005;
const VIDEO_RATE = 0.05;
const AUDIO_RATE = 0.01;
const MODEL_RATE = 0.02;
const WEBPAGE_RATE = 0.003;
const TEXT_RATE = 0.002;

export default function CostPanel({
  imageCount,
  videoCount,
  modelCount,
  audioCount,
  webpageCount,
  textCount,
}: CostPanelProps) {
  const total = useMemo(() => {
    return (
      BASE_RATE +
      imageCount * IMAGE_RATE +
      videoCount * VIDEO_RATE +
      audioCount * AUDIO_RATE +
      modelCount * MODEL_RATE +
      webpageCount * WEBPAGE_RATE +
      textCount * TEXT_RATE
    );
  }, [imageCount, videoCount, audioCount, modelCount, webpageCount, textCount]);

  type Item = {
    label: string;
    count: number;
    rate: number;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  };

  const items: Item[] = [
    { label: "Images", count: imageCount, rate: IMAGE_RATE, Icon: ImageIcon },
    { label: "Videos", count: videoCount, rate: VIDEO_RATE, Icon: Video },
    { label: "Audios", count: audioCount, rate: AUDIO_RATE, Icon: Music2 },
    { label: "3D Models", count: modelCount, rate: MODEL_RATE, Icon: Box },
    { label: "Webpages", count: webpageCount, rate: WEBPAGE_RATE, Icon: Globe },
    { label: "Text", count: textCount, rate: TEXT_RATE, Icon: Type },
  ];

  return (
    <Card className="w-56 text-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cost per Hour</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">${total.toFixed(2)}/hr</div>
        <Separator />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Base rate</span>
          <span>${BASE_RATE.toFixed(2)}/hr</span>
        </div>
        <Separator />

        {/* Legend with icon-only labels + tooltips */}
        <TooltipProvider delayDuration={120}>
          <div className="space-y-1">
            {items.map(({ label, count, rate, Icon }) => {
              const add = count * rate;
              return (
                <div key={label} className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Focusable trigger for keyboard users; visible text is only the count */}
                      <span
                        tabIndex={0}
                        className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                        aria-label={`${label} (${count})`}
                        title={label} // fallback if Tooltip not mounted
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                          <Icon
                            className="h-4 w-4 text-muted-foreground"
                            aria-hidden
                          />
                        </span>
                        <span>({count})</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>

                  <Badge variant="secondary">+${add.toFixed(3)}</Badge>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
