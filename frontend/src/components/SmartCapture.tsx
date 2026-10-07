"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import imageCompression from "browser-image-compression";
import {
  Camera,
  Upload,
  X,
  RotateCcw,
  Zap,
  Sun,
  Move,
  Eye,
  CheckCircle2,
  AlertTriangle,
  SwitchCamera,
  Footprints,
  User,
  ArrowLeft,
} from "lucide-react";
import {
  BURST_FRAME_COUNT,
  BURST_INTERVAL_MS,
  MAX_IMAGE_EDGE,
  IMAGE_QUALITY,
  MIN_LAPLACIAN_VARIANCE,
  MIN_BRIGHTNESS,
  MAX_BRIGHTNESS,
} from "@/lib/vision/config";

export type ShotTag = "front" | "back" | "close-up";

export interface CapturedPhoto {
  url: string;
  blob: Blob;
  name: string;
  tag: ShotTag;
  sharpness: number;
  brightness: number;
  width: number;
  height: number;
}

interface SmartCaptureProps {
  photos: CapturedPhoto[];
  onPhotosChange: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
}

function computeSharpness(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const imageData = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  const d = imageData.data;
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!;
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        -gray[(y - 1) * w + x]! -
        gray[y * w + (x - 1)]! +
        4 * gray[y * w + x]! -
        gray[y * w + (x + 1)]! -
        gray[(y + 1) * w + x]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function computeBrightness(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  let total = 0;
  const pixelCount = w * h;
  for (let i = 0; i < pixelCount; i++) {
    total += 0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!;
  }
  return total / pixelCount;
}

type QualityHint = {
  type: "ok" | "warning" | "error";
  message: string;
  icon: ReactNode;
};

function getQualityHints(sharpness: number, brightness: number): QualityHint[] {
  const hints: QualityHint[] = [];
  if (sharpness < MIN_LAPLACIAN_VARIANCE * 0.5) {
    hints.push({ type: "error", message: "Very blurry — hold steady", icon: <Eye className="h-3.5 w-3.5" /> });
  } else if (sharpness < MIN_LAPLACIAN_VARIANCE) {
    hints.push({ type: "warning", message: "Slightly blurry — hold still", icon: <Eye className="h-3.5 w-3.5" /> });
  }
  if (brightness < MIN_BRIGHTNESS) {
    hints.push({ type: "error", message: "Too dark — find better light", icon: <Sun className="h-3.5 w-3.5" /> });
  } else if (brightness > MAX_BRIGHTNESS) {
    hints.push({ type: "warning", message: "Too bright — step out of direct sun", icon: <Sun className="h-3.5 w-3.5" /> });
  }
  if (hints.length === 0) {
    hints.push({ type: "ok", message: "Good quality", icon: <CheckCircle2 className="h-3.5 w-3.5" /> });
  }
  return hints;
}

export function SmartCapture({
  photos,
  onPhotosChange,
  maxPhotos = 5,
}: SmartCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [currentTag, setCurrentTag] = useState<ShotTag>("front");
  const [capturing, setCapturing] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [liveHints, setLiveHints] = useState<QualityHint[]>([]);
  const [liveSharpness, setLiveSharpness] = useState(0);
  const [liveBrightness, setLiveBrightness] = useState(128);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      setCameraError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera in browser settings."
          : "Could not access camera. Use the upload button instead."
      );
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    if (qualityIntervalRef.current) {
      clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraActive) return;
    qualityIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const analysisW = 320;
      const analysisH = Math.round((video.videoHeight / video.videoWidth) * analysisW);
      canvas.width = analysisW;
      canvas.height = analysisH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, analysisW, analysisH);

      const sharpness = computeSharpness(ctx, analysisW, analysisH);
      const brightness = computeBrightness(ctx, analysisW, analysisH);
      setLiveSharpness(Math.round(sharpness));
      setLiveBrightness(Math.round(brightness));
      setLiveHints(getQualityHints(sharpness, brightness));
    }, 800);

    return () => {
      if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current);
    };
  }, [cameraActive]);

  const captureFrame = useCallback((): { blob: Blob; sharpness: number; brightness: number; w: number; h: number } | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const w = Math.min(video.videoWidth, MAX_IMAGE_EDGE);
    const h = Math.round((video.videoHeight / video.videoWidth) * w);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);

    const sharpness = computeSharpness(ctx, w, h);
    const brightness = computeBrightness(ctx, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
    const byteString = atob(dataUrl.split(",")[1]!);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: "image/jpeg" });

    return { blob, sharpness, brightness, w, h };
  }, []);

  const handleBurstCapture = useCallback(async () => {
    if (photos.length >= maxPhotos) return;
    setCapturing(true);

    const frames: Array<{ blob: Blob; sharpness: number; brightness: number; w: number; h: number }> = [];

    for (let i = 0; i < BURST_FRAME_COUNT; i++) {
      const frame = captureFrame();
      if (frame) frames.push(frame);
      if (i < BURST_FRAME_COUNT - 1) {
        await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
      }
    }

    if (frames.length === 0) {
      setCapturing(false);
      return;
    }

    frames.sort((a, b) => b.sharpness - a.sharpness);
    const best = frames[0]!;

    const url = URL.createObjectURL(best.blob);
    const name = `${currentTag}_${Date.now()}.jpg`;

    onPhotosChange([
      ...photos,
      {
        url,
        blob: best.blob,
        name,
        tag: currentTag,
        sharpness: best.sharpness,
        brightness: best.brightness,
        width: best.w,
        height: best.h,
      },
    ]);

    setCapturing(false);
  }, [photos, maxPhotos, captureFrame, currentTag, onPhotosChange]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || photos.length >= maxPhotos) return;

      setCompressing(true);
      try {
        const compressed = await imageCompression(files[0]!, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: MAX_IMAGE_EDGE,
          useWebWorker: true,
          fileType: "image/jpeg" as const,
        });

        const img = new Image();
        const loadPromise = new Promise<{ w: number; h: number }>((resolve) => {
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        });
        img.src = URL.createObjectURL(compressed);
        const { w, h } = await loadPromise;

        const canvas = document.createElement("canvas");
        const analysisW = Math.min(w, 320);
        const analysisH = Math.round((h / w) * analysisW);
        canvas.width = analysisW;
        canvas.height = analysisH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, analysisW, analysisH);
          const sharpness = computeSharpness(ctx, analysisW, analysisH);
          const brightness = computeBrightness(ctx, analysisW, analysisH);
          const url = URL.createObjectURL(compressed);
          const name = `${currentTag}_${Date.now()}.jpg`;
          onPhotosChange([
            ...photos,
            { url, blob: compressed, name, tag: currentTag, sharpness, brightness, width: w, height: h },
          ]);
        }
      } catch (err) {
        console.error("Compression failed:", err);
      } finally {
        setCompressing(false);
        e.target.value = "";
      }
    },
    [photos, maxPhotos, currentTag, onPhotosChange]
  );

  const switchCamera = useCallback(async () => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, [stopCamera]);

  useEffect(() => {
    if (cameraActive) {
    }
  }, [facingMode, cameraActive]);

  const removePhoto = useCallback(
    (index: number) => {
      const updated = [...photos];
      URL.revokeObjectURL(updated[index]!.url);
      updated.splice(index, 1);
      onPhotosChange(updated);
    },
    [photos, onPhotosChange]
  );

  const tagOptions: { tag: ShotTag; label: string; icon: ReactNode }[] = [
    { tag: "front", label: "Front", icon: <User className="h-3.5 w-3.5" /> },
    { tag: "back", label: "Back", icon: <ArrowLeft className="h-3.5 w-3.5" /> },
    { tag: "close-up", label: "Close-up", icon: <Eye className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-neutral-bg"
            >
              <img
                src={photo.url}
                alt={`${photo.tag} photo ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute right-1 top-1 rounded-full bg-charcoal/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Remove photo ${idx + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-1 left-1 flex gap-1">
                <span className="rounded-full bg-charcoal/60 px-2 py-0.5 text-2xs font-bold capitalize text-white">
                  {photo.tag}
                </span>
                <span className="rounded-full bg-charcoal/60 px-2 py-0.5 text-2xs font-bold text-white">
                  {(photo.blob.size / 1024).toFixed(0)} KB
                </span>
              </div>
              {photo.sharpness < MIN_LAPLACIAN_VARIANCE && (
                <div className="absolute right-1 bottom-1 rounded-full bg-warning/80 px-1.5 py-0.5 text-2xs font-bold text-white">
                  Blurry
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cameraActive && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-saffron/30 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full"
            style={{ maxHeight: "60vh" }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[85%] w-[55%] rounded-2xl border-2 border-dashed border-white/40" />
          </div>
          <div className="pointer-events-none absolute top-3 left-0 right-0 text-center">
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/80">
              Full body in frame · Face and shoes visible
            </span>
          </div>

          <div className="absolute bottom-16 left-3 right-3 flex flex-wrap gap-1.5">
            {liveHints.map((hint, i) => (
              <span
                key={i}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold ${
                  hint.type === "ok"
                    ? "bg-success/80 text-white"
                    : hint.type === "warning"
                      ? "bg-warning/80 text-white"
                      : "bg-destructive/80 text-white"
                }`}
              >
                {hint.icon}
                {hint.message}
              </span>
            ))}
          </div>

          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={switchCamera}
              className="rounded-full bg-card p-2.5 text-white backdrop-blur-sm transition hover:bg-card"
              aria-label="Switch camera"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleBurstCapture}
              disabled={capturing || photos.length >= maxPhotos}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-card text-white transition-transform active:scale-90 disabled:opacity-40"
              aria-label="Capture photo"
            >
              {capturing ? (
                <RotateCcw className="h-6 w-6 animate-spin" />
              ) : (
                <Camera className="h-7 w-7" />
              )}
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-full bg-card p-2.5 text-white backdrop-blur-sm transition hover:bg-card"
              aria-label="Close camera"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {(cameraActive || photos.length < maxPhotos) && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-2">Shot type:</span>
          <div className="flex gap-1.5">
            {tagOptions.map((opt) => (
              <button
                key={opt.tag}
                type="button"
                onClick={() => setCurrentTag(opt.tag)}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currentTag === opt.tag
                    ? "bg-primary-subtle text-saffron ring-1 ring-ring/30"
                    : "bg-neutral-bg text-ink-2 hover:bg-neutral-bg"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!cameraActive && photos.length < maxPhotos && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startCamera}
            disabled={compressing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-neutral-bg py-4 text-sm font-medium text-ink-2 transition-colors hover:border-saffron/40 hover:bg-primary-subtle hover:text-saffron disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
            Smart Camera
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={compressing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-neutral-bg py-4 text-sm font-medium text-ink-2 transition-colors hover:border-saffron/40 hover:bg-primary-subtle hover:text-saffron disabled:opacity-50"
          >
            <Upload className="h-5 w-5" />
            Upload Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {cameraError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-bg px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {cameraError}
        </div>
      )}

      {(compressing || capturing) && (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <RotateCcw className="h-4 w-4 animate-spin" />
          {capturing ? "Capturing burst frames…" : "Compressing photo…"}
        </p>
      )}
      <p className="text-xs text-ink-2">
        {photos.length}/{maxPhotos} photos · EXIF stripped · Auto-compressed ·
        Capture front, back, and close-up for best results
      </p>
    </div>
  );
}
