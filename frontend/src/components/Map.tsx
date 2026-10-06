"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type LatLng = [number, number];

interface NearbyFeature {
  id: string;
  name: string;
  distance_m: number;
  latitude: number;
  longitude: number;
  properties: Record<string, any>;
}

interface MapProps {
  lastSeen?: { lat: number; lng: number };
  cctv?: NearbyFeature[];
  police?: NearbyFeature;
  chokepoints?: NearbyFeature[];
  searchRadius?: number;
  height?: number;
  showControls?: boolean;
}

interface GeoPoint {
  id: string;
  name: string;
  position: LatLng;
}

type LoadStatus = "loading" | "ready" | "error";

const DEFAULT_CENTER: LatLng = [19.9975, 73.7898];

const COLORS = {
  lastSeen: "#dc2626",
  cctv: "#2563eb",
  police: "#b91c1c",
  chokepoint: "#ea580c",
  risk: { high: "#dc2626", medium: "#ea580c", low: "#16a34a" } as Record<string, string>,
};

const DATASETS = {
  cctv: "/data/cctv_dataset.json",
  police: "/data/police_stations.json",
  chokepoints: "/data/nashik_kumbh_chokepoints_parking_map.json",
};

const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

const makePin = (color: string, scale = 1) =>
  L.divIcon({
    className: "km-pin",
    html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 24 14 38 14 38s14-14 14-24.2C28 6.2 21.7 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`,
    iconSize: [28 * scale, 38 * scale],
    iconAnchor: [14 * scale, 38 * scale],
    popupAnchor: [0, -34 * scale],
  });

const lastSeenIcon = L.divIcon({
  className: "km-pulse",
  html: `<span class="km-pulse-ring"></span><span class="km-pulse-dot"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const ICONS = {
  cctv: makePin(COLORS.cctv),
  police: makePin(COLORS.police, 1.15),
  chokepoint: (risk?: string) => makePin(COLORS.risk[(risk ?? "").toLowerCase()] ?? COLORS.chokepoint),
};

function useGeoPoints(url: string) {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((geo) => {
        const parsed: GeoPoint[] = (geo?.features ?? [])
          .filter((f: any) => f?.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates))
          .map((f: any, i: number) => ({
            id: `${url}-${i}`,
            name: f.properties?.name || "Unnamed",
            position: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as LatLng,
          }));
        setPoints(parsed);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [url]);

  return { points, status };
}

function Viewport({ points, lastSeen, radius, fitSignal }: { points: LatLng[]; lastSeen?: LatLng; radius?: number; fitSignal: number }) {
  const map = useMap();
  const signature = JSON.stringify(points) + JSON.stringify(lastSeen) + radius;

  useEffect(() => {
    const bounds = L.latLngBounds(points);
    if (lastSeen) {
      bounds.extend(lastSeen);
      if (radius) bounds.extend(L.latLng(lastSeen).toBounds(radius));
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    } else {
      map.setView(DEFAULT_CENTER, 14);
    }
  }, [signature, fitSignal, map]);

  return null;
}

const STYLES = `
.km-pin{background:transparent;border:0}
.km-pulse{background:transparent;border:0;position:relative}
.km-pulse-dot{position:absolute;left:6px;top:6px;width:16px;height:16px;border-radius:9999px;background:#dc2626;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.km-pulse-ring{position:absolute;left:0;top:0;width:28px;height:28px;border-radius:9999px;background:rgba(220,38,38,.35);animation:km-ping 1.8s ease-out infinite}
@keyframes km-ping{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.9);opacity:0}}
@media (prefers-reduced-motion:reduce){.km-pulse-ring{animation:none}}
`;

type LayerKey = "cctv" | "police" | "chokepoints" | "background" | "route";

const LAYER_LABELS: Record<LayerKey, { label: string; color: string }> = {
  cctv: { label: "Nearby cameras", color: COLORS.cctv },
  police: { label: "Alerted station", color: COLORS.police },
  chokepoints: { label: "Chokepoints", color: COLORS.chokepoint },
  background: { label: "All database points", color: "#94a3b8" },
  route: { label: "Route to station", color: COLORS.lastSeen },
};

export default function KumbhMap({
  lastSeen,
  cctv = [],
  police,
  chokepoints = [],
  searchRadius,
  height = 500,
  showControls = true,
}: MapProps) {
  const { resolvedTheme } = useTheme();
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    cctv: true,
    police: true,
    chokepoints: true,
    background: false,
    route: true,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);

  const cctvData = useGeoPoints(DATASETS.cctv);
  const policeData = useGeoPoints(DATASETS.police);
  const chokepointData = useGeoPoints(DATASETS.chokepoints);

  const lastSeenPos: LatLng | undefined = lastSeen ? [lastSeen.lat, lastSeen.lng] : undefined;

  const focusPoints = useMemo<LatLng[]>(() => {
    const pts: LatLng[] = [];
    cctv.forEach((c) => pts.push([c.latitude, c.longitude]));
    chokepoints.forEach((c) => pts.push([c.latitude, c.longitude]));
    if (police) pts.push([police.latitude, police.longitude]);
    return pts;
  }, [cctv, chokepoints, police]);

  const toggle = (key: LayerKey) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const backgroundSets = [
    { key: "cctv", data: cctvData, color: COLORS.cctv, label: "Camera" },
    { key: "police", data: policeData, color: COLORS.police, label: "Police station" },
    { key: "choke", data: chokepointData, color: COLORS.chokepoint, label: "Chokepoint" },
  ];

  const anyLoading = backgroundSets.some((s) => s.data.status === "loading");
  const anyError = backgroundSets.some((s) => s.data.status === "error");

  const counts: Record<LayerKey, number | null> = {
    cctv: cctv.length,
    police: police ? 1 : 0,
    chokepoints: chokepoints.length,
    background: backgroundSets.reduce((sum, s) => sum + s.data.points.length, 0),
    route: police && lastSeen ? 1 : 0,
  };

  return (
    <div className="relative z-0 h-full w-full overflow-hidden rounded-md border border-border shadow-sm" style={{ minHeight: height }}>
      <style>{STYLES}</style>

      <MapContainer center={lastSeenPos ?? DEFAULT_CENTER} zoom={14} style={{ height }} className={`w-full ${resolvedTheme === "dark" ? "km-dark-basemap" : "km-light-basemap"}`} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Viewport points={focusPoints} lastSeen={lastSeenPos} radius={searchRadius} fitSignal={fitSignal} />

        {layers.background &&
          backgroundSets.map((set) =>
            set.data.points.map((p) => (
              <CircleMarker
                key={p.id}
                center={p.position}
                radius={5}
                pathOptions={{ color: set.color, fillColor: set.color, fillOpacity: 0.35, weight: 1, opacity: 0.6 }}
              >
                <Popup>
                  <div className="font-semibold">{set.label}</div>
                  <div className="text-sm">{p.name}</div>
                </Popup>
              </CircleMarker>
            ))
          )}

        {lastSeenPos && (
          <>
            <Marker position={lastSeenPos} icon={lastSeenIcon} zIndexOffset={1000}>
              <Popup>
                <div className="text-base font-semibold">Last seen location</div>
                {searchRadius ? <div className="text-sm">Search radius: {formatDistance(searchRadius)}</div> : null}
              </Popup>
            </Marker>
            {searchRadius ? (
              <Circle
                center={lastSeenPos}
                radius={searchRadius}
                pathOptions={{ color: COLORS.lastSeen, fillColor: COLORS.lastSeen, fillOpacity: 0.08, weight: 2, dashArray: "6 6" }}
              />
            ) : null}
          </>
        )}

        {layers.route && lastSeenPos && police && (
          <Polyline
            positions={[lastSeenPos, [police.latitude, police.longitude]]}
            pathOptions={{ color: COLORS.lastSeen, weight: 3, opacity: 0.7, dashArray: "2 8", lineCap: "round" }}
          />
        )}

        {layers.cctv &&
          cctv.map((camera) => (
            <Marker key={camera.id} position={[camera.latitude, camera.longitude]} icon={ICONS.cctv}>
              <Popup>
                <div className="font-semibold">Camera: {camera.name}</div>
                <div className="text-sm">Distance: {formatDistance(camera.distance_m)}</div>
              </Popup>
            </Marker>
          ))}

        {layers.chokepoints &&
          chokepoints.map((cp) => (
            <Marker key={cp.id} position={[cp.latitude, cp.longitude]} icon={ICONS.chokepoint(cp.properties?.risk_level)}>
              <Popup>
                <div className="font-semibold">Chokepoint: {cp.name}</div>
                <div className="text-sm">Risk level: {cp.properties?.risk_level ?? "Unknown"}</div>
                <div className="text-sm">Distance: {formatDistance(cp.distance_m)}</div>
              </Popup>
            </Marker>
          ))}

        {layers.police && police && (
          <Marker position={[police.latitude, police.longitude]} icon={ICONS.police} zIndexOffset={500}>
            <Popup>
              <div className="font-semibold">Police: {police.name}</div>
              <div className="text-sm font-bold text-red-600">Alert this station</div>
              <div className="text-sm">Distance: {formatDistance(police.distance_m)}</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {showControls && (
        <div
          ref={(el) => {
            if (el) {
              L.DomEvent.disableClickPropagation(el);
              L.DomEvent.disableScrollPropagation(el);
            }
          }}
          className="absolute right-3 top-3 z-[1000] min-w-44 rounded-xl border border-border bg-background/95 text-foreground shadow-lg backdrop-blur"
        >
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold"
          >
            Map layers
            <span aria-hidden className="text-base leading-none text-muted-foreground">{panelOpen ? "−" : "+"}</span>
          </button>

          {panelOpen && (
            <div className="space-y-1 border-t border-border px-3 py-2">
              {(Object.keys(LAYER_LABELS) as LayerKey[]).filter((key) => counts[key] || key === "background").map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                  <input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} className="h-4 w-4 accent-current" />
                  <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center text-[10px] font-bold ${key === "route" ? "rounded-none" : "rounded-full"}`} style={{ backgroundColor: LAYER_LABELS[key].color, color: "white" }}>{key === "chokepoints" ? "!" : key === "police" ? "P" : key === "cctv" ? "C" : key === "route" ? "→" : "•"}</span>
                  <span className="flex-1">{LAYER_LABELS[key].label}</span>
                  <span className="text-xs text-muted-foreground">{counts[key]}</span>
                </label>
              ))}

              <div className="flex items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="grid h-3 w-3 place-items-center rounded-full text-[8px] text-white" style={{ backgroundColor: COLORS.risk.high }}>!</span>High</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rotate-45" style={{ backgroundColor: COLORS.risk.medium }} />Medium</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3" style={{ backgroundColor: COLORS.risk.low }} />Low</span>
              </div>

              <button
                type="button"
                onClick={() => setFitSignal((n) => n + 1)}
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Recenter on search area
              </button>
            </div>
          )}
        </div>
      )}

      {(police || cctv.length > 0 || chokepoints.length > 0) && (
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-2 text-xs">
          {police && (
            <span className="rounded-full border border-border bg-background/95 px-3 py-1.5 font-medium shadow-sm">
              Station {formatDistance(police.distance_m)} away
            </span>
          )}
          <span className="rounded-full border border-border bg-background/95 px-3 py-1.5 font-medium shadow-sm">{cctv.length} cameras</span>
          <span className="rounded-full border border-border bg-background/95 px-3 py-1.5 font-medium shadow-sm">{chokepoints.length} chokepoints</span>
        </div>
      )}

      {(anyLoading || anyError) && (
        <div role="status" className="absolute bottom-3 right-3 z-[1000] rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm">
          {anyError ? "Some map data could not be loaded" : "Loading map data"}
        </div>
      )}
    </div>
  );
}
