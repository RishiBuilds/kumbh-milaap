"use client";

import { useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Edit3,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
  Loader2,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  COLOR_PALETTE,
  GARMENT_TYPES,
  PATTERNS,
  AGE_CATEGORIES,
  PRESENTATIONS,
  BUILDS,
  HEIGHT_HINTS,
  type PaletteColor,
} from "@/lib/vision/palette";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/vision/config";
import type {
  EnrichedExtractionResult,
  EnrichedGarmentInfo,
  AccessoryInfo,
  FeatureInfo,
  VolunteerEdit,
} from "@/lib/vision/schema";

interface AttributeReviewProps {
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
  extraction: EnrichedExtractionResult | null;
  loading: boolean;
  error: string | null;
  onConfirm: (
    extraction: EnrichedExtractionResult,
    edits: VolunteerEdit[]
  ) => void;
  onSkip: () => void;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-success-bg text-success-text border-success-line";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "bg-primary-subtle text-saffron border-saffron/30";
  return "bg-warning-bg text-warning-text border-warning-line";
}

function getPaletteHex(name: string): string {
  const found = COLOR_PALETTE.find((c) => c.name === name);
  return found?.hex ?? "#808080";
}

export function AttributeReview({
  photoUrl,
  photoWidth,
  photoHeight,
  extraction,
  loading,
  error,
  onConfirm,
  onSkip,
}: AttributeReviewProps) {
  const [editableExtraction, setEditableExtraction] = useState<EnrichedExtractionResult | null>(null);
  const [edits, setEdits] = useState<VolunteerEdit[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>("garments");
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [imgDisplayDims, setImgDisplayDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (extraction) {
      setEditableExtraction(structuredClone(extraction));
      setEdits([]);
    }
  }, [extraction]);

  useEffect(() => {
    const el = imgContainerRef.current?.querySelector("img");
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setImgDisplayDims({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [photoUrl]);

  const trackEdit = useCallback(
    (field: string, original: unknown, corrected: unknown) => {
      setEdits((prev) => [...prev, { field, original_value: original, corrected_value: corrected }]);
    },
    []
  );

  const updateGarment = useCallback(
    (index: number, key: string, value: unknown) => {
      if (!editableExtraction) return;
      const updated = structuredClone(editableExtraction);
      const garment = updated.garments[index];
      if (!garment) return;

      const oldValue = key === "type" ? garment.type :
        key === "primary" ? garment.colors.primary :
        key === "secondary" ? garment.colors.secondary :
        key === "pattern" ? garment.colors.pattern : undefined;

      if (key === "type") garment.type = value as typeof garment.type;
      else if (key === "primary") garment.colors.primary = value as string;
      else if (key === "secondary") garment.colors.secondary = value as string | null;
      else if (key === "pattern") garment.colors.pattern = value as typeof garment.colors.pattern;

      trackEdit(`garments[${index}].${key}`, oldValue, value);
      setEditableExtraction(updated);
    },
    [editableExtraction, trackEdit]
  );

  const removeGarment = useCallback(
    (index: number) => {
      if (!editableExtraction) return;
      const updated = structuredClone(editableExtraction);
      const removed = updated.garments.splice(index, 1)[0];
      trackEdit(`garments[${index}]`, removed?.type, "REMOVED");
      setEditableExtraction(updated);
    },
    [editableExtraction, trackEdit]
  );

  const updatePerson = useCallback(
    (key: string, value: unknown) => {
      if (!editableExtraction) return;
      const updated = structuredClone(editableExtraction);
      const oldValue = (updated.person as Record<string, unknown>)[key];
      (updated.person as Record<string, unknown>)[key] = value;
      trackEdit(`person.${key}`, oldValue, value);
      setEditableExtraction(updated);
    },
    [editableExtraction, trackEdit]
  );

  const handleConfirm = useCallback(() => {
    if (!editableExtraction) return;
    onConfirm(editableExtraction, edits);
  }, [editableExtraction, edits, onConfirm]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-neutral-bg">
          <img src={photoUrl} alt="Analyzing..." className="w-full opacity-60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-charcoal/30 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <p className="mt-3 text-sm font-semibold text-white">Analyzing attributes…</p>
            <p className="mt-1 text-xs text-white/70">This may take a few seconds</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onSkip}
          className="w-full gap-2"
        >
          <SkipForward className="h-4 w-4" />
          Skip — fill manually
        </Button>
      </div>
    );
  }

  if (error || !editableExtraction) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-warning-line bg-warning-bg px-4 py-3 text-sm text-warning-text">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error || "Could not analyze image. Please fill the form manually."}
        </div>
        <Button
          variant="outline"
          onClick={onSkip}
          className="w-full"
        >
          Fill manually
        </Button>
      </div>
    );
  }

  const ext = editableExtraction;

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-saffron/30 bg-primary-subtle px-4 py-2.5 text-sm">
        <Sparkles className="h-4 w-4 text-saffron" />
        <span className="font-semibold text-saffron">AI suggestion — please verify</span>
        <span className="text-xs text-ink-2">Every field is editable</span>
      </div>

      <div ref={imgContainerRef} className="relative overflow-hidden rounded-2xl border border-border">
        <img src={photoUrl} alt="Captured person" className="w-full" />
        {imgDisplayDims.w > 0 &&
          ext.garments.map((garment, idx) => {
            const [x1, y1, x2, y2] = garment.bbox;
            if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
            const borderColor = garment.needs_review ? "border-warning-line" : "border-success-line";
            return (
              <div
                key={`bbox-${idx}`}
                className={`pointer-events-none absolute border-2 ${borderColor} rounded-sm`}
                style={{
                  left: `${x1 * 100}%`,
                  top: `${y1 * 100}%`,
                  width: `${(x2 - x1) * 100}%`,
                  height: `${(y2 - y1) * 100}%`,
                }}
              >
                <span
                  className={`absolute -top-5 left-0 rounded-sm px-1 py-0.5 text-2xs font-bold text-white ${
                    garment.needs_review ? "bg-warning" : "bg-success"
                  }`}
                >
                  {garment.type}
                </span>
              </div>
            );
          })}
      </div>

      {ext.image_quality.retake_suggestion && (
        <div className="flex items-center gap-2 rounded-xl border border-warning-line bg-warning-bg px-3 py-2 text-xs text-warning-text">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {ext.image_quality.retake_suggestion}
        </div>
      )}

      <SectionToggle
        title="Person"
        isOpen={expandedSection === "person"}
        onToggle={() => toggleSection("person")}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-2 w-20">Age:</span>
            <div className="flex flex-wrap gap-1.5">
              {AGE_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    updatePerson("age_estimate", {
                      ...ext.person.age_estimate,
                      min: cat.min,
                      max: cat.max,
                      category: cat.name,
                    });
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    ext.person.age_estimate.category === cat.name
                      ? "bg-primary-subtle text-saffron ring-1 ring-ring/30"
                      : "bg-neutral-bg text-ink-2 hover:bg-neutral-bg"
                  }`}
                >
                  {cat.name} ({cat.min}–{cat.max})
                </button>
              ))}
            </div>
            <ConfidenceBadge value={ext.person.age_estimate.confidence} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-2 w-20">Presentation:</span>
            <div className="flex gap-1.5">
              {PRESENTATIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updatePerson("presentation", p)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    ext.person.presentation === p
                      ? "bg-primary-subtle text-saffron ring-1 ring-ring/30"
                      : "bg-neutral-bg text-ink-2 hover:bg-neutral-bg"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-2 w-20">Build:</span>
            <div className="flex gap-1.5">
              {BUILDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => updatePerson("build", b)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    ext.person.build === b
                      ? "bg-primary-subtle text-saffron ring-1 ring-ring/30"
                      : "bg-neutral-bg text-ink-2 hover:bg-neutral-bg"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-2 w-20">Height:</span>
            <div className="flex gap-1.5">
              {HEIGHT_HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => updatePerson("height_hint", h)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    ext.person.height_hint === h
                      ? "bg-primary-subtle text-saffron ring-1 ring-ring/30"
                      : "bg-neutral-bg text-ink-2 hover:bg-neutral-bg"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {ext.person.minor_likely && (
            <div className="flex items-center gap-2 rounded-lg border border-warning-line bg-warning-bg px-3 py-2 text-xs text-warning-text">
              <AlertTriangle className="h-3.5 w-3.5" />
              Person appears to be a minor — dual-operator verification required
            </div>
          )}
        </div>
      </SectionToggle>

      <SectionToggle
        title={`Garments (${ext.garments.length})`}
        isOpen={expandedSection === "garments"}
        onToggle={() => toggleSection("garments")}
      >
        <div className="space-y-3">
          {ext.garments.map((garment, idx) => (
            <GarmentChip
              key={idx}
              garment={garment}
              index={idx}
              onUpdate={updateGarment}
              onRemove={removeGarment}
            />
          ))}
          {ext.garments.length === 0 && (
            <p className="text-xs text-ink-2 italic">No garments detected</p>
          )}
        </div>
      </SectionToggle>

      <SectionToggle
        title={`Accessories (${ext.accessories.length})`}
        isOpen={expandedSection === "accessories"}
        onToggle={() => toggleSection("accessories")}
      >
        <div className="flex flex-wrap gap-1.5">
          {ext.accessories.map((acc, idx) => (
            <Badge key={idx} variant="outline" className={`text-xs capitalize ${getConfidenceColor(acc.confidence)}`}>
              {acc.type}
              {acc.color && (
                <span
                  className="ml-1 inline-block h-2.5 w-2.5 rounded-full border border-border"
                  style={{ backgroundColor: getPaletteHex(acc.color) }}
                />
              )}
            </Badge>
          ))}
          {ext.accessories.length === 0 && (
            <p className="text-xs text-ink-2 italic">No accessories detected</p>
          )}
        </div>
      </SectionToggle>

      <SectionToggle
        title={`Features (${ext.distinguishing_features.length})`}
        isOpen={expandedSection === "features"}
        onToggle={() => toggleSection("features")}
      >
        <div className="flex flex-wrap gap-1.5">
          {ext.distinguishing_features.map((feat, idx) => (
            <Badge key={idx} variant="outline" className={`text-xs ${getConfidenceColor(feat.confidence)}`}>
              {feat.description}
            </Badge>
          ))}
          {ext.distinguishing_features.length === 0 && (
            <p className="text-xs text-ink-2 italic">No distinguishing features</p>
          )}
        </div>
      </SectionToggle>

      {ext.free_text_summary && (
        <div className="rounded-xl bg-neutral-bg p-3 text-sm text-ink-2">
          <p className="text-xs font-semibold text-ink-2 mb-1">AI Summary</p>
          {ext.free_text_summary}
        </div>
      )}

      {ext.notes.length > 0 && (
        <div className="rounded-xl bg-warning-bg border border-warning-line p-3 text-xs text-warning-text">
          <p className="font-semibold mb-1">Model notes:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {ext.notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleConfirm}
          className="flex-1 gap-2 bg-success text-white hover:bg-success"
        >
          <CheckCircle2 className="h-4 w-4" />
          Confirm details
        </Button>
        <Button variant="outline" onClick={onSkip} className="gap-2">
          <Edit3 className="h-4 w-4" />
          Edit manually
        </Button>
      </div>

      {edits.length > 0 && (
        <p className="text-xs text-ink-2">
          {edits.length} field(s) modified from AI suggestion
        </p>
      )}
    </div>
  );
}

function SectionToggle({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-neutral-bg transition-colors"
      >
        {title}
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && <div className="border-t border-border px-4 py-3">{children}</div>}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
        value >= 0.8
          ? "bg-success-bg text-success-text"
          : value >= LOW_CONFIDENCE_THRESHOLD
            ? "bg-primary-subtle text-saffron"
            : "bg-warning-bg text-warning-text"
      }`}
    >
      {pct}%
    </span>
  );
}

function GarmentChip({
  garment,
  index,
  onUpdate,
  onRemove,
}: {
  garment: EnrichedGarmentInfo;
  index: number;
  onUpdate: (idx: number, key: string, value: unknown) => void;
  onRemove: (idx: number) => void;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);

  const isLowConf = garment.confidence < LOW_CONFIDENCE_THRESHOLD;
  const needsReview = garment.needs_review;
  const borderClass = needsReview || isLowConf
    ? "border-warning-line bg-warning-bg/50"
    : "border-border bg-card";

  return (
    <div className={`relative rounded-xl border p-3 ${borderClass} space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTypePicker(!showTypePicker)}
            className="rounded-lg bg-charcoal/5 px-2.5 py-1 text-xs font-bold capitalize text-foreground hover:bg-charcoal/10 transition-colors"
          >
            {garment.type}
            <Edit3 className="ml-1 inline h-3 w-3 text-ink-2" />
          </button>
          <ConfidenceBadge value={garment.confidence} />
          {needsReview && (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-2xs font-bold text-warning-text">
              Needs review
            </span>
          )}
          {garment.model_color_agrees === false && (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-2xs font-bold text-warning-text">
              Color mismatch
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded-full p-1 text-ink-2 hover:bg-danger-bg hover:text-destructive transition-colors"
          aria-label="Remove garment"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {showTypePicker && (
        <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-bg p-2">
          {GARMENT_TYPES.map((gt) => (
            <button
              key={gt.name}
              type="button"
              onClick={() => {
                onUpdate(index, "type", gt.name);
                setShowTypePicker(false);
              }}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                garment.type === gt.name
                  ? "bg-primary-subtle text-saffron ring-1 ring-ring/30"
                  : "bg-card text-ink-2 hover:bg-neutral-bg"
              }`}
            >
              {gt.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold text-ink-2 uppercase tracking-wider">Color</span>
        <button
          type="button"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold capitalize hover:border-saffron/30 transition-colors"
        >
          <span
            className="h-3 w-3 rounded-full border border-border"
            style={{ backgroundColor: getPaletteHex(garment.colors.primary) }}
          />
          {garment.colors.primary}
          {garment.colors.secondary && (
            <>
              <span className="text-ink-2/30">/</span>
              <span
                className="h-3 w-3 rounded-full border border-border"
                style={{ backgroundColor: getPaletteHex(garment.colors.secondary) }}
              />
              {garment.colors.secondary}
            </>
          )}
          <Edit3 className="h-2.5 w-2.5 text-ink-2/30" />
        </button>

        {garment.measured_color && (
          <span className="text-2xs text-ink-2">
            measured: {garment.measured_color.name} (ΔE {garment.measured_color.delta_e.toFixed(1)})
          </span>
        )}
      </div>

      {showColorPicker && (
        <div className="rounded-lg bg-neutral-bg p-2">
          <p className="text-2xs font-semibold text-ink-2 mb-1.5">Primary color:</p>
          <div className="flex flex-wrap gap-1">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  onUpdate(index, "primary", c.name);
                  setShowColorPicker(false);
                }}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-2xs font-semibold capitalize transition-colors ${
                  garment.colors.primary === c.name
                    ? "ring-2 ring-ring/40 bg-primary-subtle"
                    : "bg-card hover:bg-neutral-bg"
                }`}
                title={c.name_hi}
              >
                <span
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ backgroundColor: c.hex }}
                />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold text-ink-2 uppercase tracking-wider">Pattern</span>
        <button
          type="button"
          onClick={() => setShowPatternPicker(!showPatternPicker)}
          className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold capitalize hover:border-saffron/30 transition-colors"
        >
          {garment.colors.pattern}
          <Edit3 className="ml-1 inline h-2.5 w-2.5 text-ink-2/30" />
        </button>
      </div>

      {showPatternPicker && (
        <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-bg p-2">
          {PATTERNS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                onUpdate(index, "pattern", p.name);
                setShowPatternPicker(false);
              }}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                garment.colors.pattern === p.name
                  ? "bg-primary-subtle text-saffron ring-1 ring-ring/30"
                  : "bg-card text-ink-2 hover:bg-neutral-bg"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
