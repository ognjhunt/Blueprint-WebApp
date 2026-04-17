import { useMemo, useRef, useState } from "react";
import { ArrowRight, Building2, Factory, RadioTower } from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import type { PublicLaunchCity } from "@/lib/publicLaunchStatus";
import { getLaunchAudienceActions, launchStatusMeta } from "@/lib/launchMap";

const geographyUrl = "/maps/us-states-10m.json";
const mapWidth = 975;
const mapHeight = 610;

const audienceIcons = {
  "Robot teams": RadioTower,
  "Site operators": Building2,
  Capturers: Factory,
} as const;

type MarkerPosition = {
  x: number;
  y: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function deriveMarkerPosition(
  container: HTMLDivElement | null,
  target: EventTarget | null,
): MarkerPosition | null {
  if (!container || !(target instanceof SVGGraphicsElement)) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const markerRect = target.getBoundingClientRect();

  return {
    x: markerRect.left - containerRect.left + markerRect.width / 2,
    y: markerRect.top - containerRect.top + markerRect.height / 2,
  };
}

function LaunchPopover({
  city,
  position,
  container,
  onClose,
}: {
  city: PublicLaunchCity;
  position: MarkerPosition;
  container: HTMLDivElement | null;
  onClose: () => void;
}) {
  const meta = launchStatusMeta[city.status];
  const actions = getLaunchAudienceActions(city);
  const containerWidth = container?.clientWidth || mapWidth;
  const containerHeight = container?.clientHeight || mapHeight;
  const cardWidth = Math.min(340, containerWidth - 24);
  const left = clamp(position.x - cardWidth / 2, 12, containerWidth - cardWidth - 12);
  const top = clamp(position.y - 198, 16, containerHeight - 220);

  return (
    <div
      className="pointer-events-none absolute z-20 hidden md:block"
      style={{ left, top, width: cardWidth }}
    >
      <div className="pointer-events-auto rounded-[1.4rem] border border-[color:var(--line)] bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
              Launch detail
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[color:var(--ink)]">
              {city.displayName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs font-semibold text-[color:var(--ink-soft)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--ink)]"
          >
            Close
          </button>
        </div>

        <div
          className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.badgeClassName}`}
        >
          {meta.label}
        </div>
        <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">{meta.definition}</p>

        {city.status === "live" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/signup/capturer"
              className="inline-flex items-center rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--leaf-deep)]"
            >
              Apply for capturer access
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {actions.map((action) => {
            const Icon = audienceIcons[action.audience];

            return (
              <div key={`${city.citySlug}-${action.audience}`} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]/70 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
                  <Icon className="h-3.5 w-3.5" />
                  {action.audience}
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">{action.note}</p>
                <a
                  href={action.href}
                  className="mt-3 inline-flex items-center text-sm font-semibold text-[color:var(--ink)]"
                >
                  {action.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileLaunchDetail({
  city,
  onClose,
}: {
  city: PublicLaunchCity;
  onClose: () => void;
}) {
  const meta = launchStatusMeta[city.status];
  const actions = getLaunchAudienceActions(city);

  return (
    <div className="mt-5 rounded-[1.6rem] border border-[color:var(--line)] bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.08)] md:hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
            Launch detail
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[color:var(--ink)]">{city.displayName}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs font-semibold text-[color:var(--ink-soft)]"
        >
          Close
        </button>
      </div>

      <div
        className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.badgeClassName}`}
      >
        {meta.label}
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">{meta.definition}</p>

      {city.status === "live" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/signup/capturer"
            className="inline-flex items-center rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--leaf-deep)]"
          >
            Apply for capturer access
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {actions.map((action) => {
          const Icon = audienceIcons[action.audience];

          return (
            <div key={`${city.citySlug}-${action.audience}`} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]/70 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
                <Icon className="h-3.5 w-3.5" />
                {action.audience}
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">{action.note}</p>
              <a
                href={action.href}
                className="mt-3 inline-flex items-center text-sm font-semibold text-[color:var(--ink)]"
              >
                {action.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PublicLaunchMap({
  cities,
  className = "",
}: {
  cities: PublicLaunchCity[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCitySlug, setHoveredCitySlug] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<MarkerPosition | null>(null);
  const [selectedCitySlug, setSelectedCitySlug] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<MarkerPosition | null>(null);

  const visibleCities = useMemo(
    () => cities.filter((city) => city.latitude !== null && city.longitude !== null),
    [cities],
  );
  const selectedCity = visibleCities.find((city) => city.citySlug === selectedCitySlug) || null;
  const hoveredCity = visibleCities.find((city) => city.citySlug === hoveredCitySlug) || null;
  const groupedCities = {
    live: cities.filter((city) => city.status === "live"),
    planned: cities.filter((city) => city.status === "planned"),
    under_review: cities.filter((city) => city.status === "under_review"),
  };

  const openCity = (
    city: PublicLaunchCity,
    target: EventTarget | null,
  ) => {
    const position = deriveMarkerPosition(containerRef.current, target);
    setSelectedCitySlug(city.citySlug);
    if (position) {
      setSelectedPosition(position);
    }
  };

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[radial-gradient(circle_at_top,_rgba(21,128,61,0.08),_transparent_30%),linear-gradient(180deg,#fffdf8_0%,#f4efe4_100%)] p-3 sm:p-5"
      >
        <div className="rounded-[1.6rem] border border-[color:var(--line)] bg-white/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-4">
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 1200 }}
            width={mapWidth}
            height={mapHeight}
            className="h-auto w-full"
            aria-label="Blueprint United States launch map"
          >
            <Geographies geography={geographyUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#ebe5d6"
                    stroke="#d2cab4"
                    strokeWidth={0.75}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#e2d9c3", outline: "none" },
                      pressed: { fill: "#e2d9c3", outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {visibleCities.map((city) => {
              const meta = launchStatusMeta[city.status];
              const isSelected = city.citySlug === selectedCitySlug;
              const isHovered = city.citySlug === hoveredCitySlug;

              return (
                <Marker
                  key={city.citySlug}
                  coordinates={[city.longitude!, city.latitude!]}
                >
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${city.displayName} details`}
                    onMouseEnter={(event) => {
                      setHoveredCitySlug(city.citySlug);
                      setHoveredPosition(
                        deriveMarkerPosition(containerRef.current, event.currentTarget),
                      );
                    }}
                    onMouseMove={(event) => {
                      setHoveredPosition(
                        deriveMarkerPosition(containerRef.current, event.currentTarget),
                      );
                    }}
                    onMouseLeave={() => {
                      setHoveredCitySlug((current) =>
                        current === city.citySlug ? null : current,
                      );
                    }}
                    onClick={(event) => openCity(city, event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCity(city, event.currentTarget);
                      }
                    }}
                    className="cursor-pointer focus:outline-none"
                  >
                    <circle
                      r={isSelected ? 18 : isHovered ? 16 : 14}
                      className={`transition ${meta.haloClassName}`}
                    />
                    <circle
                      r={isSelected ? 8 : 7}
                      className={`stroke-2 transition ${meta.markerClassName}`}
                    />
                  </g>
                </Marker>
              );
            })}
          </ComposableMap>
        </div>

        {hoveredCity && hoveredPosition ? (
          <div
            className="pointer-events-none absolute z-10 hidden rounded-2xl border border-[color:var(--line)] bg-white/95 px-3 py-2 text-left shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur md:block"
            style={{
              left: clamp(hoveredPosition.x - 72, 12, (containerRef.current?.clientWidth || mapWidth) - 180),
              top: clamp(hoveredPosition.y - 64, 12, (containerRef.current?.clientHeight || mapHeight) - 72),
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-muted)]">
              {launchStatusMeta[hoveredCity.status].label}
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{hoveredCity.displayName}</p>
          </div>
        ) : null}

        {selectedCity && selectedPosition ? (
          <LaunchPopover
            city={selectedCity}
            position={selectedPosition}
            container={containerRef.current}
            onClose={() => setSelectedCitySlug(null)}
          />
        ) : null}
      </div>

      {selectedCity && !selectedPosition ? (
        <MobileLaunchDetail city={selectedCity} onClose={() => setSelectedCitySlug(null)} />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(["live", "planned", "under_review"] as const).map((status) => {
          const meta = launchStatusMeta[status];
          const entries = groupedCities[status];

          return (
            <section key={status} className="rounded-[1.6rem] border border-[color:var(--line)] bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.badgeClassName}`}
                >
                  {meta.label}
                </div>
                <span className="text-sm font-semibold text-[color:var(--ink-soft)]">
                  {entries.length}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">{meta.definition}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {entries.length ? (
                  entries.map((city) => (
                    <button
                      key={city.citySlug}
                      type="button"
                      onClick={(event) => openCity(city, event.currentTarget)}
                      className="rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:border-[color:var(--line-strong)]"
                    >
                      {city.displayName}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-[color:var(--ink-muted)]">No cities currently listed.</span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
