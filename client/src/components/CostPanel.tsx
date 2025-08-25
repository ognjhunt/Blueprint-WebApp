import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CostPanelProps {
  imageCount: number;
  videoCount: number;
  modelCount: number;
  webpageCount: number;
  textCount: number;
}

const BASE_RATE = 0.5;
const IMAGE_RATE = 0.01;
const VIDEO_RATE = 0.03;
const MODEL_RATE = 0.03;
const WEBPAGE_RATE = 0.02;
const TEXT_RATE = 0.01;

export default function CostPanel({
  imageCount,
  videoCount,
  modelCount,
  webpageCount,
  textCount,
}: CostPanelProps) {
  const total = useMemo(() => {
    return (
      BASE_RATE +
      imageCount * IMAGE_RATE +
      videoCount * VIDEO_RATE +
      modelCount * MODEL_RATE +
      webpageCount * WEBPAGE_RATE +
      textCount * TEXT_RATE
    );
  }, [imageCount, videoCount, modelCount, webpageCount, textCount]);

  const items = [
    { label: "Images", count: imageCount, rate: IMAGE_RATE },
    { label: "Videos", count: videoCount, rate: VIDEO_RATE },
    { label: "3D Models", count: modelCount, rate: MODEL_RATE },
    { label: "Webpages", count: webpageCount, rate: WEBPAGE_RATE },
    { label: "Text", count: textCount, rate: TEXT_RATE },
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
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between items-center">
              <span>
                {item.label} ({item.count})
              </span>
              <Badge variant="secondary">+${(item.count * item.rate).toFixed(2)}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

