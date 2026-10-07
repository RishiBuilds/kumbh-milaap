"use client";

import { useState, useCallback, useRef } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Upload, X, RotateCcw, ImagePlus } from "lucide-react";

interface PhotoCaptureProps {
  photos: { url: string; blob: Blob; name: string }[];
  onPhotosChange: (photos: { url: string; blob: Blob; name: string }[]) => void;
  maxPhotos?: number;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: "image/jpeg" as const,
};

export function PhotoCapture({
  photos,
  onPhotosChange,
  maxPhotos = 5,
}: PhotoCaptureProps) {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (photos.length >= maxPhotos) {
        setError(`Maximum ${maxPhotos} photos allowed`);
        return;
      }

      setError(null);
      setCompressing(true);

      try {
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
        const url = URL.createObjectURL(compressed);
        const name = `photo_${Date.now()}.jpg`;
        onPhotosChange([...photos, { url, blob: compressed, name }]);
      } catch (err) {
        console.error("Compression failed:", err);
        setError("Failed to process photo. Please try again.");
      } finally {
        setCompressing(false);
      }
    },
    [photos, maxPhotos, onPhotosChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      processFile(files[0]!);
      e.target.value = "";
    },
    [processFile]
  );

  const removePhoto = useCallback(
    (index: number) => {
      const updated = [...photos];
      URL.revokeObjectURL(updated[index]!.url);
      updated.splice(index, 1);
      onPhotosChange(updated);
    },
    [photos, onPhotosChange]
  );

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-neutral-bg"
            >
              <img
                src={photo.url}
                alt={`Photo ${idx + 1}`}
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
              <span className="absolute bottom-1 left-1 rounded-full bg-charcoal/60 px-2 py-0.5 text-2xs font-bold text-white">
                {(photo.blob.size / 1024).toFixed(0)} KB
              </span>
            </div>
          ))}
        </div>
      )}

      {photos.length < maxPhotos && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={compressing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-neutral-bg py-4 text-sm font-medium text-ink-2 transition-colors hover:border-saffron/40 hover:bg-primary-subtle hover:text-saffron disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
            Camera
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={compressing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-neutral-bg py-4 text-sm font-medium text-ink-2 transition-colors hover:border-saffron/40 hover:bg-primary-subtle hover:text-saffron disabled:opacity-50"
          >
            <ImagePlus className="h-5 w-5" />
            Gallery
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {compressing && (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <RotateCcw className="h-4 w-4 animate-spin" />
          Compressing photo…
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <p className="text-xs text-ink-2">
        {photos.length}/{maxPhotos} photos · Auto-compressed to save bandwidth
      </p>
    </div>
  );
}
