interface TileItem {
  label: string;
  href?: string;
  description?: string;
}

interface TileGridProps {
  items: TileItem[];
}

export function TileGrid({ items }: TileGridProps) {
  return (
    <div className="tile-grid">
      {items.map((item) => {
        const content = (
          <div className="flex h-full flex-col justify-between">
            <span className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Environment
            </span>
            <div>
              <p className="text-lg font-medium text-slate-900">{item.label}</p>
              {item.description ? (
                <p className="mt-2 text-sm text-slate-500">{item.description}</p>
              ) : null}
            </div>
          </div>
        );

        if (item.href) {
          return (
            <a key={item.label} href={item.href} className="block h-full">
              {content}
            </a>
          );
        }

        return (
          <div key={item.label} className="h-full">
            {content}
          </div>
        );
      })}
    </div>
  );
}
