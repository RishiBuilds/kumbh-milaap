"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2, ArrowLeft, Users, Eye, MapPin, Shield, AlertTriangle, Radio, Printer,
  CheckCircle2, Copy, Check, Search, Siren, Activity, Archive, WifiOff,
} from "lucide-react";
import { TempleSkyline } from "@/components/TempleSkyline";
import { ThemeToggle } from "@/components/ThemeToggle";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center bg-ivory/50">
      <Loader2 className="h-6 w-6 animate-spin text-saffron" />
    </div>
  ),
});

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const DEFAULT_COORDS: [number, number] = [19.9975, 73.7898];

const ZONES = [
  { id: "Zone A - Ramkund & Ghats", label: "Zone A: Ramkund & Ghats", coords: [20.003, 73.792] as [number, number] },
  { id: "Zone B - Panchvati & Temple", label: "Zone B: Panchvati & Temple", coords: [20.005, 73.795] as [number, number] },
  { id: "Zone C - Tapovan Area", label: "Zone C: Tapovan Area", coords: [19.965, 73.804] as [number, number] },
  { id: "Zone D - Nashik Road & Transit", label: "Zone D: Nashik Road & Transit", coords: [19.94, 73.815] as [number, number] },
];

const MINUTES_OPTIONS = [
  { value: "15", label: "15 minutes ago" },
  { value: "30", label: "30 minutes ago" },
  { value: "60", label: "1 hour ago" },
  { value: "120", label: "2 hours ago" },
  { value: "240", label: "4 hours or more" },
];

interface LiveStats {
  active_cases: number;
  total_cases: number;
  found_cases: number;
  closed_cases: number;
  cctv_count: number;
  chokepoint_count: number;
  police_count: number;
}

interface CaseRow {
  case_id: string;
  status: string;
  person?: { name?: string; age?: number };
  last_seen?: { landmark?: string };
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-saffron/10 text-saffron-dark border-saffron/20",
  found: "bg-emerald/10 text-emerald-dark border-emerald/20",
  closed: "bg-charcoal/5 text-charcoal-light border-beige/60",
};

const INPUT_CLASS =
  "h-9 rounded-lg border-beige/50 bg-ivory/60 text-sm focus-visible:border-saffron/30 focus-visible:ring-saffron";

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);
  const [offline, setOffline] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [caseFilter, setCaseFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/stats/`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (alive) {
          setLiveStats(data);
          setStatsError(false);
        }
      } catch {
        if (alive) setStatsError(true);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/cases/`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (alive && Array.isArray(data.results)) setCases(data.results);
      } catch {}
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [reportResult]);

  const filteredCases = useMemo(() => {
    const q = caseFilter.trim().toLowerCase();
    if (!q) return cases.slice(0, 8);
    return cases
      .filter((c) => `${c.case_id} ${c.person?.name ?? ""} ${c.last_seen?.landmark ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [cases, caseFilter]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setDispatched(false);

    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    const age = parseInt(fd.get("age") as string) || 30;
    const rawGender = fd.get("gender") as string;
    const gender = rawGender === "child" ? "other" : rawGender;
    const clothing = (fd.get("clothing") as string).trim();
    const zone = fd.get("zone") as string;
    const minutes = parseInt(fd.get("minutes") as string) || 30;
    const phone = ((fd.get("phone") as string) || "").replace(/\D/g, "").slice(-10) || "9999999999";
    const [lat, lon] = ZONES.find((z) => z.id === zone)?.coords ?? DEFAULT_COORDS;

    setMapCoords({ lat, lng: lon });

    try {
      const res = await fetch(`${API}/api/cases/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: { name, age, gender, clothing_description: clothing },
          last_seen: {
            latitude: lat,
            longitude: lon,
            landmark: zone,
            time: new Date().toTimeString().slice(0, 5),
            minutes_since: minutes,
          },
          contact: { name: "Admin Reporter", phone, relation: "Officer" },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReportResult(await res.json());
      setOffline(false);
      formRef.current?.reset();
    } catch {
      setOffline(true);
      setReportResult({
        case_id: "KM-OFFLINE",
        status: "active",
        recommendation: {
          priority_level: "pending",
          confidence: "Backend offline",
          search_radius_m: 1000,
          ai_summary: `Report for ${name} recorded offline. The backend is not reachable at ${API}.`,
          current_zone: { name: zone },
          nearest_police: { id: "PS-000", name: "Backend offline", distance_m: 0, latitude: lat, longitude: lon, properties: {} },
          nearby_cctv: [],
          nearby_chokepoints: [],
          priority_zones: [],
        },
      });
    }

    setLoading(false);
  };

  const copyCaseId = async () => {
    if (!reportResult?.case_id) return;
    try {
      await navigator.clipboard.writeText(reportResult.case_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const rec = reportResult?.recommendation;

  const statCards = [
    { icon: Activity, label: "Active cases", value: liveStats?.active_cases, color: "text-saffron", bg: "bg-saffron/10" },
    { icon: CheckCircle2, label: "Found", value: liveStats?.found_cases, color: "text-emerald", bg: "bg-emerald/10" },
    { icon: Archive, label: "Closed", value: liveStats?.closed_cases, color: "text-charcoal-light", bg: "bg-charcoal/5" },
    { icon: Eye, label: "Cameras", value: liveStats?.cctv_count, color: "text-emerald", bg: "bg-emerald/10" },
    { icon: MapPin, label: "Chokepoints", value: liveStats?.chokepoint_count, color: "text-marigold-dark", bg: "bg-marigold/10" },
    { icon: Shield, label: "Police stations", value: liveStats?.police_count, color: "text-saffron", bg: "bg-saffron/10" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-sm text-charcoal">
      <header className="bg-ink-surface text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron/15 transition-colors group-hover:bg-saffron/25">
              <Image src="/icon-192.png" alt="Kumbh Milaap" width={20} height={20} className="rounded-sm" />
            </div>
            <div className="flex items-baseline gap-2 leading-tight">
              <span className="text-sm font-bold tracking-tight text-white">Kumbh Milaap</span>
              <span className="text-xs text-white/50">Admin dashboard</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {liveStats ? (
              <>
                <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2.5 text-xs font-medium text-white/80">
                  <Users className="mr-1.5 h-3 w-3" /> Active {liveStats.active_cases}
                </Badge>
                <Badge variant="outline" className="hidden rounded-full border-white/10 bg-white/5 px-2.5 text-xs font-medium text-white/80 sm:inline-flex">
                  Total {liveStats.total_cases}
                </Badge>
                <Badge variant="outline" className="rounded-full border-emerald/25 bg-emerald/15 px-2.5 text-xs font-medium text-emerald-light">
                  <Radio className="mr-1.5 h-3 w-3" /> Live
                </Badge>
              </>
            ) : statsError ? (
              <Badge variant="outline" className="rounded-full border-terracotta/30 bg-terracotta/15 px-2.5 text-xs font-medium text-white/80">
                <WifiOff className="mr-1.5 h-3 w-3" /> Backend offline
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2.5 text-xs text-white/60">
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Connecting
              </Badge>
            )}
            <ThemeToggle className="border-white/10 text-white/60 hover:bg-white/10 hover:text-white" />
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 w-full max-w-7xl px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-charcoal-light/60 transition-colors hover:text-saffron">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to kiosk
        </Link>
      </div>

      <section aria-label="Live statistics" className="mx-auto mt-4 w-full max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {statCards.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-beige/50 bg-white p-3.5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold leading-none text-charcoal">
                  {s.value !== undefined ? s.value : statsError ? "-" : <Loader2 className="h-4 w-4 animate-spin text-saffron" />}
                </div>
                <div className="mt-1 truncate text-xs text-charcoal-light/60">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <main className="mx-auto mt-5 grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-6 pb-14 lg:grid-cols-12 lg:px-8">
        <div className="space-y-5 lg:col-span-4">
          <div className="overflow-hidden rounded-2xl border border-beige/50 bg-white">
            <div className="border-b border-beige/40 px-5 py-4">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-saffron" />
                <h2 className="text-base font-semibold text-charcoal">Report a missing person</h2>
              </div>
              <p className="text-xs text-charcoal-light/60">Enter the details to get a search recommendation right away.</p>
            </div>

            <form ref={formRef} onSubmit={handleSubmit}>
              <div className="space-y-3.5 px-5 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-charcoal-light">Full name</Label>
                  <Input id="name" name="name" placeholder="e.g. Ramesh Kumar" required autoComplete="off" className={INPUT_CLASS} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="age" className="text-xs font-semibold text-charcoal-light">Age</Label>
                    <Input id="age" name="age" type="number" min={0} max={120} placeholder="e.g. 68" required className={INPUT_CLASS} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-xs font-semibold text-charcoal-light">Gender</Label>
                    <Select name="gender" required>
                      <SelectTrigger id="gender" className="h-9 rounded-lg border-beige/50 bg-ivory/60 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="clothing" className="text-xs font-semibold text-charcoal-light">Clothing and appearance</Label>
                  <Input id="clothing" name="clothing" placeholder="e.g. Blue kurta, white pyjama" required className={INPUT_CLASS} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="zone" className="text-xs font-semibold text-charcoal-light">Last known zone</Label>
                  <Select name="zone" required>
                    <SelectTrigger id="zone" className="h-9 rounded-lg border-beige/50 bg-ivory/60 text-sm">
                      <SelectValue placeholder="Select an area" />
                    </SelectTrigger>
                    <SelectContent>
                      {ZONES.map((z) => (
                        <SelectItem key={z.id} value={z.id}>{z.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="minutes" className="text-xs font-semibold text-charcoal-light">Last seen</Label>
                    <Select name="minutes" defaultValue="30">
                      <SelectTrigger id="minutes" className="h-9 rounded-lg border-beige/50 bg-ivory/60 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MINUTES_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold text-charcoal-light">
                      Contact <span className="font-normal text-charcoal-light/50">(optional)</span>
                    </Label>
                    <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="98765 43210" className={INPUT_CLASS} />
                  </div>
                </div>
              </div>

              <div className="border-t border-beige/40 bg-ivory/50 px-5 py-3.5">
                <Button type="submit" disabled={loading} className="h-9 w-full rounded-full bg-saffron text-sm font-semibold text-white shadow-sm shadow-saffron/10 hover:bg-saffron-dark">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analysing the area
                    </>
                  ) : (
                    "Get search recommendation"
                  )}
                </Button>
              </div>
            </form>
          </div>

          {reportResult && rec && (
            <div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-2xl border border-saffron/20 bg-white duration-500" aria-live="polite">
              <div className={`h-1 w-full ${offline ? "bg-marigold-dark" : "bg-saffron"}`} />
              <div className="border-b border-saffron/10 bg-saffron/[0.04] px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      {offline ? <WifiOff className="h-4 w-4 text-marigold-dark" /> : <Shield className="h-4 w-4 text-saffron" />}
                      <h3 className="text-base font-semibold text-charcoal">
                        {offline ? "Saved offline" : "Search plan ready"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={copyCaseId}
                      className="inline-flex items-center gap-1.5 rounded font-mono text-xs text-charcoal-light/60 transition-colors hover:text-charcoal"
                      aria-label="Copy case ID"
                    >
                      {reportResult.case_id}
                      {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <Badge className="shrink-0 rounded-full border-0 bg-saffron px-2.5 text-xs font-semibold capitalize text-white">
                    {rec.priority_level}
                  </Badge>
                </div>
              </div>

              <dl className="grid grid-cols-3 divide-x divide-beige/40 border-b border-beige/40 text-center">
                <div className="px-2 py-3">
                  <dd className="text-base font-bold text-charcoal">{rec.nearby_cctv?.length ?? 0}</dd>
                  <dt className="text-xs text-charcoal-light/60">Cameras</dt>
                </div>
                <div className="px-2 py-3">
                  <dd className="text-base font-bold text-charcoal">{rec.nearby_chokepoints?.length ?? 0}</dd>
                  <dt className="text-xs text-charcoal-light/60">Chokepoints</dt>
                </div>
                <div className="px-2 py-3">
                  <dd className="text-base font-bold text-charcoal">{rec.search_radius_m} m</dd>
                  <dt className="text-xs text-charcoal-light/60">Radius</dt>
                </div>
              </dl>

              {rec.nearest_police && !offline && (
                <div className="flex items-center gap-2.5 border-b border-beige/40 px-5 py-3 text-xs text-charcoal-light">
                  <Shield className="h-3.5 w-3.5 shrink-0 text-saffron" />
                  <span className="min-w-0 flex-1 truncate">
                    Alert <span className="font-semibold text-charcoal">{rec.nearest_police.name}</span>
                  </span>
                  <span className="shrink-0 text-charcoal-light/60">{Math.round(rec.nearest_police.distance_m)} m</span>
                </div>
              )}

              <div className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-charcoal-light/80">
                {rec.ai_summary}
              </div>

              <div className="flex gap-2 border-t border-beige/40 bg-ivory/50 px-5 py-3.5">
                <Button variant="outline" onClick={() => window.print()} className="h-9 flex-1 rounded-lg border-beige/50 text-sm text-charcoal-light">
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                </Button>
                <Button
                  onClick={() => setDispatched(true)}
                  disabled={dispatched || offline}
                  className="h-9 flex-1 rounded-full bg-saffron text-sm font-semibold text-white hover:bg-saffron-dark disabled:opacity-70"
                >
                  {dispatched ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Teams dispatched
                    </>
                  ) : (
                    <>
                      <Siren className="mr-1.5 h-3.5 w-3.5" /> Dispatch teams
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-beige/50 bg-white">
            <div className="flex items-center justify-between gap-4 border-b border-beige/40 bg-ivory/50 px-5 py-3.5">
              <div>
                <div className="mb-0.5 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-saffron" />
                  <h3 className="text-base font-semibold text-charcoal">Live geographic triage</h3>
                </div>
                <p className="text-xs text-charcoal-light/60">Cameras, chokepoints and police stations for Kumbh Mela 2027</p>
              </div>
              {rec && (
                <Badge variant="secondary" className="shrink-0 rounded-full border-saffron/15 bg-saffron/10 px-2.5 text-xs text-saffron-dark">
                  Radius {rec.search_radius_m} m
                </Badge>
              )}
            </div>
            <div className="relative z-0">
              <Map
                height={480}
                lastSeen={reportResult && mapCoords ? mapCoords : undefined}
                searchRadius={rec?.search_radius_m}
                cctv={rec?.nearby_cctv}
                police={rec?.nearest_police}
                chokepoints={rec?.nearby_chokepoints}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-beige/50 bg-white">
            <div className="flex flex-col gap-3 border-b border-beige/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-charcoal">Recent cases</h3>
                <p className="text-xs text-charcoal-light/60">Updates every 10 seconds</p>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-light/50" />
                <label htmlFor="case-filter" className="sr-only">Filter cases</label>
                <Input
                  id="case-filter"
                  value={caseFilter}
                  onChange={(e) => setCaseFilter(e.target.value)}
                  placeholder="Filter by name or ID"
                  className={`${INPUT_CLASS} pl-8`}
                />
              </div>
            </div>

            {filteredCases.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-charcoal-light/60">
                {cases.length === 0 ? "No cases yet. Submit a report to see it here." : "No cases match that filter."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-beige/40 text-xs text-charcoal-light/60">
                      <th scope="col" className="px-5 py-2.5 font-medium">Case ID</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Name</th>
                      <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Last seen</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-beige/30">
                    {filteredCases.map((c) => (
                      <tr key={c.case_id} className="transition-colors hover:bg-ivory/60">
                        <td className="px-5 py-2.5 font-mono text-xs text-charcoal-light">{c.case_id}</td>
                        <td className="px-3 py-2.5 font-medium text-charcoal">
                          {c.person?.name ?? "Unknown"}
                          {c.person?.age ? <span className="ml-1.5 font-normal text-charcoal-light/60">{c.person.age}</span> : null}
                        </td>
                        <td className="hidden px-3 py-2.5 text-charcoal-light md:table-cell">{c.last_seen?.landmark ?? "Unknown"}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status] ?? STATUS_STYLES.closed}`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="relative mt-auto bg-ink-surface text-white/60">
        <TempleSkyline className="absolute bottom-full left-0 right-0 h-12 md:h-16" />
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 text-xs md:flex-row">
            <div className="flex items-center gap-2.5">
              <Image src="/icon-192.png" alt="Kumbh Milaap" width={16} height={16} className="rounded-sm opacity-70" />
              <span className="font-semibold text-white/80">Kumbh Milaap</span>
              <span className="text-white/50">Reuniting families, one connection at a time.</span>
            </div>
            <p className="text-white/50">AI-powered missing person search for Kumbh Mela 2027</p>
          </div>
        </div>
      </footer>
    </div>
  );
}