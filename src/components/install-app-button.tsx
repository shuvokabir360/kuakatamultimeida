import { useEffect, useState } from "react";
import { Download, Smartphone, X, Share, PlusSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Global prompt holder so any component can access the deferred event
let globalPromptEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalPromptEvent = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn(globalPromptEvent));
  });

  window.addEventListener("appinstalled", () => {
    globalPromptEvent = null;
    listeners.forEach((fn) => fn(null));
  });
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(globalPromptEvent);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIos(isApple);

    const update = (evt: BeforeInstallPromptEvent | null) => setPromptEvent(evt);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return { promptEvent, isInstalled, isIos };
}

// 1. Header or Button in Menu
export function InstallAppButton({ className = "" }: { className?: string }) {
  const { promptEvent, isInstalled, isIos } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        globalPromptEvent = null;
        listeners.forEach((fn) => fn(null));
      }
    } else {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleInstallClick}
        className={`gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 shadow-sm ${className}`}
      >
        <Download className="h-4 w-4" />
        <span>অ্যাপ ইনস্টল</span>
      </Button>

      {/* Guide Dialog for iOS or manual install */}
      <InstallGuideDialog open={showIosGuide} onOpenChange={setShowIosGuide} isIos={isIos} />
    </>
  );
}

// 2. Floating Bottom Banner for mobile and desktop
export function PwaInstallBanner() {
  const { promptEvent, isInstalled, isIos } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("pwa_install_dismissed") === "true";
      if (isDismissed) setDismissed(true);
    }
  }, []);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pwa_install_dismissed", "true");
    }
  };

  const handleInstall = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setDismissed(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl dark:border-emerald-900/50 dark:bg-zinc-900/95">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-md">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-foreground">KM Team Finance</div>
              <div className="text-xs text-muted-foreground truncate">মোবাইলে অ্যাপের মতো ইনস্টল করুন</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleInstall}
              className="h-9 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              ইনস্টল
            </Button>
            <button
              onClick={handleDismiss}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="বন্ধ করুন"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <InstallGuideDialog open={showGuide} onOpenChange={setShowGuide} isIos={isIos} />
    </>
  );
}

function InstallGuideDialog({
  open,
  onOpenChange,
  isIos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isIos: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Smartphone className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-lg font-bold mt-2">
            অ্যাপ হিসেবে ইনস্টল করার নিয়ম
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-muted-foreground">
            আপনার ডিভাইসে সরাসরি এক ক্লিকে ওপেন করতে নিচের ধাপগুলো অনুসরণ করুন:
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-3 text-xs">
          {isIos ? (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ১
                </span>
                <div>
                  সাফারি ব্রাউজারের নিচে <strong>Share ( <Share className="inline h-3.5 w-3.5" /> )</strong> আইকনে চাপ দিন।
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ২
                </span>
                <div>
                  নিচে স্ক্রল করে <strong>"Add to Home Screen" ( <PlusSquare className="inline h-3.5 w-3.5" /> )</strong> চাপুন।
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ৩
                </span>
                <div>
                  উপরে ডান কোণায় <strong>"Add"</strong> বাটনে চাপলেই অ্যাপটি মোবাইলে সেভ হয়ে যাবে।
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ১
                </span>
                <div>
                  ব্রাউজারের উপরে ডান কোণায় ৩-ডট ( <strong>⋮</strong> ) মেনুতে চাপ দিন।
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ২
                </span>
                <div>
                  <strong>"Install app"</strong> অথবা <strong>"Add to Home screen"</strong> চাপুন।
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  ৩
                </span>
                <div>
                  <strong>Install</strong> চাপলেই আপনার ফোনে বা কম্পিউটারে অ্যাপের মতো ইনস্টল হয়ে যাবে।
                </div>
              </div>
            </>
          )}
        </div>

        <Button
          onClick={() => onOpenChange(false)}
          className="w-full mt-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" /> বুঝেছি
        </Button>
      </DialogContent>
    </Dialog>
  );
}
