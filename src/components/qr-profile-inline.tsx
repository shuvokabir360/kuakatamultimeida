import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Share2, Copy, Check, QrCode, ExternalLink, CalendarRange, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { bnDate } from "@/lib/format";

type ShareRow = {
  share_token: string | null;
  share_enabled: boolean;
  share_from: string | null;
  share_to: string | null;
};

function genToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, "").slice(0, 22);
}

export function QrProfileInline({ memberId, memberName }: { memberId: string; memberName: string }) {
  const qc = useQueryClient();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: share } = useQuery({
    queryKey: ["member-share", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("share_token, share_enabled, share_from, share_to")
        .eq("id", memberId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { share_token: null, share_enabled: true, share_from: null, share_to: null }) as ShareRow;
    },
  });

  // Auto-generate and persist token if missing
  useEffect(() => {
    if (share && (!share.share_token || share.share_enabled === false)) {
      const token = share.share_token || genToken();
      supabase
        .from("members")
        .update({ share_enabled: true, share_token: token })
        .eq("id", memberId)
        .then(() => qc.invalidateQueries({ queryKey: ["member-share", memberId] }));
    }
  }, [share, memberId, qc]);

  useEffect(() => {
    setFrom(share?.share_from ?? "");
    setTo(share?.share_to ?? "");
  }, [share?.share_from, share?.share_to]);

  const activeToken = share?.share_token || "km";
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${memberId}?t=${activeToken}`
      : "";

  useEffect(() => {
    if (!url) { setDataUrl(null); return; }
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      width: 720,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [url]);

  const update = useMutation({
    mutationFn: async (patch: Partial<ShareRow>) => {
      const { error } = await supabase.from("members").update(patch).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["member-share", memberId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRange = () => {
    if (from && to && from > to) {
      toast.error("শুরুর তারিখ শেষের পরে হতে পারবে না");
      return;
    }
    update.mutate({ share_from: from || null, share_to: to || null });
    toast.success("তারিখের পরিসর সংরক্ষণ হয়েছে");
  };

  const clearRange = () => {
    setFrom(""); setTo("");
    update.mutate({ share_from: null, share_to: null });
    toast.success("পরিসর সরানো হয়েছে — সব তারিখের হিসাব দেখাবে");
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${memberName.replace(/\s+/g, "-")}-QR.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("প্রোফাইল লিংক কপি করা হয়েছে!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("কপি করা যায়নি");
    }
  };

  const share_ = async () => {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${memberName} — ব্যক্তিগত প্রোফাইল ও হিসাব`,
          text: `${memberName}-এর শুটিং, হাজিরা ও পেমেন্টের হিসাব দেখতে এই লিংকে প্রবেশ করুন:`,
          url,
        });
      } catch {/* cancelled */}
    } else {
      copy();
    }
  };

  const dirty = (from || "") !== (share?.share_from ?? "") || (to || "") !== (share?.share_to ?? "");

  return (
    <div className="w-full min-w-0 space-y-3 overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 via-white to-white p-4 shadow-sm dark:from-emerald-950/30 dark:to-zinc-900/40 dark:border-emerald-900/30">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
          <QrCode className="h-4 w-4 text-emerald-600" />
          <span>ব্যক্তিগত প্রোফাইল লিংক (সদস্যের জন্য)</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          সর্বদা সক্রিয়
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        এই লিংকটি সদস্যকে পাঠিয়ে দিলে সে তার সকল <strong>শুটিং, হাজিরা, পেমেন্ট ও বকেয়া হিসাব</strong> সরাসরি দেখতে পারবে।
      </p>

      {/* Share Link Input with One-Click Copy */}
      <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-emerald-200/70 bg-white dark:bg-zinc-900/80 p-2 shadow-2xs">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-300 select-all pl-1.5">
          {url || "লিংক তৈরি হচ্ছে…"}
        </span>
        <Button
          type="button"
          onClick={copy}
          size="sm"
          className="h-8 px-3 rounded-xl gap-1.5 font-bold text-xs shrink-0 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "কপি হয়েছে!" : "লিংক কপি"}
        </Button>
      </div>

      {/* Main Action Buttons: Share & Open */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={share_}
          className="rounded-xl h-9 text-xs font-bold gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
        >
          <Share2 className="h-4 w-4" /> হোয়াটসঅ্যাপ / শেয়ার
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => window.open(url, "_blank")}
          className="rounded-xl h-9 text-xs font-bold gap-1.5"
        >
          <ExternalLink className="h-4 w-4" /> ওপেন করে দেখুন
        </Button>
      </div>

      {/* QR Code Preview (collapsible/compact) */}
      <div className="rounded-2xl border bg-slate-50/70 dark:bg-zinc-900/50 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-white p-1 shadow-xs border shrink-0">
            {dataUrl ? (
              <img src={dataUrl} alt="QR Code" className="h-full w-full object-contain" />
            ) : (
              <div className="h-full w-full grid place-items-center text-[9px] text-muted-foreground">QR</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">সদস্যের QR কোড</div>
            <div className="text-[10px] text-muted-foreground">স্ক্যান করলেই সরাসরি প্রোফাইল ওপেন হবে</div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={download}
          disabled={!dataUrl}
          className="rounded-xl h-8 px-2.5 text-xs font-bold gap-1 shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> QR ডাউনলোড
        </Button>
      </div>

      {/* Optional Date Range Filter */}
      <div className="rounded-2xl border bg-card/60 p-3 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-muted-foreground text-[11px]">
          <CalendarRange className="h-3.5 w-3.5" /> নির্দিষ্ট মেয়াদের হিসাব দেখাতে চান? (ঐচ্ছিক)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">শুরুর তারিখ</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs rounded-xl" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">শেষ তারিখ</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs rounded-xl" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 flex-1 text-xs rounded-xl font-bold" onClick={saveRange} disabled={!dirty || update.isPending}>
            পরিসর সংরক্ষণ
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs rounded-xl" onClick={clearRange} disabled={update.isPending || (!share?.share_from && !share?.share_to)}>
            সব তারিখের হিসাব
          </Button>
        </div>
      </div>
    </div>
  );
}

