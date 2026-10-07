"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTheme } from "@/components/PreferencesProvider";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Search,
  Filter,
  X,
  AlertTriangle,
  User,
  MapPin,
  Clock,
  ChevronRight,
  Layers,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface MapReport {
  id: string;
  type: "MISSING" | "FOUND" | "PREREGISTERED";
  status: string;
  full_name: string | null;
  age: number;
  gender: string;
  clothing_description: string | null;
  distinguishing_marks: string | null;
  medical_needs: string | null;
  lat: number;
  lng: number;
  landmark: string | null;
  last_seen_at: string | null;
  booth_id: string | null;
  created_at: string;
}

interface MapPoi {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  status: string;
}

type LatLng = [number, number];

const DEFAULT_CENTER: LatLng = [19.9975, 73.7898];
const DEFAULT_ZOOM = 14;

const REPORT_COLORS = {
  MISSING: "#dc2626",
  FOUND: "#16a34a",
  PREREGISTERED: "#2563eb",
};

const POI_COLORS: Record<string, string> = {
  BOOTH: "#D4621A",
  POLICE: "#b91c1c",
  CCTV: "#2563eb",
  CHOKEPOINT: "#ea580c",
  MEDICAL: "#dc2626",
  WATER: "#0284c7",
  OTHER: "#6b7280",
};

const POI_LABELS: Record<string, string> = {
  BOOTH: "Booth",
  POLICE: "Police",
  CCTV: "CCTV",
  CHOKEPOINT: "Chokepoint",
  MEDICAL: "Medical",
  WATER: "Water",
  OTHER: "Other",
};

function makePinSvg(color: string, letter: string): string {
  return `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 24 14 38 14 38s14-14 14-24.2C28 6.2 21.7 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/><text x="14" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="sans-serif">${letter}</text></svg>`;
}

const makeReportIcon = (type: string) =>
  L.divIcon({
    className: "km-report-pin",
    html: makePinSvg(
      REPORT_COLORS[type as keyof typeof REPORT_COLORS] ?? "#6b7280",
      type === "MISSING" ? "M" : type === "FOUND" ? "F" : "P"
    ),
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });

const makePoiIcon = (type: string) =>
  L.divIcon({
    className: "km-poi-pin",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${POI_COLORS[type] ?? "#6b7280"};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><span style="color:white;font-size:9px;font-weight:bold">${(POI_LABELS[type] ?? "?").charAt(0)}</span></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });

const PULSE_ICON = L.divIcon({
  className: "km-selected-pin",
  html: `<span style="position:absolute;left:0;top:0;width:24px;height:24px;border-radius:9999px;background:rgba(212,98,26,.35);animation:km-ping 1.8s ease-out infinite"></span><span style="position:absolute;left:4px;top:4px;width:16px;height:16px;border-radius:9999px;background:#D4621A;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isUrgent(report: MapReport): boolean {
  return (
    (report.age < 12 || report.age >= 65 || !!report.medical_needs) &&
    report.status === "OPEN"
  );
}

const STYLES = `
.km-report-pin,.km-poi-pin,.km-selected-pin{background:transparent!important;border:0!important}
@keyframes km-ping{0%{transform:scale(.5);opacity:1}100%{transform:scale(2.2);opacity:0}}
@media(prefers-reduced-motion:reduce){.km-selected-pin span:first-child{animation:none}}
`;

interface OpsMapProps {
  initialReports: MapReport[];
  initialPois: MapPoi[];
}

type PoiLayerKey = "BOOTH" | "POLICE" | "CCTV" | "CHOKEPOINT" | "MEDICAL" | "WATER";

export function OpsMap({ initialReports, initialPois }: OpsMapProps) {
  const { resolvedTheme } = useTheme();
  const [reports, setReports] = useState<MapReport[]>(initialReports);
  const [pois] = useState<MapPoi[]>(initialPois);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>("OPEN");
  const [selectedReport, setSelectedReport] = useState<MapReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [layerPanel, setLayerPanel] = useState(false);
  const [poiLayers, setPoiLayers] = useState<Record<PoiLayerKey, boolean>>({
    BOOTH: true,
    POLICE: true,
    CCTV: false,
    CHOKEPOINT: true,
    MEDICAL: true,
    WATER: false,
  });
  const [showReports, setShowReports] = useState(true);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [reports, typeFilter, statusFilter]);

  const filteredPois = useMemo(() => {
    return pois.filter((p) => poiLayers[p.type as PoiLayerKey] && p.status === "active");
  }, [pois, poiLayers]);

  const allPoints = useMemo<LatLng[]>(() => {
    const pts: LatLng[] = [];
    if (showReports) {
      filteredReports.forEach((r) => {
        if (r.lat && r.lng) pts.push([r.lat, r.lng]);
      });
    }
    filteredPois.forEach((p) => pts.push([p.lat, p.lng]));
    return pts;
  }, [filteredReports, filteredPois, showReports]);

  const doSearch = useCallback(async () => {
    if (!search.trim()) {
      setReports(initialReports);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: search });
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/map/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, initialReports]);

  const poiCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pois.forEach((p) => {
      counts[p.type] = (counts[p.type] ?? 0) + 1;
    });
    return counts;
  }, [pois]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3 lg:flex-row">
      <style>{STYLES}</style>

      <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
          <Input
            placeholder="Search name, clothing, landmark..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            className="h-10 pl-10 pr-20"
          />
          <div className="absolute right-1 top-1 flex gap-1">
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setReports(initialReports);
                }}
                className="rounded-md p-1.5 text-ink-2 hover:bg-neutral-bg"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={doSearch}
              disabled={loading}
              className="rounded-md bg-primary-subtle p-1.5 text-saffron hover:bg-primary-subtle"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["MISSING", "FOUND", "PREREGISTERED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`rounded-full px-2.5 py-1 text-2xs font-bold transition-colors ${
                typeFilter === t
                  ? "text-white"
                  : "bg-neutral-bg text-ink-2 hover:bg-neutral-bg"
              }`}
              style={
                typeFilter === t
                  ? { backgroundColor: REPORT_COLORS[t] }
                  : undefined
              }
            >
              {t === "PREREGISTERED" ? "Pre-reg" : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
          <span className="mx-1 text-beige">|</span>
          {(["OPEN", "MATCH_PENDING", "REUNITED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={`rounded-full px-2.5 py-1 text-2xs font-bold transition-colors ${
                statusFilter === s
                  ? "bg-primary-subtle text-saffron"
                  : "bg-neutral-bg text-ink-2 hover:bg-neutral-bg"
              }`}
            >
              {s === "MATCH_PENDING" ? "Match" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-card p-2">
          <p className="px-1 text-2xs font-semibold text-ink-2">
            {filteredReports.length} reports on map
          </p>
          {filteredReports.map((report) => {
            const urgent = isUrgent(report);
            const isSelected = selectedReport?.id === report.id;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReport(report)}
                className={`flex w-full items-start gap-2 rounded-xl p-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-primary-subtle ring-1 ring-ring/30"
                    : urgent
                      ? "bg-destructive/[0.02] hover:bg-danger-bg"
                      : "hover:bg-neutral-bg"
                }`}
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      REPORT_COLORS[report.type as keyof typeof REPORT_COLORS],
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {report.full_name ?? "Unknown person"}
                    {urgent && (
                      <AlertTriangle className="ml-1 inline h-3 w-3 text-destructive" />
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-2">
                    {report.age}y {report.gender} ·{" "}
                    {report.landmark ?? "No location"}
                  </p>
                  {report.last_seen_at && (
                    <p className="mt-0.5 text-2xs text-ink-2">
                      <Clock className="mr-0.5 inline h-3 w-3" />
                      {timeAgo(report.last_seen_at)}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-2/20" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-border shadow-sm">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          className={
            resolvedTheme === "dark"
              ? "km-dark-basemap"
              : "km-light-basemap"
          }
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {allPoints.length > 0 && <FitBounds points={allPoints} />}

          {showReports &&
            filteredReports.map((report) => (
              <Marker
                key={report.id}
                position={[report.lat, report.lng]}
                icon={
                  selectedReport?.id === report.id
                    ? PULSE_ICON
                    : makeReportIcon(report.type)
                }
                zIndexOffset={selectedReport?.id === report.id ? 1000 : 0}
                eventHandlers={{
                  click: () => setSelectedReport(report),
                }}
              >
                <Popup maxWidth={280}>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-0 text-2xs"
                        style={{
                          backgroundColor: `${REPORT_COLORS[report.type as keyof typeof REPORT_COLORS]}20`,
                          color: REPORT_COLORS[report.type as keyof typeof REPORT_COLORS],
                        }}
                      >
                        {report.type}
                      </Badge>
                      <span className="text-xs font-bold text-foreground">
                        {report.full_name ?? "Unknown"}
                      </span>
                    </div>
                    <p className="text-xs text-ink-2">
                      {report.age}y {report.gender} ·{" "}
                      {report.landmark}
                    </p>
                    <p className="line-clamp-2 text-xs text-ink-2">
                      {report.clothing_description}
                    </p>
                    {report.medical_needs && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {report.medical_needs}
                      </p>
                    )}
                    <Link
                      href={`/reports/${report.id}`}
                      className="mt-1 inline-block text-xs font-semibold text-saffron hover:underline"
                    >
                      View full report →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}

          {filteredPois.map((poi) => (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lng]}
              icon={makePoiIcon(poi.type)}
            >
              <Popup>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {POI_LABELS[poi.type] ?? poi.type}: {poi.name}
                  </p>
                  {poi.notes && (
                    <p className="mt-0.5 text-xs text-ink-2">
                      {poi.notes}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

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
            onClick={() => setLayerPanel((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> Layers
            </span>
            <span className="text-base leading-none text-muted-foreground">
              {layerPanel ? "−" : "+"}
            </span>
          </button>
          {layerPanel && (
            <div className="space-y-1 border-t border-border px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={showReports}
                  onChange={() => setShowReports(!showReports)}
                  className="h-4 w-4 accent-current"
                />
                <span className="flex-1">Reports</span>
                <span className="text-xs text-muted-foreground">
                  {filteredReports.length}
                </span>
              </label>
              {(Object.keys(POI_LABELS) as PoiLayerKey[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={poiLayers[key] ?? false}
                    onChange={() =>
                      setPoiLayers((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))
                    }
                    className="h-4 w-4 accent-current"
                  />
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: POI_COLORS[key] }}
                  />
                  <span className="flex-1">{POI_LABELS[key]}</span>
                  <span className="text-xs text-muted-foreground">
                    {poiCounts[key] ?? 0}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-2 text-xs">
          {(["MISSING", "FOUND", "PREREGISTERED"] as const).map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full border border-border bg-background/95 px-2.5 py-1 font-medium shadow-sm"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: REPORT_COLORS[t] }}
              />
              {t === "PREREGISTERED" ? "Pre-reg" : t.charAt(0) + t.slice(1).toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {selectedReport && (
        <div className="absolute bottom-0 left-0 right-0 z-[1001] rounded-t-2xl border-t border-border bg-card p-4 shadow-xl lg:static lg:w-72 lg:rounded-xl lg:border lg:shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <Badge
                variant="outline"
                className="mb-1 border-0 text-2xs"
                style={{
                  backgroundColor: `${REPORT_COLORS[selectedReport.type as keyof typeof REPORT_COLORS]}15`,
                  color: REPORT_COLORS[selectedReport.type as keyof typeof REPORT_COLORS],
                }}
              >
                {selectedReport.type} · {selectedReport.status}
              </Badge>
              <h3 className="font-semibold text-foreground">
                {selectedReport.full_name ?? "Unknown person"}
              </h3>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
              className="rounded-md p-1 text-ink-2 hover:bg-neutral-bg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2 text-sm text-ink-2">
            <p>
              <User className="mr-1 inline h-3.5 w-3.5" />
              {selectedReport.age}y {selectedReport.gender}
            </p>
            {selectedReport.landmark && (
              <p>
                <MapPin className="mr-1 inline h-3.5 w-3.5" />
                {selectedReport.landmark}
              </p>
            )}
            {selectedReport.last_seen_at && (
              <p>
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                {timeAgo(selectedReport.last_seen_at)}
              </p>
            )}
            {selectedReport.clothing_description && (
              <p className="line-clamp-3 text-xs">
                👕 {selectedReport.clothing_description}
              </p>
            )}
            {selectedReport.distinguishing_marks && (
              <p className="text-xs">
                🔍 {selectedReport.distinguishing_marks}
              </p>
            )}
            {selectedReport.medical_needs && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {selectedReport.medical_needs}
              </p>
            )}
          </div>

          <Link
            href={`/reports/${selectedReport.id}`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            View full report
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
