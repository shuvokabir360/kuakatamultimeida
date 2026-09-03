import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { Landmark, Smartphone, User as UserIcon, Camera, ArrowLeft, Wallet, ReceiptText, CalendarDays, Gift, Clapperboard, CalendarRange, Plus, Trash2 } from "lucide-react";
import type { PublicProfile } from "@/lib/public-profile.functions";
import { smartCropPortrait } from "@/lib/image-crop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taka, toBn, bnDate } from "@/lib/format";
import { ACCOUNT_KIND_LABEL, type AccountKind, BD_BANKS } from "@/lib/bd-banks";
import { toast } from "sonner";

export const Route = createFileRoute("/p/$memberId")({
  validateSearch: (s: Record<string, unknown>) => ({ t: typeof s.t === "string" ? s.t : "" }),
  loader: async ({ params, deps }) => {
    const { getPublicProfile } = await import("@/lib/public-profile.functions");
    return getPublicProfile({ data: { memberId: params.memberId, token: deps.t } });
  },
  component: PublicProfilePage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-lg font-semibold">প্রফাইল লোড হয়নি</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={() => { router.invalidate(); reset(); }}>আবার চেষ্টা করুন</Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">প্রফাইল পাওয়া যায়নি</h1>
        <Link to="/" className="mt-3 inline-flex text-sm text-primary underline">হোম</Link>
      </div>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.member.name} — প্রফাইল` : "প্রফাইল" },
      { name: "description", content: loaderData ? `${loaderData.member.name}-এর হিসাব ও পেমেন্ট তথ্য` : "প্রফাইল তথ্য" },
      { property: "og:title", content: loaderData ? `${loaderData.member.name} — প্রফাইল` : "প্রফাইল" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PublicProfilePage() {
  const data = Route.useLoaderData() as PublicProfile;
  const { member, balance, accounts, payments, salaries, bonuses, shootings, shootings_count, range } = data;
  const router = useRouter();
  const { t: token } = Route.useSearch();

  const [photoUrl, setPhotoUrl] = useState<string | null>(member.photo_signed_url);

  // OTP Gate State (popup modal)
  const [isVerified, setIsVerified] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(`member_verified_${member.id}`) === "true";
  });

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState(member.phone_masked || "01XXXXXXXXX");

  // Countdown timer effect
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleRequestOtp = async () => {
    try {
      setSendingOtp(true);
      const resData = await requestProfileOtp({ data: { memberId: member.id } });
      setOtpSent(true);
      setCountdown(60);
      if (resData.masked_phone) setMaskedPhone(resData.masked_phone);
      if (resData.dev_code) {
        toast.success(`ওটিপি পাঠানো হয়েছে (কোড: ${resData.dev_code})`, { duration: 8000 });
      } else {
        toast.success(resData.message || "মোবাইলে ওটিপি কোড পাঠানো হয়েছে");
      }
    } catch (e: any) {
      toast.error(e.message || "ওটিপি পাঠাতে সমস্যা হয়েছে");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 4) {
      toast.error("সঠিক ওটিপি কোড লিখুন");
      return;
    }
    try {
      setVerifyingOtp(true);
      await verifyProfileOtp({ data: { memberId: member.id, code: otpCode.trim() } });
      sessionStorage.setItem(`member_verified_${member.id}`, "true");
      setIsVerified(true);
      toast.success("ওটিপি সফল! পেজ ওপেন হয়েছে।");
    } catch (e: any) {
      toast.error(e.message || "ওটিপি যাচাই ব্যর্থ হয়েছে");
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-emerald-50/60 via-background to-background pb-20">
      
      {/* Background Page Content (blurred when locked) */}
      <div className={`mx-auto max-w-md px-4 pt-6 transition-all duration-300 ${!isVerified ? "filter blur-md select-none pointer-events-none opacity-50" : ""}`}>
        <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> হোম
        </Link>

        {/* Member Header Card */}
        <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_20px_50px_-20px_rgba(5,150,105,0.35)] backdrop-blur-xl dark:bg-zinc-900/70">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-accent text-accent-foreground ring-4 ring-white/70 shadow-lg dark:ring-zinc-800/70">
                {photoUrl ? (
                  <img src={photoUrl} alt={member.name} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              {isVerified && member.has_phone && (
                <ChangePhotoDialog
                  memberId={member.id}
                  token={token}
                  phoneMasked={member.phone_masked}
                  onUpdated={(url) => setPhotoUrl(url)}
                />
              )}
            </div>
            <h1 className="mt-3 text-xl font-bold">{member.name}</h1>
            <div className="mt-1 flex items-center justify-center gap-2 text-xs">
              {member.role && <span className="text-muted-foreground">{member.role}</span>}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${member.type === "daily" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary"}`}>
                {member.type === "daily" ? "দৈনিক সদস্য" : "মাসিক সদস্য"}
              </span>
              {isVerified && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  ✓ ভেরিফাইড
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          {(range.from || range.to) && (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CalendarRange className="h-3.5 w-3.5" />
              {range.from ? bnDate(range.from) : "শুরু"} — {range.to ? bnDate(range.to) : "এখন"}
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="ব্যালেন্স" value={taka(balance)} accent={balance > 0 ? "text-success" : ""} />
            <Stat label={member.type === "daily" ? "দৈনিক রেট" : "মাসিক"} value={taka(member.rate)} />
            <Stat label="শুটিং" value={toBn(String(shootings_count))} />
          </div>
        </div>

        {/* Verified Sections */}
        {member.type === "daily" && (
          <Section icon={<Clapperboard className="h-4 w-4" />} title={`উপস্থিত শুটিং (${toBn(String(shootings_count))})`}>
            {shootings.length === 0 ? (
              <Empty>এই সময়ে কোনো শুটিংয়ে উপস্থিত ছিল না</Empty>
            ) : (
              <ul className="divide-y rounded-2xl border bg-card">
                {shootings.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {bnDate(s.shoot_date)}
                        {s.director ? ` • ${s.director}` : ""}
                        {s.channel ? ` • ${s.channel}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold">{taka(s.earned)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <Section
          icon={<Wallet className="h-4 w-4" />}
          title="পেমেন্ট একাউন্ট"
          action={
            <AddAccountDialog
              memberId={member.id}
              token={Route.useSearch().t}
              phoneMasked={member.phone_masked}
              onAdded={() => router.invalidate()}
            />
          }
        >
          {accounts.length === 0 ? (
            <Empty>কোনো একাউন্ট যোগ করা হয়নি — উপরের "যোগ" বাটনে চাপ দিয়ে যোগ করুন</Empty>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    {a.kind === "bank" ? <Landmark className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-medium">
                      {ACCOUNT_KIND_LABEL[a.kind as AccountKind] ?? a.kind}
                      {a.kind === "bank" && a.bank_name ? ` — ${a.bank_name}` : ""}
                    </div>
                    <div className="font-mono text-base">{toBn(a.account_number)}</div>
                    {(a.account_holder || a.branch) && (
                      <div className="text-muted-foreground">
                        {a.account_holder}{a.account_holder && a.branch ? " • " : ""}{a.branch}
                      </div>
                    )}
                  </div>
                  <DeleteAccountButton
                    memberId={member.id}
                    token={Route.useSearch().t}
                    phoneMasked={member.phone_masked}
                    accountId={a.id}
                    onDeleted={() => router.invalidate()}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {salaries.length > 0 && (
          <Section icon={<CalendarDays className="h-4 w-4" />} title="মাসিক বেতন">
            <ul className="divide-y rounded-2xl border bg-card">
              {salaries.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{bnDate(s.month)}</span>
                  <span className="font-semibold">{taka(s.amount)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {bonuses.length > 0 && (
          <Section icon={<Gift className="h-4 w-4" />} title="বোনাস">
            <ul className="divide-y rounded-2xl border bg-card">
              {bonuses.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div>{bnDate(b.given_at)}</div>
                    {b.note && <div className="truncate text-xs text-muted-foreground">{b.note}</div>}
                  </div>
                  <span className="font-semibold text-success">+{taka(b.amount)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section icon={<ReceiptText className="h-4 w-4" />} title="পেমেন্ট ইতিহাস">
          {payments.length === 0 ? (
            <Empty>এখনও কোনো পেমেন্ট নেই</Empty>
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div>{bnDate(p.paid_at)}</div>
                    {p.note && <div className="truncate text-xs text-muted-foreground">{p.note}</div>}
                  </div>
                  <span className="font-semibold">{taka(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Automatic OTP Verification Popup Modal */}
      <Dialog open={!isVerified}>
        <DialogContent
          className="max-w-sm rounded-3xl p-6 border-emerald-300 shadow-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="text-center space-y-3">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-inner">
              <Smartphone className="h-8 w-8" />
            </div>

            <div>
              <DialogTitle className="text-lg font-bold text-foreground">নিরাপত্তা ওটিপি যাচাই</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                <strong>{member.name}</strong>-এর শুটিং, হাজিরা ও পেমেন্ট হিসাব দেখতে আপনার ফোনে (<span className="font-mono font-bold text-foreground">{maskedPhone}</span>) পাঠানো ওটিপি কোড দিন।
              </p>
            </div>

            {!otpSent ? (
              <Button
                type="button"
                onClick={handleRequestOtp}
                disabled={sendingOtp}
                className="w-full h-12 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95 mt-2"
              >
                {sendingOtp ? "কোড পাঠানো হচ্ছে…" : "📲 ওটিপি কোড পাঠান"}
              </Button>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-muted-foreground">৬-ডিজিটের ওটিপি কোড</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="123456"
                    className="h-12 text-center text-xl font-mono tracking-widest rounded-2xl border-emerald-300 focus-visible:ring-emerald-500 shadow-inner"
                    autoFocus
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp || !otpCode}
                  className="w-full h-12 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95"
                >
                  {verifyingOtp ? "যাচাই হচ্ছে…" : "✓ ওটিপি দিয়ে পেজ খুলুন"}
                </Button>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <span className="text-muted-foreground">
                    {countdown > 0 ? `পুনরায় পাঠান (${toBn(String(countdown))} সে)` : "কোড পাননি?"}
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={countdown > 0 || sendingOtp}
                    className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline disabled:opacity-50"
                  >
                    আবার পাঠান
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border bg-muted/40 px-3 py-2 text-center">
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className={`text-base font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function Section({ icon, title, children, action }: { icon: React.ReactNode; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800/80 dark:text-emerald-200/80">
          {icon}{title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed bg-card p-4 text-center text-xs text-muted-foreground">{children}</div>;
}

function ChangePhotoDialog({
  memberId,
  token,
  phoneMasked,
  onUpdated,
}: { memberId: string; token: string; phoneMasked: string | null; onUpdated: (url: string | null) => void }) {

  const [open, setOpen] = useState(false);
  const [last4, setLast4] = useState("");
  const [cropped, setCropped] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setLast4("");
    setCropped(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleFile = async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("শুধু ছবি বাছুন");
      return;
    }
    setProcessing(true);
    try {
      const { blob } = await smartCropPortrait(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCropped(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast.error(e?.message || "ছবি প্রস্তুত করা যায়নি");
    } finally {
      setProcessing(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!cropped) throw new Error("ছবি বাছুন");
      if (!/^[0-9]{4}$/.test(last4)) throw new Error("৪ ডিজিট দিন");
      const buf = new Uint8Array(await cropped.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
      const base64 = btoa(bin);
      return await updatePublicProfilePhoto({
        data: { memberId, token, last4, fileBase64: base64, contentType: "image/jpeg", ext: "jpg" },
      });
    },
    onSuccess: (res) => {
      toast.success("ছবি আপডেট হয়েছে");
      onUpdated(res.photo_signed_url);
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-white dark:ring-zinc-900"
          aria-label="ছবি পরিবর্তন"
        >
          <Camera className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>প্রফাইল ছবি পরিবর্তন</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-accent ring-2 ring-primary/30"
          >
            {processing ? (
              <span className="text-[11px] text-muted-foreground">প্রস্তুত হচ্ছে…</span>
            ) : previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-7 w-7 text-muted-foreground" />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            যেকোনো সাইজের ছবি আপলোড করুন — মুখ ও বডি স্বয়ংক্রিয়ভাবে ক্রপ হয়ে যাবে।
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              ফোন নম্বরের শেষ ৪ ডিজিট
              {phoneMasked && <span className="ml-1 font-mono text-foreground/70">({toBn(phoneMasked)})</span>}
            </label>
            <Input
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              placeholder="যেমন: ৪৫৬৭"
              className="text-center font-mono text-lg tracking-[0.5em]"
            />
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !cropped || last4.length !== 4 || processing}
            className="w-full"
          >
            {save.isPending ? "আপলোড হচ্ছে…" : "সংরক্ষণ"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            শুধু সদস্য নিজেই (যার ফোন নম্বরের শেষ ৪ ডিজিট মেলে) ছবি পরিবর্তন করতে পারবেন।
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type AccKind = "bkash" | "nagad" | "rocket" | "upay" | "bank";

function AddAccountDialog({
  memberId, token, phoneMasked, onAdded,
}: { memberId: string; token: string; phoneMasked: string | null; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AccKind>("bkash");
  const [acc, setAcc] = useState("");
  const [holder, setHolder] = useState("");
  const [bank, setBank] = useState("");
  const [branch, setBranch] = useState("");
  const [last4, setLast4] = useState("");

  const reset = () => {
    setKind("bkash"); setAcc(""); setHolder(""); setBank(""); setBranch(""); setLast4("");
  };

  const add = useMutation({
    mutationFn: async () => {
      return await addPublicMemberAccount({
        data: {
          memberId, token, last4,
          kind, account_number: acc.trim(),
          account_holder: holder.trim() || null,
          bank_name: kind === "bank" ? bank.trim() : null,
          branch: kind === "bank" ? (branch.trim() || null) : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("একাউন্ট যোগ হয়েছে");
      setOpen(false);
      reset();
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    /^[0-9]{4}$/.test(last4) &&
    acc.trim().length >= 4 &&
    (kind !== "bank" || bank.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
          <Plus className="h-3.5 w-3.5" /> যোগ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>পেমেন্ট একাউন্ট যোগ করুন</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ধরন</label>
            <Select value={kind} onValueChange={(v) => setKind(v as AccKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="rocket">Rocket</SelectItem>
                <SelectItem value="upay">Upay</SelectItem>
                <SelectItem value="bank">Bank Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "bank" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ব্যাংকের নাম</label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger><SelectValue placeholder="বাছুন" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {BD_BANKS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ব্রাঞ্চ (ঐচ্ছিক)</label>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} maxLength={120} />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {kind === "bank" ? "একাউন্ট নম্বর" : "মোবাইল/একাউন্ট নম্বর"}
            </label>
            <Input
              value={acc}
              onChange={(e) => setAcc(e.target.value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 40))}
              inputMode={kind === "bank" ? "text" : "numeric"}
              className="font-mono"
              maxLength={40}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">নাম (একাউন্ট হোল্ডার)</label>
            <Input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={120} />
          </div>

          <div className="space-y-1.5 rounded-xl border border-dashed bg-card/50 p-3">
            <label className="text-xs font-medium text-muted-foreground">
              ফোন নম্বরের শেষ ৪ ডিজিট দিয়ে ভেরিফাই করুন
              {phoneMasked && <span className="ml-1 font-mono text-foreground/70">({toBn(phoneMasked)})</span>}
            </label>
            <Input
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              placeholder="যেমন: ৪৫৬৭"
              className="text-center font-mono text-lg tracking-[0.5em]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => add.mutate()} disabled={!canSubmit || add.isPending} className="w-full">
            {add.isPending ? "সংরক্ষণ হচ্ছে…" : "যোগ করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountButton({
  memberId, token, phoneMasked, accountId, onDeleted,
}: { memberId: string; token: string; phoneMasked: string | null; accountId: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [last4, setLast4] = useState("");

  const del = useMutation({
    mutationFn: async () => {
      return await deletePublicMemberAccount({ data: { memberId, token, last4, accountId } });
    },
    onSuccess: () => {
      toast.success("একাউন্ট মুছে ফেলা হয়েছে");
      setOpen(false);
      setLast4("");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLast4(""); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="মুছে ফেলুন"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xs rounded-3xl">
        <DialogHeader><DialogTitle>একাউন্ট মুছে ফেলুন</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            ফোন নম্বরের শেষ ৪ ডিজিট
            {phoneMasked && <span className="ml-1 font-mono text-foreground/70">({toBn(phoneMasked)})</span>}
          </label>
          <Input
            inputMode="numeric"
            maxLength={4}
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            className="text-center font-mono text-lg tracking-[0.5em]"
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={last4.length !== 4 || del.isPending}
            onClick={() => del.mutate()}
            className="w-full"
          >
            {del.isPending ? "মুছছে…" : "মুছে ফেলুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
