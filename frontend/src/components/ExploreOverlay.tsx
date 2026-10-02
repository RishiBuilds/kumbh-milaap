"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, MapPin, X } from "lucide-react";

const zones = [
  {
    id: "A",
    name: "Ramkund & Ghats",
    description: "Riverside gathering and bathing ghats",
  },
  {
    id: "B",
    name: "Panchvati & Temple",
    description: "Temple precincts and walking routes",
  },
  {
    id: "C",
    name: "Tapovan Area",
    description: "Camp and river-crossing area",
  },
  {
    id: "D",
    name: "Nashik Road & Transit",
    description: "Arrival, bus, and railway connections",
  },
];

type ExploreOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function ExploreOverlay({
  open,
  onClose,
}: ExploreOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] overflow-y-auto bg-background px-5 py-5 md:p-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explore-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-saffron">
              Explore
            </p>
            <h2
              id="explore-title"
              className="mt-2 text-3xl font-bold tracking-tight"
            >
              Kumbh zones
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose an area to see its current information.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close zone explorer"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </header>

        <nav aria-label="Kumbh zones" className="divide-y divide-border">
          {zones.map((zone) => (
            <a
              key={zone.id}
              href="#zones"
              onClick={onClose}
              className="group flex items-center gap-4 py-5 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none md:px-3"
            >
              <span className="w-7 shrink-0 text-xs font-bold text-saffron">
                {zone.id}
              </span>

              <MapPin
                size={19}
                strokeWidth={1.75}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />

              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{zone.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {zone.description}
                </span>
              </span>

              <ArrowUpRight
                size={18}
                strokeWidth={1.75}
                className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}