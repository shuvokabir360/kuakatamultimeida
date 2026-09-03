import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCw, Check, Crop } from "lucide-react";
import { smartCropPortrait } from "@/lib/image-crop";

interface PhotoCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onCropComplete: (dataUrl: string) => void;
}

export function PhotoCropDialog({
  open,
  onOpenChange,
  file,
  onCropComplete,
}: PhotoCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    const img = new Image();
    img.src = url;
    img.onload = () => {
      imageRef.current = img;
    };

    return () => URL.revokeObjectURL(url);
  }, [file]);

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
    const size = 500;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    const scale = size / minDim;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    onCropComplete(dataUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Crop className="h-4 w-4 text-primary" /> ছবি ক্রপ ও সাইজ নির্ধারণ
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* Circular Crop Preview Area */}
          <div className="relative h-56 w-56 overflow-hidden rounded-full border-4 border-primary/40 bg-muted shadow-inner">
            {imageSrc && (
              <img
                src={imageSrc}
                alt="Crop preview"
                className="h-full w-full object-cover transition-transform duration-75"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-full border border-dashed border-white/60" />
          </div>

          {/* Controls */}
          <div className="w-full space-y-3">
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

            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw className="mr-1 h-3 w-3" /> ৯0° ঘোরান
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                onClick={handleSmartAutoCrop}
                disabled={processing}
              >
                স্মার্ট অটো-ক্রপ ⚡
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
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
          >
            <Check className="mr-1.5 h-4 w-4" /> ক্রপ করে সেভ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
