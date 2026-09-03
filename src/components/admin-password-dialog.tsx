import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
};

export function AdminPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: Props) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setShowPassword(false);
      setLoading(false);
    }
  }, [open]);

  const handleVerify = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      toast.error("অনুগ্রহ করে অ্যাডমিন পাসওয়ার্ড লিখুন");
      return;
    }

    try {
      setLoading(true);

      // 1. Direct master admin password check
      if (trimmed === "01747729757@SK") {
        await onConfirm();
        onOpenChange(false);
        return;
      }

      // 2. Server check for custom admin passwords
      const token =
        (typeof window !== "undefined" && (localStorage.getItem("km_token") || localStorage.getItem("km_finance_token"))) ||
        "";

      const res = await fetch("http://localhost:5000/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "ভুল পাসওয়ার্ড! অনুমতি দেওয়া হয়নি।");
      }

      await onConfirm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "ভুল পাসওয়ার্ড! অনুমতি দেওয়া হয়নি।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-lg font-bold">
            <ShieldAlert className="h-5 w-5 text-destructive" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="font-medium">
              নিরাপত্তার স্বার্থে এই রেকর্ডটি ডিলিট করতে আপনার অ্যাডমিন লগইন পাসওয়ার্ড প্রদান আবশ্যক।
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">অ্যাডমিন পাসওয়ার্ড *</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="লগইন পাসওয়ার্ড লিখুন"
                className="h-11 rounded-2xl pr-10 font-medium"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleVerify();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl"
          >
            বাতিল
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleVerify}
            disabled={loading || !password}
            className="rounded-xl gap-1.5 font-bold shadow-md"
          >
            {loading ? "যাচাই হচ্ছে…" : "ডিলিট নিশ্চিত করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
