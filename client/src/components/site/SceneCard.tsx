import { InteractionBadges } from "./InteractionBadges";
import type { Scene } from "@/data/content";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

interface SceneCardProps {
  scene: Scene;
}

export function SceneCard({ scene }: SceneCardProps) {
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();

  const handleCardClick = () => {
    const targetPath = `/marketplace/${scene.slug}`;
    if (!currentUser) {
      sessionStorage.setItem("redirectAfterAuth", targetPath);
      navigate("/login");
      return;
    }
    navigate(targetPath);
  };

  return (
    <button
      type="button"
      onClick={handleCardClick}
      className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-left transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={scene.thumb}
          alt={scene.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-400">
            {scene.tags.join(" • ")}
          </div>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            {scene.title}
          </h3>
          <p className="mt-3 text-sm text-slate-500">{scene.seo}</p>
        </div>
        <InteractionBadges types={scene.interactions.map((i) => i.type)} />
        <div className="mt-auto flex items-center justify-between text-sm">
          <span className="font-medium text-slate-900">{scene.leadTime}</span>
          <span className="text-slate-400 transition group-hover:text-slate-600">
            View details →
          </span>
        </div>
      </div>
    </button>
  );
}
