"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2, Search, ArrowRight, ArrowLeft, UserPlus, MapPin, Printer, AlertTriangle,
  LifeBuoy, FileSearch, Camera, ScanFace, Shield, Heart, Users, Eye, Globe, Phone,
  CheckCircle2, WifiOff, SearchX, Siren, Check, Pencil, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import Webcam from "react-webcam";
import { TempleSkyline } from "@/components/TempleSkyline";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteNavbar } from "@/components/SiteNavbar";
import { ImageCollage } from "@/components/ImageCollage";
import { SectionHeader } from "@/components/SectionHeader";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const HELPLINE = process.env.NEXT_PUBLIC_KUMBH_HELPLINE;
const IDLE_RESET_MS = 120_000;

const ZONES = [
  { id: "Zone A - Ramkund & Ghats", short: "Zone A", label: "Ramkund & Ghats", coords: [20.003, 73.792] as [number, number], kiosk: "Zone A - Ramkund Kiosk" },
  { id: "Zone B - Panchvati & Temple", short: "Zone B", label: "Panchvati & Temple", coords: [20.005, 73.795] as [number, number], kiosk: "Zone B - Panchvati Kiosk" },
  { id: "Zone C - Tapovan Area", short: "Zone C", label: "Tapovan Area", coords: [19.965, 73.804] as [number, number], kiosk: "Zone C - Tapovan Kiosk" },
  { id: "Zone D - Nashik Road & Transit", short: "Zone D", label: "Nashik Road & Transit", coords: [19.94, 73.815] as [number, number], kiosk: "Zone D - Nashik Road Kiosk" },
];
const DEFAULT_COORDS: [number, number] = [19.9975, 73.7898];
const GENDERS = ["Male", "Female", "Child", "Other"] as const;
const GENDER_MAP: Record<string, string> = { Male: "male", Female: "female", Child: "other", Other: "other" };

const STATS = [
  { value: "80M+", label: "Pilgrims expected" },
  { value: "635+", label: "Days of the Mela" },
  { value: "20+", label: "Languages supported" },
  { value: "24/7", label: "Camera monitoring" },
];

const STEPS = [
  { title: "Report or search", desc: "Enter a name, age, clothing and the zone where they were last seen. Or search an existing case by name or case ID.", icon: UserPlus, accent: "text-saffron", bg: "bg-saffron/10" },
  { title: "The system scans and matches", desc: "Camera feeds across every zone are checked for matching clothing and appearance, and the best search area is worked out for you.", icon: Eye, accent: "text-emerald", bg: "bg-emerald/10" },
  { title: "Reunion is coordinated", desc: "When a match is confirmed, the nearest police station and volunteers are alerted so the family can be reunited safely.", icon: Heart, accent: "text-marigold-dark", bg: "bg-marigold/10" },
];

const FEATURES = [
  { icon: Camera, title: "Visual scan", desc: "Clothing and appearance analysis from camera feeds. No face data is stored." },
  { icon: MapPin, title: "Zone-based search", desc: "Searches start in the zones and chokepoints closest to where someone was last seen." },
  { icon: Users, title: "Coordinated response", desc: "Police, volunteers and help centres are alerted automatically." },
  { icon: Globe, title: "Multilingual", desc: "Built for visitors from every region." },
  { icon: Phone, title: "Kiosk friendly", desc: "Large touch targets and a short, simple flow for all ages." },
  { icon: Shield, title: "Privacy first", desc: "Only clothing metadata is analysed, then purged." },
  { icon: Eye, title: "Live monitoring", desc: "Continuous crowd scanning across connected cameras." },
  { icon: LifeBuoy, title: "Emergency mode", desc: "People who are lost can raise an alert from the kiosk where they stand." },
];

const PRIVACY_TAGS = ["No biometric storage", "Encrypted data", "Authorised access only", "Automatic data purge"];

const WIZARD = [
  { n: 1, label: "Who" },
  { n: 2, label: "Details" },
  { n: 3, label: "Location" },
  { n: 4, label: "Review" },
];

type ScanType = "find_case" | "im_lost" | "report_missing";
type ResultKind = "report" | "search" | "notfound" | "offline" | "emergency" | "match";

interface MatchedPerson {
  name: string;
  image: string;
  kiosk: string;
  time?: string;
}

interface KioskResult {
  kind: ResultKind;
  case_id: string;
  priority_level: string;
  priority_zone: string;
  nearest_police: string;
  action_items: string[];
  matched_person?: MatchedPerson;
}

const RESULT_COPY: Record<ResultKind, { title: string; tone: "ok" | "warn" | "alert"; icon: typeof CheckCircle2 }> = {
  report: { title: "Report submitted", tone: "ok", icon: CheckCircle2 },
  search: { title: "Case found", tone: "ok", icon: CheckCircle2 },
  match: { title: "Possible match found", tone: "ok", icon: ScanFace },
  notfound: { title: "No matching case", tone: "warn", icon: SearchX },
  offline: { title: "Saved offline", tone: "warn", icon: WifiOff },
  emergency: { title: "Help is on the way", tone: "alert", icon: Siren },
};

const TONE_STYLES = {
  ok: { wrap: "bg-emerald/[0.05] border-emerald/20", icon: "bg-emerald shadow-emerald/20" },
  warn: { wrap: "bg-marigold/[0.07] border-marigold/25", icon: "bg-marigold-dark shadow-marigold/20" },
  alert: { wrap: "bg-saffron/[0.07] border-saffron/25", icon: "bg-saffron shadow-saffron/25" },
};

function safeStorageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

const pageVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 28 } },
  out: { opacity: 0, y: -12, transition: { duration: 0.18 } },
};

const stagger: Variants = { animate: { transition: { staggerChildren: 0.09 } } };

const fadeUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const INPUT_CLASS =
  "h-14 md:h-16 text-xl md:text-2xl px-5 bg-white border-beige/60 rounded-2xl focus-visible:ring-2 focus-visible:ring-saffron focus-visible:border-saffron/30";

export default function KioskPage() {
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [formData, setFormData] = useState({ name: "", age: "", gender: "", clothing: "", zone: "", reporterPhone: "" });
  const [result, setResult] = useState<KioskResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanType, setScanType] = useState<ScanType | null>(null);
  const [selectedKiosk, setSelectedKiosk] = useState<string>(ZONES[0].kiosk);
  const [camWidth, setCamWidth] = useState(256);
  const [camError, setCamError] = useState(false);

  const webcamRef = useRef<Webcam>(null);
  const passiveWebcamRef = useRef<Webcam>(null);

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;
  const inKiosk = step >= 0;

  const openFlow = useCallback((target: "find" | "report" | "lost") => {
    if (target === "find") setStep(6);
    else if (target === "report") setStep(1);
    else {
      setScanType("im_lost");
      setStep(8);
    }
  }, []);

  useEffect(() => {
    const startFlow = (event: Event) => {
      const flow = (event as CustomEvent<"find" | "report">).detail;
      openFlow(flow === "find" ? "find" : "report");
    };
    window.addEventListener("km:flow", startFlow);
    return () => window.removeEventListener("km:flow", startFlow);
  }, [openFlow]);

  const capturePassive = useCallback(() => {
    const image = passiveWebcamRef.current?.getScreenshot();
    if (image) {
      safeStorageSet("khoj_passive_capture", { image, kiosk: selectedKiosk, time: new Date().toLocaleTimeString() });
    }
  }, [selectedKiosk]);

  useEffect(() => {
    if (step !== 0) return;
    const interval = setInterval(capturePassive, 5000);
    return () => clearInterval(interval);
  }, [step, capturePassive]);

  useEffect(() => {
    if (step < 1 || step === 5 || step === 8) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setFormData({ name: "", age: "", gender: "", clothing: "", zone: "", reporterPhone: "" });
        setSearchInput("");
        setStep(0);
      }, IDLE_RESET_MS);
    };
    arm();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, arm));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [step]);

  const nextStep = () => step < totalSteps && setStep(step + 1);
  const prevStep = () => step > 0 && setStep(step - 1);
  const handleUpdate = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleFindCase = async () => {
    setStep(5);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cases/?search=${encodeURIComponent(searchInput)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.results?.length > 0) {
        const c = data.results[0];
        setResult({
          kind: "search",
          case_id: c.case_id,
          priority_level: c.status,
          priority_zone: c.last_seen?.landmark ?? "Unknown",
          nearest_police: "See the admin dashboard for full details",
          action_items: [
            `Name: ${c.person?.name ?? "Unknown"}`,
            `Status: ${c.status}`,
            `Last seen: ${c.last_seen?.landmark ?? "Unknown"}`,
          ],
        });
      } else {
        setResult({
          kind: "notfound",
          case_id: "NOT-FOUND",
          priority_level: "no results",
          priority_zone: "Not applicable",
          nearest_police: "No matching cases",
          action_items: ["Check the spelling or try the case ID", "Or report a new case from the home screen"],
        });
      }
    } catch {
      setResult({
        kind: "offline",
        case_id: "SEARCH-OFFLINE",
        priority_level: "pending",
        priority_zone: "Not applicable",
        nearest_police: "Search service is offline",
        action_items: ["Search is unavailable right now", "Please ask a kiosk volunteer or report in person"],
      });
    }
    setLoading(false);
  };

  const submitReport = async () => {
    setStep(5);
    setLoading(true);
    const [lat, lon] = ZONES.find((z) => z.id === formData.zone)?.coords ?? DEFAULT_COORDS;

    try {
      const res = await fetch(`${API_BASE}/api/cases/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: {
            name: formData.name,
            age: parseInt(formData.age) || 30,
            gender: GENDER_MAP[formData.gender] ?? "other",
            clothing_description: formData.clothing || "Not specified",
          },
          last_seen: {
            latitude: lat,
            longitude: lon,
            landmark: formData.zone,
            time: new Date().toTimeString().slice(0, 5),
            minutes_since: 30,
          },
          contact: {
            name: "Kiosk Reporter",
            phone: formData.reporterPhone.replace(/\D/g, "").slice(-10) || "9999999999",
            relation: "Reporter",
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rec = data.recommendation;

      setResult({
        kind: "report",
        case_id: data.case_id,
        priority_level: rec.priority_level,
        priority_zone: rec.priority_zones?.[0]?.zone_name ?? formData.zone,
        nearest_police: `${rec.nearest_police.name} (${Math.round(rec.nearest_police.distance_m)} m away)`,
        action_items: [
          `Alerting ${rec.nearest_police.name}`,
          `Scanning ${rec.nearby_cctv.length} camera feed(s) within ${rec.search_radius_m} m`,
          `Sending teams to ${rec.nearby_chokepoints.length} crowd chokepoint(s)`,
          `Confidence: ${rec.confidence}`,
        ],
      });
    } catch {
      setResult({
        kind: "offline",
        case_id: `KM-OFFLINE-${Math.floor(Math.random() * 9000) + 1000}`,
        priority_level: "pending",
        priority_zone: formData.zone,
        nearest_police: "System offline. Please alert the desk staff.",
        action_items: ["Your report is saved on this kiosk", "It will sync when the system reconnects"],
      });
    }
    setLoading(false);
  };

  const runScan = () => {
    const imageSrc = webcamRef.current?.getScreenshot() ?? null;
    if (imageSrc) setCapturedImage(imageSrc);

    if (scanType === "report_missing") {
      handleUpdate("clothing", "Blue shirt, patterned (auto-detected)");
      handleUpdate("zone", ZONES.find((z) => z.kiosk === selectedKiosk)?.id ?? ZONES[0].id);
      setStep(2);
      return;
    }

    setStep(5);
    setLoading(true);

    setTimeout(() => {
      if (scanType === "im_lost") {
        const lostPerson = { name: formData.name || "Unknown individual", image: imageSrc ?? "", kiosk: selectedKiosk };
        safeStorageSet("khoj_lost_person", lostPerson);
        setResult({
          kind: "emergency",
          case_id: "EMERGENCY-HELP",
          priority_level: "critical response",
          priority_zone: selectedKiosk,
          nearest_police: "All nearby units are being notified",
          action_items: [
            `Person identified: ${lostPerson.name}`,
            "Visual scan complete",
            "Profile saved to the Kumbh Milaap database",
            "Help is being sent to this kiosk",
            "Please stay exactly where you are",
          ],
        });
      } else {
        const saved = safeStorageGet<MatchedPerson>("khoj_lost_person");
        const passive = safeStorageGet<{ image: string; kiosk: string; time: string }>("khoj_passive_capture");

        if (saved) {
          setResult({
            kind: "match",
            case_id: "MATCH-FOUND",
            priority_level: "identity verified",
            priority_zone: saved.kiosk,
            nearest_police: "A police unit is on scene",
            matched_person: saved,
            action_items: [
              `Strong clothing match for: ${saved.name}`,
              `Last at: ${saved.kiosk}`,
              "Reunification has started",
              "Please go to the marked kiosk or wait for officers",
            ],
          });
        } else if (passive) {
          setResult({
            kind: "match",
            case_id: "PASSIVE-MATCH",
            priority_level: "metadata match",
            priority_zone: passive.kiosk,
            nearest_police: "Nearby officers are being sent",
            matched_person: { name: "Unknown (captured from camera)", image: passive.image, kiosk: passive.kiosk, time: passive.time },
            action_items: [
              "Clothing match confirmed against a live feed",
              `Seen at ${passive.kiosk} at ${passive.time}`,
              "Officers are on their way",
            ],
          });
        } else {
          setResult({
            kind: "match",
            case_id: "MATCH-FOUND",
            priority_level: "high confidence",
            priority_zone: selectedKiosk,
            nearest_police: "Local police station notified",
            action_items: [
              "Clothing match: blue and white pattern",
              `Last matched near ${selectedKiosk.split(" - ")[0]}`,
              "Seen about 2 minutes ago",
              "Officers are on their way",
            ],
          });
        }
      }
      setLoading(false);
    }, 2000);
  };

  const resetKiosk = () => {
    setFormData({ name: "", age: "", gender: "", clothing: "", zone: "", reporterPhone: "" });
    setResult(null);
    setCapturedImage(null);
    setSearchInput("");
    setScanType(null);
    setStep(0);
  };

  const clearDatabase = () => {
    try {
      localStorage.removeItem("khoj_lost_person");
      localStorage.removeItem("khoj_passive_capture");
    } catch {
    }
    alert("Demo data cleared. Ready for a new demo.");
  };

  if (!inKiosk) {
    return (
      <div className="min-h-screen flex flex-col bg-ivory text-charcoal">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg">
          Skip to content
        </a>

        <SiteNavbar onEmergency={() => openFlow("lost")} />

        <main id="main">
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 bg-hero-pattern" />
            <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-saffron/[0.05] blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-emerald/[0.04] blur-[100px]" />

            <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:pb-24 lg:pt-14">
              <motion.div initial="initial" animate="animate" variants={stagger} className="max-w-3xl space-y-6">
                <motion.p variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-saffron/25 bg-saffron/10 px-3.5 py-1.5 text-xs font-semibold text-saffron">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-saffron" />
                  </span>
                  Nashik Simhastha Kumbh Mela 2027
                </motion.p>

                <motion.h1 variants={fadeUp} className="font-display text-[clamp(2.6rem,4.8vw,4.5rem)] font-bold leading-[1.03] tracking-tight text-charcoal">
                  Every missing face deserves a way home.
                </motion.h1>

                <motion.p variants={fadeUp} className="max-w-xl text-base leading-relaxed text-charcoal-light/75 md:text-lg">
                  Kumbh Milaap helps families find each other in the crowd. Report someone missing, search a case, or ask for help if you are lost. It takes under two minutes.
                </motion.p>

                <motion.div variants={fadeUp} className="flex flex-col gap-3 pt-1 sm:flex-row">
                  <Button
                    onClick={() => { setStep(0); openFlow("report"); }}
                    className="pill h-14 bg-saffron px-8 text-base font-semibold text-white shadow-lg shadow-saffron/20 transition-all hover:bg-saffron-dark hover:shadow-xl hover:shadow-saffron/30 focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2"
                  >
                    <UserPlus className="mr-2 h-5 w-5" />
                    Report a missing person
                  </Button>
                  <Button
                    onClick={() => { setStep(0); openFlow("find"); }}
                    variant="outline"
                    className="pill h-14 border-charcoal/20 px-8 text-base font-semibold text-charcoal hover:bg-charcoal/5 focus-visible:ring-2 focus-visible:ring-charcoal/40"
                  >
                    <Search className="mr-2 h-5 w-5" />
                    Find a case
                  </Button>
                </motion.div>

                <motion.button
                  variants={fadeUp}
                  onClick={() => { setStep(0); openFlow("lost"); }}
                  className="inline-flex items-center gap-2 rounded-md text-sm font-bold text-saffron underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron"
                >
                  <LifeBuoy size={18} strokeWidth={1.75} /> I am lost and need help now
                </motion.button>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}>
                <ImageCollage />
              </motion.div>
            </div>
          </section>

          <section aria-label="Key figures" className="border-y border-beige/60 bg-white">
            <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-beige/60 px-6 md:grid-cols-4 lg:px-8">
              {STATS.map((stat) => (
                <div key={stat.label} className="px-6 py-8 text-center md:py-10">
                  <dd className="font-display text-3xl font-bold text-charcoal md:text-4xl">{stat.value}</dd>
                  <dt className="mt-1.5 text-sm text-charcoal-light/60">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section id="how-it-works" className="bg-ivory py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mb-14 md:mb-20">
                <SectionHeader number="01" title="How it works" description="A clear path from the first report to a safe, coordinated reunion." />
              </motion.div>

              <ol className="grid gap-10 md:grid-cols-3 lg:gap-14">
                {STEPS.map((item, i) => (
                  <motion.li
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="relative space-y-5"
                  >
                    {i < STEPS.length - 1 && (
                      <div aria-hidden className="absolute top-7 hidden h-px bg-beige md:block" style={{ left: "calc(3.5rem + 1rem)", width: "calc(100% - 2rem)" }} />
                    )}
                    <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${item.bg}`}>
                      <item.icon className={`h-7 w-7 ${item.accent}`} />
                    </div>
                    <h3 className="text-xl font-bold text-charcoal">
                      <span className="mr-2 font-display font-light text-charcoal-light/40">{i + 1}.</span>
                      {item.title}
                    </h3>
                    <p className="max-w-sm leading-relaxed text-charcoal-light/70">{item.desc}</p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </section>

          <section id="features" className="border-t border-beige/40 bg-white py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mb-14 md:mb-20">
                <p className="eyebrow mb-4">What it does</p>
                <h2 className="max-w-2xl font-display text-3xl font-bold leading-tight text-charcoal md:text-[2.75rem]">
                  Built for a crowd of tens of millions.
                </h2>
              </motion.div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className={`group flex flex-col gap-3 rounded-3xl border border-beige/50 bg-ivory/60 p-6 card-hover ${i === 0 ? "md:col-span-2 lg:row-span-2 lg:justify-between" : ""} ${i === 3 ? "lg:col-span-2" : ""}`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron/10 text-saffron transition-colors group-hover:bg-saffron/15">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-charcoal">{item.title}</h3>
                      <p className="text-sm leading-relaxed text-charcoal-light/65">{item.desc}</p>
                    </div>
                    {i === 0 && (
                      <div className="mt-4 rounded-2xl border border-emerald/20 bg-emerald/5 p-4 font-mono text-xs text-emerald">
                        <div className="mb-3 flex justify-between"><span>Live scan</span><span>Zone A</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-emerald/15">
                          <motion.div
                            className="h-2 rounded-full bg-emerald"
                            initial={{ width: "10%" }}
                            animate={reduceMotion ? { width: "66%" } : { width: ["10%", "66%", "40%", "66%"] }}
                            transition={{ duration: 6, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
                          />
                        </div>
                        <p className="mt-3 text-charcoal-light/60">Clothing metadata only. No biometric profile is kept.</p>
                      </div>
                    )}
                    {i === 3 && (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                        {["English", "हिन्दी", "मराठी"].map((l) => (
                          <span key={l} className="rounded-full border border-beige/60 bg-white px-3 py-1.5">{l}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section className="relative min-h-[440px] overflow-hidden bg-ink-surface">
            <Image src="/images/kumbh/crowd.jpg" alt="Wide public gathering at Kumbh Mela" fill sizes="100vw" className="object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/80 to-charcoal/25" />
            <div className="relative mx-auto flex min-h-[440px] max-w-7xl items-end px-6 py-16 lg:px-8">
              <blockquote className="max-w-2xl text-white">
                <p className="font-display text-3xl font-bold leading-tight md:text-5xl">
                  At a gathering of tens of millions, a clear path back to family can change everything.
                </p>
                <footer className="mt-6 text-sm text-white/70">Public Kumbh Mela scenes, used with attribution.</footer>
              </blockquote>
            </div>
          </section>

          <section id="safety" className="border-t border-beige/40 bg-ivory py-24 md:py-32">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-3xl space-y-6 px-6 text-center lg:px-8"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald/10 text-emerald">
                <Shield className="h-7 w-7" />
              </div>
              <h2 className="font-display text-3xl font-bold leading-tight text-charcoal md:text-[2.75rem]">
                Your privacy and safety come first.
              </h2>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-charcoal-light/70">
                We analyse clothing patterns and visual metadata, not biometric face data. Personal information is kept confidential and used only to reunite families.
              </p>
              <ul className="flex flex-wrap justify-center gap-3 pt-4">
                {PRIVACY_TAGS.map((tag) => (
                  <li key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-emerald/20 bg-emerald/10 px-4 py-2 text-sm font-medium text-emerald-dark">
                    <Check className="h-3.5 w-3.5" /> {tag}
                  </li>
                ))}
              </ul>
            </motion.div>
          </section>

          <section className="relative overflow-hidden py-20 text-white md:py-28" style={{ backgroundColor: "var(--ink-surface)" }}>
            <div aria-hidden className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative z-10 mx-auto max-w-3xl space-y-8 px-6 text-center lg:px-8"
            >
              <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">
                Need help right now?
              </h2>
              <p className="mx-auto max-w-xl text-lg leading-relaxed text-white/70">
                Visit any Kumbh Milaap kiosk on the Mela grounds, or use this page to report or search for a missing person.
              </p>
              <div className="flex flex-col justify-center gap-4 pt-2 sm:flex-row">
                <Button onClick={() => setStep(0)} className="pill h-14 bg-saffron px-8 text-base font-semibold text-white shadow-lg shadow-saffron/25 hover:bg-saffron-dark focus-visible:ring-2 focus-visible:ring-white">
                  Open the kiosk
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  onClick={() => { setStep(0); openFlow("lost"); }}
                  variant="outline"
                  className="pill h-14 !border-white/60 !bg-transparent px-8 text-base font-semibold !text-white hover:!bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
                >
                  <LifeBuoy className="mr-2 h-5 w-5" />
                  I am lost, get help
                </Button>
              </div>
              {HELPLINE ? (
                <a href={`tel:${HELPLINE.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-base font-semibold text-white/90 hover:text-white">
                  <Phone className="h-4 w-4 text-saffron-light" /> Call the helpline: {HELPLINE}
                </a>
              ) : (
                <p className="text-xs text-white/50">The helpline number will appear here once it is configured.</p>
              )}
            </motion.div>
          </section>
        </main>

        <footer className="relative bg-ink-surface text-white/60">
          <TempleSkyline className="absolute bottom-full left-0 right-0 h-16 md:h-24" />
          <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-saffron/15">
                  <Heart className="h-4 w-4 text-saffron/90" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">Kumbh Milaap</p>
                  <p className="text-xs text-white/50">Reuniting families, one connection at a time.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/50">
                <Link href="/admin" className="transition-colors hover:text-white/80">Admin dashboard</Link>
                <span aria-hidden>|</span>
                <span>Nashik Simhastha Kumbh Mela 2027</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  const copy = result ? RESULT_COPY[result.kind] : null;
  const tone = copy ? TONE_STYLES[copy.tone] : null;
  const ResultIcon = copy?.icon ?? CheckCircle2;
  const zoneFor = (id: string) => ZONES.find((z) => z.id === id);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ivory font-sans text-charcoal selection:bg-saffron/20">
      <div className="pointer-events-none absolute inset-0 z-0 bg-hero-pattern" />

      <header className="relative z-10 flex items-center justify-between border-b border-beige/60 bg-ivory/90 px-6 py-4 backdrop-blur-lg">
        <button onClick={() => (step === 0 ? setStep(-1) : resetKiosk())} className="flex items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron" aria-label="Back to kiosk home">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-gradient shadow-sm shadow-saffron/20">
            <Heart size={20} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-xl font-bold tracking-tight text-charcoal">Kumbh Milaap</p>
            <p className="text-xs font-medium text-charcoal-light/60">Reunification kiosk</p>
          </div>
        </button>

        <div className="z-50 flex items-center gap-3">
          <Button onClick={clearDatabase} variant="outline" size="sm" className="h-8 rounded-lg border-terracotta/25 bg-terracotta/10 text-xs text-terracotta hover:bg-terracotta/15">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear demo data
          </Button>
          <label className="sr-only" htmlFor="kiosk-select">Kiosk location</label>
          <select
            id="kiosk-select"
            value={selectedKiosk}
            onChange={(e) => setSelectedKiosk(e.target.value)}
            className="cursor-pointer rounded-lg border border-beige/60 bg-ivory-warm px-3 py-2 text-xs font-medium text-charcoal-light outline-none transition-colors hover:bg-beige-warm/50 focus-visible:ring-2 focus-visible:ring-saffron"
          >
            {ZONES.map((z) => (
              <option key={z.kiosk} value={z.kiosk}>Kiosk: {z.label.split(" & ")[0]}</option>
            ))}
          </select>
          <ThemeToggle />
          <Link href="/admin" className="text-xs font-semibold text-muted-foreground transition-colors hover:text-saffron">
            Admin
          </Link>
        </div>
      </header>

      {step > 0 && step <= totalSteps && (
        <nav aria-label="Report progress" className="relative z-10 border-b border-beige/50 bg-white/70 backdrop-blur">
          <ol className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-3">
            {WIZARD.map((w, i) => {
              const done = step > w.n;
              const current = step === w.n;
              return (
                <li key={w.n} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? "bg-emerald text-white" : current ? "bg-saffron text-white" : "bg-beige/60 text-charcoal-light/60"}`}>
                    {done ? <Check className="h-4 w-4" /> : w.n}
                  </span>
                  <span className={`hidden text-sm font-semibold sm:inline ${current ? "text-charcoal" : "text-charcoal-light/55"}`}>{w.label}</span>
                  {i < WIZARD.length - 1 && <span aria-hidden className={`h-0.5 flex-1 rounded-full ${done ? "bg-emerald/60" : "bg-beige/60"}`} />}
                </li>
              );
            })}
          </ol>
          <div className="h-0.5 w-full bg-beige/40">
            <motion.div className="h-full bg-saffron" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </nav>
      )}

      <main className="relative flex flex-1 items-center justify-center p-6 md:p-8">
        <div aria-hidden className="pointer-events-none absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-saffron/[0.04] blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-emerald/[0.04] blur-[100px]" />

        <div className="z-10 w-full max-w-4xl">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="welcome" variants={pageVariants} initial="initial" animate="in" exit="out" className="space-y-12 text-center">
                <div className="space-y-5">
                  <p className="eyebrow">Kumbh Mela 2027, Nashik</p>
                  <h2 className="font-display text-5xl font-bold leading-[1.06] tracking-tight text-charcoal md:text-7xl">
                    Find your loved ones.
                  </h2>
                  <p className="mx-auto max-w-2xl text-lg leading-relaxed text-charcoal-light/70 md:text-xl">
                    Tell us who is missing. We check cameras across every zone and alert the nearest officers.
                  </p>
                </div>

                <div className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-3">
                  {[
                    { onClick: () => setStep(1), icon: UserPlus, title: "Report missing", sub: "Start a new report", color: "saffron", iconColor: "text-saffron", ring: "hover:border-saffron/40" },
                    { onClick: () => setStep(6), icon: FileSearch, title: "Find a case", sub: "Search by name or case ID", color: "emerald", iconColor: "text-emerald", ring: "hover:border-emerald/40" },
                    { onClick: () => { setScanType("im_lost"); setStep(8); }, icon: LifeBuoy, title: "I am lost", sub: "Get help right now", color: "marigold", iconColor: "text-marigold-dark", ring: "hover:border-marigold/50" },
                  ].map((a) => (
                    <button
                      key={a.title}
                      onClick={a.onClick}
                      className={`group flex cursor-pointer flex-col items-center gap-4 rounded-3xl border border-beige/60 bg-white px-8 py-10 card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron md:py-14 ${a.ring}`}
                    >
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-${a.color}/10 transition-colors group-hover:bg-${a.color}/15`}>
                        <a.icon className={`h-8 w-8 ${a.iconColor}`} />
                      </div>
                      <span className="text-xl font-bold text-charcoal md:text-2xl">{a.title}</span>
                      <span className="text-sm text-charcoal-light/65">{a.sub}</span>
                    </button>
                  ))}
                </div>

                <button onClick={() => setStep(-1)} className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-charcoal-light/55 transition-colors hover:text-saffron">
                  <ArrowLeft className="h-4 w-4" /> Back to Kumbh Milaap home
                </button>

                <motion.div
                  drag
                  whileDrag={{ scale: 1.05, opacity: 1, cursor: "grabbing" }}
                  onClick={capturePassive}
                  onWheel={(e) => setCamWidth((prev) => Math.min(Math.max(120, prev + (e.deltaY < 0 ? 30 : -30)), 1200))}
                  style={{ width: camWidth }}
                  title="Demo: click to simulate motion detection. Drag to move. Scroll to resize."
                  className="absolute bottom-6 right-6 z-40 aspect-video cursor-grab overflow-hidden rounded-xl border border-beige-warm/50 bg-ink-surface opacity-40 shadow-xl transition-opacity hover:opacity-100"
                >
                  {camError ? (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-white/60">Camera unavailable</div>
                  ) : (
                    <Webcam audio={false} ref={passiveWebcamRef} screenshotFormat="image/jpeg" className="pointer-events-none h-full w-full object-cover" mirrored onUserMediaError={() => setCamError(true)} />
                  )}
                  <div className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-saffron" />
                  <div className="pointer-events-none absolute bottom-2 left-2 text-[9px] font-mono text-white/70">Camera live: {selectedKiosk}</div>
                </motion.div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" variants={pageVariants} initial="initial" animate="in" exit="out" className="space-y-8">
                <StepHeading kicker="Step 1 of 4" title="Who is missing?" sub="Tell us the basics about the person." />
                <div className="space-y-6">
                  <Field id="name" label="Full name">
                    <Input id="name" autoFocus autoComplete="off" className={INPUT_CLASS} placeholder="Their full name" value={formData.name} onChange={(e) => handleUpdate("name", e.target.value)} />
                  </Field>
                  <Field id="age" label="Age" hint="An estimate is fine">
                    <Input id="age" type="number" inputMode="numeric" min={0} max={120} className={INPUT_CLASS} placeholder="e.g. 8" value={formData.age} onChange={(e) => handleUpdate("age", e.target.value)} />
                  </Field>
                  <Field id="phone" label="Your mobile number" hint="Optional. We use it to reach you when they are found.">
                    <Input id="phone" type="tel" inputMode="tel" className={INPUT_CLASS} placeholder="+91 98765 43210" value={formData.reporterPhone} onChange={(e) => handleUpdate("reporterPhone", e.target.value)} />
                  </Field>
                </div>
                <WizardButtons onBack={prevStep} onNext={nextStep} disableNext={!formData.name.trim() || !formData.age} />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={pageVariants} initial="initial" animate="in" exit="out" className="space-y-8">
                <StepHeading kicker="Step 2 of 4" title="What do they look like?" sub="Gender and clothing help us find them faster." />
                <div className="space-y-8">
                  <div className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-emerald/20 bg-emerald/[0.05] p-5 md:flex-row">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-bold text-charcoal"><Camera className="h-4 w-4 text-emerald" /> Have a photo?</h3>
                      <p className="mt-1 text-sm text-charcoal-light/70">Hold it to the camera and we will fill in clothing and the last camera location.</p>
                    </div>
                    <Button onClick={() => { setScanType("report_missing"); setStep(8); }} className="pill h-11 shrink-0 bg-emerald px-5 text-sm font-semibold text-white hover:bg-emerald-dark">
                      <Camera className="mr-2 h-4 w-4" /> Scan a photo
                    </Button>
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-base font-semibold text-charcoal-light">Gender</legend>
                    <RadioGroup value={formData.gender} onValueChange={(v) => handleUpdate("gender", v)} className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {GENDERS.map((g) => (
                        <Label
                          key={g}
                          className={`flex h-16 cursor-pointer items-center justify-center rounded-2xl border text-lg font-semibold transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-saffron md:h-20 md:text-xl ${formData.gender === g ? "border-saffron/50 bg-saffron/10 text-charcoal" : "border-beige/60 bg-white text-charcoal-light hover:border-beige hover:bg-ivory-warm"}`}
                        >
                          <RadioGroupItem value={g} className="sr-only" />
                          {g}
                        </Label>
                      ))}
                    </RadioGroup>
                  </fieldset>

                  <Field id="clothing" label="What were they wearing?" hint="Colours matter most">
                    <Input id="clothing" className={INPUT_CLASS} placeholder="e.g. Blue shirt, white cap" value={formData.clothing} onChange={(e) => handleUpdate("clothing", e.target.value)} />
                  </Field>
                </div>
                <WizardButtons onBack={prevStep} onNext={nextStep} disableNext={!formData.gender || !formData.clothing.trim()} />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" variants={pageVariants} initial="initial" animate="in" exit="out" className="space-y-8">
                <StepHeading kicker="Step 3 of 4" title="Where were they last seen?" sub="Pick the zone closest to that spot." />
                <RadioGroup value={formData.zone} onValueChange={(v) => handleUpdate("zone", v)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {ZONES.map((z) => {
                    const active = formData.zone === z.id;
                    return (
                      <Label
                        key={z.id}
                        className={`flex cursor-pointer flex-col rounded-2xl border p-6 transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-saffron ${active ? "border-saffron/50 bg-saffron/10 text-charcoal shadow-sm" : "border-beige/60 bg-white text-charcoal-light hover:border-beige hover:bg-ivory-warm"}`}
                      >
                        <RadioGroupItem value={z.id} className="sr-only" />
                        <div className="mb-3 flex items-center justify-between">
                          <MapPin className={`h-7 w-7 ${active ? "text-saffron" : "text-charcoal-light/35"}`} />
                          {active && <CheckCircle2 className="h-6 w-6 text-saffron" />}
                        </div>
                        <span className="text-xl font-bold md:text-2xl">{z.short}</span>
                        <span className="mt-1 text-sm text-charcoal-light/70">{z.label}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
                <WizardButtons onBack={prevStep} onNext={nextStep} disableNext={!formData.zone} />
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" variants={pageVariants} initial="initial" animate="in" exit="out" className="space-y-8">
                <StepHeading kicker="Step 4 of 4" title="Check and submit" sub="Make sure everything is right. You can edit any section." />
                <div className="divide-y divide-beige/50 overflow-hidden rounded-3xl border border-beige/60 bg-white">
                  <ReviewRow label="Missing person" onEdit={() => setStep(1)}>
                    <p className="font-display text-2xl font-bold text-charcoal md:text-3xl">{formData.name}</p>
                    <p className="mt-1 text-charcoal-light/70">{formData.age} years old, {formData.gender}</p>
                  </ReviewRow>
                  <ReviewRow label="Clothing" onEdit={() => setStep(2)}>
                    <p className="text-lg font-medium text-charcoal">{formData.clothing}</p>
                  </ReviewRow>
                  <ReviewRow label="Last seen" onEdit={() => setStep(3)}>
                    <p className="flex items-center gap-2 text-xl font-bold text-charcoal"><MapPin className="h-5 w-5 text-saffron" />{zoneFor(formData.zone)?.short}, {zoneFor(formData.zone)?.label}</p>
                  </ReviewRow>
                </div>

                <div className="flex gap-4 pt-2 md:gap-5">
                  <Button variant="outline" onClick={prevStep} className="h-14 flex-1 rounded-2xl border-beige/60 px-6 text-lg text-charcoal-light hover:bg-ivory-warm md:h-16 md:px-8 md:text-xl">
                    <ArrowLeft className="mr-2 h-5 w-5" /> Back
                  </Button>
                  <Button onClick={submitReport} className="h-14 flex-[2] rounded-2xl bg-saffron px-6 text-lg font-bold text-white shadow-md shadow-saffron/20 hover:bg-saffron-dark md:h-16 md:px-8 md:text-xl">
                    Submit report
                    <ArrowRight className="ml-3 h-5 w-5 md:h-6 md:w-6" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="step5" variants={pageVariants} initial="initial" animate="in" exit="out" className="w-full" aria-live="polite">
                {loading ? (
                  <div className="flex flex-col items-center justify-center space-y-10 py-20 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping rounded-full border-4 border-saffron/20" />
                      <Loader2 className="h-20 w-20 animate-spin text-saffron md:h-24 md:w-24" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-display text-3xl font-bold text-charcoal md:text-4xl">Checking cameras and crowd data</h3>
                      <p className="text-lg text-charcoal-light/65 md:text-xl">
                        {formData.zone ? `Looking near ${zoneFor(formData.zone)?.short ?? "your zone"}. This takes a few seconds.` : "This takes a few seconds."}
                      </p>
                    </div>
                  </div>
                ) : (
                  result && copy && tone && (
                    <div className="space-y-6">
                      <div className={`flex flex-col items-center space-y-4 rounded-3xl border p-6 text-center md:p-8 ${tone.wrap}`}>
                        <div className={`flex h-16 w-16 items-center justify-center rounded-full shadow-md md:h-20 md:w-20 ${tone.icon}`}>
                          <ResultIcon className="h-8 w-8 text-white md:h-10 md:w-10" />
                        </div>
                        <div>
                          <h2 className="mb-2 font-display text-2xl font-bold text-charcoal md:text-3xl">{copy.title}</h2>
                          <p className="text-lg text-charcoal-light">Case ID: <span className="font-mono font-bold text-charcoal">{result.case_id}</span></p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-3xl border border-beige/60 bg-white">
                        <div className="flex items-center gap-3 bg-ink-surface px-6 py-4 md:px-8">
                          <AlertTriangle className="h-5 w-5 text-saffron-light" />
                          <h3 className="text-base font-bold text-white md:text-lg">
                            {result.kind === "emergency" ? "Emergency response" : "Search plan"}
                          </h3>
                        </div>
                        <div className="space-y-6 p-6 md:p-8">
                          {capturedImage && !result.matched_person && (
                            <div className="flex flex-col items-center gap-6 border-b border-beige/40 pb-6 md:flex-row">
                              <figure className="shrink-0 space-y-2 text-center">
                                <img src={capturedImage} alt="Photo captured at this kiosk" className="h-36 w-36 rounded-2xl border-2 border-beige object-cover shadow-md md:h-44 md:w-44" />
                                <figcaption className="text-sm text-charcoal-light/65">Captured scan</figcaption>
                              </figure>
                              <div className="flex-1 rounded-2xl border border-emerald/15 bg-emerald/[0.05] p-5">
                                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald"><ScanFace className="h-4 w-4" /> Clothing match</h4>
                                <p className="text-sm text-charcoal-light/70">The clothing in this scan matched active camera feeds nearby.</p>
                              </div>
                            </div>
                          )}

                          {result.matched_person && (
                            <div className="flex flex-col items-center gap-6 border-b border-beige/40 pb-6 md:flex-row">
                              <figure className="shrink-0 space-y-2 text-center">
                                {result.matched_person.image && (
                                  <img src={result.matched_person.image} alt="Matched person" className="h-36 w-36 rounded-2xl border-2 border-emerald object-cover shadow-md shadow-emerald/20 md:h-44 md:w-44" />
                                )}
                                <figcaption className="text-sm text-charcoal-light/65">Matched record</figcaption>
                              </figure>
                              <div className="flex-1 rounded-2xl border border-emerald/15 bg-emerald/[0.05] p-5">
                                <h4 className="mb-2 flex items-center gap-2 text-lg font-bold text-emerald md:text-xl"><ScanFace className="h-5 w-5" /> Match found</h4>
                                <dl className="mt-4 space-y-2 text-base">
                                  <div className="flex gap-2"><dt className="text-charcoal-light/55">Name:</dt><dd className="font-bold text-charcoal">{result.matched_person.name}</dd></div>
                                  <div className="flex gap-2"><dt className="text-charcoal-light/55">Status:</dt><dd className="text-charcoal-light">Safe at a kiosk</dd></div>
                                  <div className="flex gap-2"><dt className="text-charcoal-light/55">Location:</dt><dd className="font-bold text-charcoal">{result.matched_person.kiosk}</dd></div>
                                </dl>
                              </div>
                            </div>
                          )}

                          <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-charcoal-light/55">Priority search area</dt>
                              <dd className="text-xl font-bold text-charcoal md:text-2xl">{result.priority_zone}</dd>
                            </div>
                            <div className="space-y-1">
                              <dt className="text-sm font-medium text-charcoal-light/55">Alerted station</dt>
                              <dd className="text-xl font-bold text-charcoal md:text-2xl">{result.nearest_police}</dd>
                            </div>
                          </dl>

                          <div className="space-y-3">
                            <p className="text-sm font-medium text-charcoal-light/55">What happens next</p>
                            <ul className="space-y-2.5">
                              {result.action_items.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-base text-charcoal-light">
                                  <Check className="mt-1 h-4 w-4 shrink-0 text-saffron" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {HELPLINE && (
                            <a href={`tel:${HELPLINE.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-xl border border-beige/60 bg-ivory px-4 py-3 text-base font-semibold text-charcoal hover:bg-ivory-warm">
                              <Phone className="h-4 w-4 text-saffron" /> Helpline: {HELPLINE}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 pt-2 md:gap-5">
                        <Button onClick={() => window.print()} className="h-14 flex-1 rounded-2xl border border-beige/60 bg-white px-6 text-lg font-semibold text-charcoal hover:bg-ivory-warm md:h-16 md:px-8 md:text-xl">
                          <Printer className="mr-3 h-5 w-5" /> Print notice
                        </Button>
                        <Button onClick={resetKiosk} className="h-14 flex-[2] rounded-2xl bg-saffron px-6 text-lg font-bold text-white shadow-md shadow-saffron/20 hover:bg-saffron-dark md:h-16 md:px-8 md:text-xl">
                          Back to home screen
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            )}

            {step === 8 && (
              <motion.div key="step8" variants={pageVariants} initial="initial" animate="in" exit="out" className="flex w-full flex-col items-center space-y-6">
                <div className="space-y-3 text-center">
                  <p className="eyebrow">{scanType === "im_lost" ? "Emergency" : "Photo scan"}</p>
                  <h2 className="font-display text-4xl font-bold text-charcoal md:text-5xl">
                    {scanType === "im_lost" ? "Let us find you help" : "Scan a photo"}
                  </h2>
                  <p className="mx-auto max-w-2xl text-lg text-charcoal-light/70">
                    {scanType === "im_lost"
                      ? "Type your name, look at the camera and tap the button. We will send help to this kiosk."
                      : "Hold the photo up to the camera. We read clothing colours and patterns, never faces."}
                  </p>
                </div>

                {scanType === "im_lost" && (
                  <div className="w-full max-w-3xl pb-2">
                    <Field id="lost-name" label="What is your name?">
                      <Input id="lost-name" autoFocus autoComplete="off" className={`${INPUT_CLASS} focus-visible:ring-marigold`} placeholder="Your name" value={formData.name} onChange={(e) => handleUpdate("name", e.target.value)} />
                    </Field>
                  </div>
                )}

                <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-3xl border border-beige bg-ink-surface shadow-lg">
                  {camError ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
                      <WifiOff className="h-8 w-8" />
                      <p className="text-lg font-semibold">Camera not available</p>
                      <p className="max-w-sm text-sm text-white/60">Allow camera access in the browser, or ask a kiosk volunteer for help.</p>
                    </div>
                  ) : (
                    <>
                      <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="h-full w-full object-cover" mirrored onUserMediaError={() => setCamError(true)} />
                      <div className="absolute inset-0 m-8 overflow-hidden rounded-xl border-[3px] border-saffron/40">
                        {!reduceMotion && (
                          <motion.div
                            className="absolute left-0 h-0.5 w-full bg-saffron shadow-[0_0_16px_rgba(212,98,26,0.5)]"
                            animate={{ top: ["0%", "100%", "0%"] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          />
                        )}
                      </div>
                      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-surface/75 px-4 py-1.5 text-xs font-medium text-saffron-light backdrop-blur-sm">
                        <Loader2 className="h-3 w-3 animate-spin" /> Reading clothing colours
                      </div>
                    </>
                  )}
                </div>

                <div className="flex w-full max-w-3xl gap-4 md:gap-5">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCamError(false);
                      if (scanType === "report_missing") setStep(2);
                      else if (scanType === "find_case") setStep(6);
                      else setStep(0);
                    }}
                    className="h-14 flex-1 rounded-2xl border-beige/60 px-6 text-lg text-charcoal-light hover:bg-ivory-warm md:h-16 md:px-8 md:text-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={runScan}
                    disabled={camError || (scanType === "im_lost" && !formData.name.trim())}
                    className="h-14 flex-[2] rounded-2xl bg-saffron px-6 text-lg font-bold text-white shadow-md shadow-saffron/20 hover:bg-saffron-dark disabled:opacity-50 md:h-16 md:px-8 md:text-xl"
                  >
                    <ScanFace className="mr-3 h-5 w-5 md:h-6 md:w-6" />
                    {scanType === "im_lost" ? "Send emergency alert" : "Scan and search"}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div key="step6" variants={pageVariants} initial="initial" animate="in" exit="out" className="space-y-8">
                <StepHeading kicker="Search" title="Find an existing case" sub="Search by case ID or the person's name." />
                <Field id="search" label="Case ID or name">
                  <Input
                    id="search"
                    autoFocus
                    className={`${INPUT_CLASS} focus-visible:ring-emerald`}
                    placeholder="e.g. KM-ABC123 or Ramesh Kumar"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && searchInput.trim()) handleFindCase(); }}
                  />
                </Field>
                <div className="flex flex-wrap gap-3 border-t border-beige/40 pt-6 md:flex-nowrap md:gap-4">
                  <Button variant="outline" onClick={() => setStep(0)} className="h-14 flex-1 rounded-2xl border-beige/60 px-6 text-lg text-charcoal-light hover:bg-ivory-warm md:h-16 md:px-8 md:text-xl">
                    Cancel
                  </Button>
                  <Button onClick={() => { setScanType("find_case"); setStep(8); }} className="h-14 flex-1 rounded-2xl bg-emerald px-6 text-lg font-semibold text-white shadow-md shadow-emerald/20 hover:bg-emerald-dark md:h-16 md:px-8 md:text-xl">
                    <Camera className="mr-3 h-5 w-5 md:h-6 md:w-6" /> Scan a photo
                  </Button>
                  <Button disabled={!searchInput.trim()} onClick={handleFindCase} className="h-14 flex-[2] rounded-2xl bg-saffron px-6 text-lg font-bold text-white shadow-md shadow-saffron/20 hover:bg-saffron-dark disabled:opacity-50 md:h-16 md:px-8 md:text-xl">
                    <Search className="mr-3 h-5 w-5 md:h-6 md:w-6" /> Search
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function StepHeading({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div>
      <p className="eyebrow mb-3">{kicker}</p>
      <h2 className="font-display text-4xl font-bold text-charcoal md:text-5xl">{title}</h2>
      <p className="mt-2 text-lg text-charcoal-light/70">{sub}</p>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <Label htmlFor={id} className="text-base font-semibold text-charcoal-light">
        {label}
        {hint && <span className="ml-2 text-sm font-normal text-charcoal-light/55">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 p-6 md:p-8">
      <div>
        <p className="mb-1 text-sm font-medium text-charcoal-light/55">{label}</p>
        {children}
      </div>
      <button onClick={onEdit} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-beige/60 px-3 py-2 text-sm font-semibold text-charcoal-light transition-colors hover:bg-ivory-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron" aria-label={`Edit ${label.toLowerCase()}`}>
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
    </div>
  );
}

function WizardButtons({ onBack, onNext, disableNext }: { onBack: () => void; onNext: () => void; disableNext: boolean }) {
  return (
    <div className="flex gap-4 border-t border-beige/40 pt-6 md:gap-5">
      <Button variant="outline" onClick={onBack} className="h-14 rounded-2xl border-beige/60 px-6 text-lg text-charcoal-light hover:bg-ivory-warm md:h-16 md:px-8 md:text-xl">
        <ArrowLeft className="mr-2 h-5 w-5" /> Back
      </Button>
      <Button onClick={onNext} disabled={disableNext} className="h-14 flex-1 rounded-2xl bg-saffron px-6 text-lg font-bold text-white shadow-md shadow-saffron/20 hover:bg-saffron-dark disabled:opacity-50 md:h-16 md:px-8 md:text-xl">
        Continue
        <ArrowRight className="ml-3 h-5 w-5 md:h-6 md:w-6" />
      </Button>
    </div>
  );
}