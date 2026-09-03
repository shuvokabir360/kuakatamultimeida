import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { taka, bnDate, toBn } from "@/lib/format";
import { Download, Printer, CheckCircle2, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type PaymentReceiptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    member_id: string;
    amount: number;
    note: string | null;
    paid_at: string;
    method: string | null;
    bank_account_number: string | null;
    members?: { name: string; photo_url: string | null; role?: string | null; type?: string } | null;
    member?: { name: string; photo_url: string | null; role?: string | null; type?: string } | null;
  } | null;
  memberName?: string;
  memberType?: string;
  memberRole?: string;
};

const METHOD_NAMES: Record<string, string> = {
  cash: "ক্যাশ (নগদ)",
  bkash: "বিকাশ (bKash)",
  nagad: "নগদ (Nagad)",
  rocket: "রকেট (Rocket)",
  upay: "উপায় (Upay)",
  bank: "ব্যাংক ট্রান্সফার (Bank)",
};

export function PaymentReceiptModal({
  open,
  onOpenChange,
  payment,
  memberName,
  memberType,
  memberRole,
}: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const memberId = payment?.member_id;

  // Fetch current member balance for due info
  const { data: balanceData } = useQuery({
    queryKey: ["balance", memberId],
    enabled: !!memberId && open,
    queryFn: async () => {
      const { data } = await supabase.rpc("member_balance", { _member_id: memberId });
      return Number(data ?? 0);
    },
  });

  if (!payment) return null;

  const mInfo = (payment as any).members || (payment as any).member;
  const name = memberName || mInfo?.name || "সদস্য";
  const type = memberType || mInfo?.type;
  const role = memberRole || mInfo?.role;
  const currentDue = balanceData ?? 0;
  const paymentAmount = Number(payment.amount || 0);
  const methodText = METHOD_NAMES[payment.method || "cash"] || payment.method || "ক্যাশ";
  const receiptNo = `KM-${String(payment.id || "").slice(-6).toUpperCase() || Date.now().toString().slice(-6)}`;

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    try {
      setDownloading(true);
      const [{ toJpeg }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const imgData = await toJpeg(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        unit: "mm",
        format: "a5",
        orientation: "portrait",
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = (receiptRef.current.offsetHeight * imgW) / receiptRef.current.offsetWidth;

      pdf.addImage(imgData, "JPEG", margin, margin, imgW, Math.min(imgH, pageH - margin * 2));
      pdf.save(`Payment_Receipt_${name}_${toBn(receiptNo)}.pdf`);
      toast.success("পিডিএফ রসিদ ডাউনলোড সম্পন্ন হয়েছে!");
    } catch (err: any) {
      toast.error("রসিদ ডাউনলোড করা যায়নি: " + (err?.message || ""));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    try {
      setDownloading(true);
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `Payment_Receipt_${name}_${toBn(receiptNo)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("রসিদের ছবি ডাউনলোড সম্পন্ন হয়েছে!");
    } catch (err: any) {
      toast.error("ছবি ডাউনলোড করা যায়নি: " + (err?.message || ""));
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base font-bold">
            <span className="flex items-center gap-2 text-primary">
              <FileText className="h-5 w-5" /> পেমেন্ট মানি রিসিট
            </span>
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              #{receiptNo}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* --- PRINTABLE / DOWNLOADABLE RECEIPT CONTAINER --- */}
        <div className="border border-border/80 rounded-2xl overflow-hidden shadow-sm bg-white text-slate-900 my-2">
          <div ref={receiptRef} className="p-6 bg-white space-y-5 text-slate-900 font-sans relative">
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
              <span className="text-7xl font-black rotate-[-30deg] tracking-widest text-slate-900">
                KUAKATA MULTIMEDIA
              </span>
            </div>

            {/* Receipt Header */}
            <div className="border-b-2 border-red-600/80 pb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-red-600 tracking-tight flex items-center gap-2">
                  <span>কুয়াকাটা মাল্টিমিডিয়া ফাইন্যান্স</span>
                </h2>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  টিম ও বেতন ব্যবস্থাপনা সিস্টেম
                </p>
                <div className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold uppercase tracking-wider">
                  অফিসিয়াল পেমেন্ট ভাউচার / মানি রিসিট
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-500 font-bold uppercase">রসিদ নম্বর</div>
                <div className="text-sm font-mono font-bold text-slate-800">#{receiptNo}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">তারিখ</div>
                <div className="text-xs font-bold text-slate-800">{bnDate(payment.paid_at)}</div>
              </div>
            </div>

            {/* Member & Payment Basic Info Grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] font-semibold uppercase">প্রাপকের নাম</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">{name}</span>
                {(role || type) && (
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    {role ? `${role} • ` : ""}
                    {type === "monthly" ? "মাসিক চুক্তি" : "দৈনিক হাজিরা"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-semibold uppercase">পেমেন্ট মাধ্যম</span>
                <span className="font-bold text-slate-900 block mt-0.5">{methodText}</span>
                {payment.bank_account_number && (
                  <span className="text-[11px] font-mono text-slate-600 block mt-0.5">
                    অ্যাকাউন্ট: {toBn(payment.bank_account_number)}
                  </span>
                )}
              </div>
            </div>

            {/* Financial Summary Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">বিবরণ</th>
                    <th className="p-2.5 text-right">পরিমাণ (টাকা)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-2.5 text-slate-700 font-medium">
                      বেতন / পারিশ্রমিক পরিশোধ বাবদ
                      {payment.note ? <span className="block text-[11px] text-slate-500 mt-0.5">নোট: {payment.note}</span> : null}
                    </td>
                    <td className="p-2.5 text-right font-bold text-emerald-700 text-sm">
                      {taka(paymentAmount)}
                    </td>
                  </tr>

                  <tr className="bg-emerald-50/50">
                    <td className="p-2.5 font-bold text-emerald-900">
                      মোট পরিশোধিত পরিমাণ (Paid Amount)
                    </td>
                    <td className="p-2.5 text-right font-black text-emerald-800 text-base">
                      {taka(paymentAmount)}
                    </td>
                  </tr>

                  <tr className="bg-slate-50">
                    <td className="p-2.5 text-slate-600 font-semibold">
                      বর্তমান অবশিষ্ট বকেয়া (Remaining Due)
                    </td>
                    <td className={`p-2.5 text-right font-bold ${currentDue > 0 ? "text-amber-700" : "text-slate-600"}`}>
                      {taka(currentDue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Status Stamp & Signatures */}
            <div className="pt-4 flex items-end justify-between border-t border-dashed border-slate-200">
              <div className="flex items-center gap-2 border-2 border-emerald-600 rounded-xl px-3 py-1.5 text-emerald-700 bg-emerald-50/60 rotate-[-4deg]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div>
                  <div className="text-[11px] font-black tracking-widest uppercase">PAID / পরিশোধিত</div>
                  <div className="text-[9px] font-medium">{bnDate(payment.paid_at)}</div>
                </div>
              </div>

              <div className="flex gap-8 text-center text-[10px] text-slate-500">
                <div>
                  <div className="w-24 border-b border-slate-400 mb-1" />
                  <span>গ্রহীতার স্বাক্ষর</span>
                </div>
                <div>
                  <div className="w-24 border-b border-slate-400 mb-1" />
                  <span className="font-bold text-slate-700">কর্তৃপক্ষের স্বাক্ষর</span>
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center text-[9px] text-slate-400 pt-1">
              এটি একটি কম্পিউটার জেনারেটেড ডিজিটাল রসিদ • কুয়াকাটা মাল্টিমিডিয়া
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            বন্ধ করুন
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadImage}
              disabled={downloading}
              className="rounded-xl gap-1.5 font-bold"
            >
              <ImageIcon className="h-4 w-4" /> ছবি ডাউনলোড
            </Button>

            <Button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="rounded-xl gap-1.5 font-bold shadow-md bg-red-600 hover:bg-red-700 text-white"
            >
              <Download className="h-4 w-4" /> {downloading ? "ডাউনলোড হচ্ছে…" : "পিডিএফ (PDF) রসিদ"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
