import { Badge } from "@/components/ui/badge";
import type { InteractionType } from "@/data/content";

const labels: Record<InteractionType, string> = {
  revolute: "Revolute",
  prismatic: "Prismatic",
  pickable: "Pickable",
  button: "Button",
  knob: "Knob",
  switch: "Switch",
};

export function InteractionBadges({ types }: { types: InteractionType[] }) {
  const unique = Array.from(new Set(types));
  return (
    <div className="flex flex-wrap gap-2">
      {unique.map((type) => (
        <Badge key={type} variant="secondary" className="border border-slate-200 bg-white text-slate-600">
          {labels[type]}
        </Badge>
      ))}
    </div>
  );
}
