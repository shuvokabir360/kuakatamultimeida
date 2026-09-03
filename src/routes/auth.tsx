import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";
import { Wallet, Lock, UserCheck, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const searchSchema = z.object({
  denied: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: searchSchema,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const { denied } = useSearch({ from: "/auth" });

  const [adminId, setAdminId] = useState("adminkm");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const showErr = (title: string, description?: string) => {
    setErrMsg(description ? `${title} — ${description}` : title);
    toast.error(title, description ? { description } : undefined);
  };
  const clearErr = () => setErrMsg(null);

  if (!loading && user && !denied) return <Navigate to="/dashboard" />;

  const startAdminLogin = async () => {
    clearErr();
    if (!adminId.trim()) return showErr("অ্যাডমিন আইডি দিন");
    if (!adminPassword) return showErr("পাসওয়ার্ড দিন");
    setSending(true);
    try {
      const res = await supabase.auth.signInWithPassword({
        email: adminId.trim(),
        password: adminPassword,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success("লগইন সফল হয়েছে");
      window.location.href = "/dashboard";
    } catch (e: any) {
      showErr("লগইন ব্যর্থ", e?.message || "আইডি অথবা পাসওয়ার্ড সঠিক নয়");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-accent/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Wallet className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Kuakata Multimedia Finance</h1>
            <p className="text-sm text-muted-foreground">টিম ও বেতন ব্যবস্থাপনা</p>
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="border-b pb-3 text-center">
            <h2 className="text-lg font-bold text-foreground">অ্যাডমিন লগইন</h2>
            <p className="text-xs text-muted-foreground">আপনার অ্যাডমিন ক্রেডেনশিয়াল দিয়ে প্রবেশ করুন</p>
          </div>

          {denied && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-snug">
                এই অ্যাকাউন্টে অ্যাক্সেস নেই। অনুমোদিত অ্যাডমিন দিয়ে লগইন করুন।
              </span>
            </div>
          )}

          {errMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-in fade-in slide-in-from-top-1"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-snug">{errMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <UserCheck className="h-4 w-4 text-primary" /> অ্যাডমিন ID / ইউজারনেম
              </Label>
              <Input
                type="text"
                autoComplete="username"
                placeholder="adminkm"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="h-4 w-4 text-primary" /> পাসওয়ার্ড
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="পাসওয়ার্ড লিখুন"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && startAdminLogin()}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              className="h-11 w-full text-base font-semibold"
              onClick={startAdminLogin}
              disabled={sending || !adminPassword}
            >
              {sending ? "যাচাই হচ্ছে…" : "লগইন করুন"}
            </Button>
          </div>

          <div className="rounded-lg bg-muted/60 p-3 text-center text-xs text-muted-foreground">
            অ্যাডমিন আইডি: <span className="font-mono font-bold text-foreground">adminkm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
