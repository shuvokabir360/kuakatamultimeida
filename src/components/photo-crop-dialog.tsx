import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCw, Check, Crop, Move, RefreshCw } from "lucide-react";
import { smartCropPortrait } from "@/lib/image-crop";

interface PhotoCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onCropComplete: (dataUrl: string) => void;
}

const PREVIEW_SIZE = 240; // Preview container px
const EXPORT_SIZE = 600;  // High-res output px

export function PhotoCropDialog({
  open,
  onOpenChange,
  file,
  onCropComplete,
}: PhotoCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    img.src = url;
    img.onload = () => {
      imageRef.current = img;
    };

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setZoom((prev) => Math.min(Math.max(1, prev + delta), 3.5));
  };

  const handleSmartAutoCrop = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const { blob } = await smartCropPortrait(file);
      const reader = new FileReader();
      reader.onload = () => {
        onCropComplete(reader.result as string);
        onOpenChange(false);
      };
      reader.readAsDataURL(blob);
    } catch {
      handleManualCrop();
    } finally {
      setProcessing(false);
    }
  };

  const handleManualCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    const ratio = EXPORT_SIZE / PREVIEW_SIZE;

    ctx.save();
    // Center of canvas + dragged offset scaled
    ctx.translate(EXPORT_SIZE / 2 + offset.x * ratio, EXPORT_SIZE / 2 + offset.y * ratio);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Compute scaled cover dimensions
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    const imgScale = EXPORT_SIZE / minDim;
    const drawW = img.naturalWidth * imgScale;
    const drawH = img.naturalHeight * imgScale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCropComplete(dataUrl);
    onOpenChange(false);
  };

  const resetPosition = () => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-5 select-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Crop className="h-4 w-4 text-primary" /> ছবি ক্রপ ও পজিশন নির্ধারণ
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-1">
          {/* Circular Drag & Pan Area */}
          <div
            className="relative h-60 w-60 overflow-hidden rounded-full border-4 border-primary/50 bg-muted shadow-lg touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            {imageSrc && (
              <div
                className="h-full w-full pointer-events-none flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  className="max-h-none max-w-none object-cover pointer-events-none"
                  style={{
                    width: `${PREVIEW_SIZE}px`,
                    height: `${PREVIEW_SIZE}px`,
                  }}
                  draggable={false}
                />
              </div>
            )}
            {/* Guide Circle Overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Move className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span>ছবি টেনে ডানে-বামে বা উপরে-নিচে সরান</span>
          </div>

          {/* Controls */}
          <div className="w-full space-y-2.5 pt-1">
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.05}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw className="mr-1 h-3 w-3" /> ৯০°
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={resetPosition}
              >
                <RefreshCw className="mr-1 h-3 w-3" /> রিসেট
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={handleSmartAutoCrop}
                disabled={processing}
              >
                অটো ⚡
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            বাতিল
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleManualCrop}
            disabled={processing}
            className="font-semibold shadow-md"
          >
            <Check className="mr-1.5 h-4 w-4" /> ক্রপ করে সেভ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
