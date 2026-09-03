import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { bnDate, toBn } from "@/lib/format";
import {
  Check,
  X,
  CalendarCheck,
  Clapperboard,
  Trash2,
  Pencil,
  Save,
  History,
  Plus,
  Tv,
  UserCog,
  Sparkles,
  AlertCircle,
  Film,
} from "lucide-react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/member-avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DayMonthYearPicker } from "@/components/day-month-year-picker";
import { useChannels, getChannelColor } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

type Member = { id: string; name: string; role: string | null; photo_url: string | null; rate: number };
type Shooting = { id: string; name: string; shoot_date: string; channel?: string; director?: string };

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shootingName, setShootingName] = useState("");
  const [customShootingInput, setCustomShootingInput] = useState("");
  const [showAddShootingInline, setShowAddShootingInline] = useState(false);

  const { data: channels = [] } = useChannels();

  const { data: members = [] } = useQuery({
    queryKey: ["daily-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, role, photo_url, rate")
        .eq("type", "daily")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const { data: shootingsOnDate = [], isLoading: isLoadingShootings } = useQuery({
    queryKey: ["shootings-on", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shootings")
        .select("id, name, shoot_date, channel, director")
        .eq("shoot_date", date)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Shooting[];
    },
  });

  // Auto-detect and auto-select shooting when date or shootings change
  useEffect(() => {
    if (shootingsOnDate.length > 0) {
      const matched = shootingsOnDate.find((s) => s.name === shootingName);
      if (matched) {
        setShootingName(matched.name);
      } else {
        setShootingName(shootingsOnDate[0].name);
      }
      setShowAddShootingInline(false);
    } else {
      setShootingName("");
    }
  }, [shootingsOnDate, date]);

  const { data: marked = {} } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("member_id, present, shooting_id, rate_override")
        .eq("date", date);
      if (error) throw error;
      const map: Record<string, { present: boolean; shooting_id: string | null; rate_override: number | null }> = {};
      (data ?? []).forEach((r) => {
        map[r.member_id] = {
          present: r.present,
          shooting_id: r.shooting_id,
          rate_override: r.rate_override as number | null,
        };
      });
      return map;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["attendance-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("date, present, shooting_id, member:members(name), shooting:shootings(name)")
        .order("date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        date: string;
        present: boolean;
        shooting_id: string | null;
        member: { name: string } | null;
        shooting: { name: string } | null;
      }>;
    },
  });

  const historyByDate = history.reduce((acc, r) => {
    const key = `${r.date}__${r.shooting?.name ?? "—"}`;
    if (!acc[key]) acc[key] = { date: r.date, shooting: r.shooting?.name ?? null, present: [], absent: [] };
    (r.present ? acc[key].present : acc[key].absent).push(r.member?.name ?? "—");
    return acc;
  }, {} as Record<string, { date: string; shooting: string | null; present: string[]; absent: string[] }>);
  const historyGroups = Object.values(historyByDate);

  async function ensureShootingId(nameToEnsure: string): Promise<string | null> {
    const trimmed = nameToEnsure.trim();
    if (!trimmed) return null;
    const existing = shootingsOnDate.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("লগইন প্রয়োজন");
    const { data, error } = await supabase
      .from("shootings")
      .insert({
        owner_id: u.user.id,
        name: trimmed,
        shoot_date: date,
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["shootings-on", date] });
    await qc.invalidateQueries({ queryKey: ["shootings"] });
    return data?.id || null;
  }

  const mark = useMutation({
    mutationFn: async ({
      memberId,
      present,
      rate_override,
    }: {
      memberId: string;
      present: boolean;
      rate_override?: number | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      const shooting_id = await ensureShootingId(shootingName);
      const { error } = await supabase.from("attendance").insert({
        owner_id: u.user.id,
        member_id: memberId,
        date,
        present,
        shooting_id,
        rate_override: present ? (rate_override ?? null) : null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["attendance", date] });
      await qc.invalidateQueries({ queryKey: ["attendance-history"] });
      await qc.invalidateQueries({ queryKey: ["balances"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["shootings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAttendance = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("member_id", memberId)
        .eq("date", date);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["attendance", date] });
      await qc.invalidateQueries({ queryKey: ["attendance-history"] });
      await qc.invalidateQueries({ queryKey: ["balances"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("হাজিরা মুছে ফেলা হয়েছে");
      setEditMember(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editMember, setEditMember] = useState<Member | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [pendingRate, setPendingRate] = useState<Record<string, string>>({});
  const [editRate, setEditRate] = useState<string>("");
  const [historyDate, setHistoryDate] = useState("");

  // Clear pending when date changes
  useEffect(() => {
    setPending({});
    setPendingRate({});
  }, [date]);

  // Init editRate when opening dialog
  useEffect(() => {
    if (editMember) {
      const rec = (marked as Record<string, { present: boolean; shooting_id: string | null; rate_override: number | null }>)[editMember.id];
      setEditRate(rec?.rate_override != null ? String(rec.rate_override) : String(editMember.rate ?? ""));
    }
  }, [editMember, marked]);

  const saveAll = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(pending);
      if (entries.length === 0) throw new Error("সেভ করার মতো কিছু নেই");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      const shooting_id = await ensureShootingId(shootingName);
      const rows = entries.map(([memberId, present]) => {
        const raw = pendingRate[memberId];
        const num = raw !== undefined && raw !== "" ? Number(raw) : NaN;
        const member = members.find((m) => m.id === memberId);
        const rate_override = present && !Number.isNaN(num) && num !== (member?.rate ?? null) ? num : null;
        return {
          owner_id: u.user!.id,
          member_id: memberId,
          date,
          present,
          shooting_id: shooting_id || null,
          rate_override,
        };
      });
      const { error } = await supabase.from("attendance").insert(rows);
      if (error) throw error;
      return entries.length;
    },
    onSuccess: async (count) => {
      setPending({});
      setPendingRate({});
      await qc.invalidateQueries({ queryKey: ["attendance", date] });
      await qc.invalidateQueries({ queryKey: ["attendance-history"] });
      await qc.invalidateQueries({ queryKey: ["balances"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["shootings"] });
      toast.success(`${toBn(count)} জনের হাজিরা সফলভাবে সেভ হয়েছে`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingCount = Object.keys(pending).length;
  const presentCount =
    Object.values(marked).filter((v) => v.present).length +
    Object.values(pending).filter(Boolean).length;

  const currentSelectedShooting = shootingsOnDate.find((s) => s.name === shootingName);
  const currentShootingColor = currentSelectedShooting?.channel
    ? getChannelColor(currentSelectedShooting.channel, channels)
    : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">হাজিরা</h1>
        <p className="text-sm text-muted-foreground">দৈনিক কর্মীদের জন্য দৈনিক হাজিরা ও মজুরি</p>
      </div>

      {/* ১. তারিখ ও শুটিং নির্বাচন কার্ড */}
      <div className="rounded-3xl border bg-card/70 backdrop-blur-md p-5 space-y-4 shadow-sm">
        {/* তারিখ সিলেকশন (দিন, মাস, বছর) */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            ১. তারিখ নির্বাচন করুন
          </label>
          <DayMonthYearPicker value={date} onChange={setDate} />
        </div>

        {/* ২. স্বয়ংক্রিয় শুটিং শো এবং সিলেকশন */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Film className="h-4 w-4 text-primary" /> ২. এই তারিখের শুটিং
            </label>
            {shootingsOnDate.length === 0 && !showAddShootingInline && (
              <button
                type="button"
                onClick={() => setShowAddShootingInline(true)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> শুটিং যোগ করুন
              </button>
            )}
          </div>

          {shootingsOnDate.length > 0 ? (
            <div className="space-y-2">
              {/* যদি একটির বেশি শুটিং থাকে তবে ড্রপডাউন, অন্যথায় অটো-সিলেক্টেড সুন্দর কার্ড */}
              {shootingsOnDate.length > 1 ? (
                <div className="space-y-2">
                  <select
                    value={shootingName}
                    onChange={(e) => setShootingName(e.target.value)}
                    className="flex h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  >
                    {shootingsOnDate.map((s) => (
                      <option key={s.id} value={s.name}>
                        🎬 {s.name} {s.channel ? `(${s.channel})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* নির্বাচিত শুটিং এর ডিটেইল প্রিভিউ কার্ড */}
              {currentSelectedShooting && (
                <div
                  style={{
                    borderColor: currentShootingColor ? `${currentShootingColor}50` : undefined,
                    backgroundColor: currentShootingColor ? `${currentShootingColor}10` : undefined,
                  }}
                  className="flex items-center justify-between rounded-2xl border p-3.5 bg-primary/5 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{
                        backgroundColor: currentShootingColor ? currentShootingColor : undefined,
                      }}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-black shadow-sm"
                    >
                      <Clapperboard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-bold text-sm text-foreground flex items-center gap-1.5">
                        <span>{currentSelectedShooting.name}</span>
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-bold text-success">
                          ✓ স্বয়ংক্রিয়ভাবে নির্বাচিত
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {currentSelectedShooting.channel && (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Tv className="h-3 w-3" /> {currentSelectedShooting.channel}
                          </span>
                        )}
                        {currentSelectedShooting.director && (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <UserCog className="h-3 w-3" /> {currentSelectedShooting.director}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <span className="font-bold">এই তারিখে ({bnDate(date)}) কোনো শুটিং তালিকাভুক্ত নেই।</span>
                  <p className="mt-0.5 text-[11.5px] text-amber-800/90 dark:text-amber-300/90">
                    হাজিরা নেওয়ার জন্য নিচের ইনপুটে শুটিংয়ের নাম লিখুন অথবা{" "}
                    <Link to="/shootings" className="font-bold underline text-amber-950 dark:text-amber-100">
                      শুটিং তালিকা পেজ
                    </Link>{" "}
                    থেকে শুটিং তৈরি করুন।
                  </p>
                </div>
              </div>

              {showAddShootingInline || !shootingName ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="শুটিংয়ের নাম লিখুন (যেমন: নাটকের নাম)..."
                    value={customShootingInput}
                    onChange={(e) => setCustomShootingInput(e.target.value)}
                    className="h-11 rounded-2xl font-medium"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customShootingInput.trim()) {
                        setShootingName(customShootingInput.trim());
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (customShootingInput.trim()) {
                        setShootingName(customShootingInput.trim());
                        toast.success(`"${customShootingInput.trim()}" শুটিং নির্বাচন করা হয়েছে`);
                      } else {
                        toast.error("শুটিংয়ের নাম লিখুন");
                      }
                    }}
                    className="h-11 px-4 rounded-2xl shrink-0"
                  >
                    নিশ্চিত করুন
                  </Button>
                </div>
              ) : null}

              {shootingName.trim() && shootingsOnDate.length === 0 && (
                <div className="flex items-center justify-between rounded-2xl border bg-card p-3 text-xs">
                  <span className="font-semibold text-foreground">
                    নির্বাচিত শুটিং: <strong className="text-primary">{shootingName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShootingName("");
                      setShowAddShootingInline(true);
                    }}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    নাম পরিবর্তন
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* সামারি বার */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
          <span className="text-xs font-semibold text-muted-foreground">{bnDate(date)}</span>
          <span className="text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full">
            মোট উপস্থিত: {toBn(presentCount)}/{toBn(members.length)} জন
          </span>
        </div>
      </div>

      {/* ৩. কর্মীদের হাজিরা তালিকা */}
      {!shootingName.trim() ? (
        <div className="rounded-3xl border border-dashed bg-card/60 p-8 text-center space-y-2">
          <Clapperboard className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-muted-foreground">
            হাজিরা নেওয়ার জন্য তারিখের শুটিং নির্বাচন করুন
          </p>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card/60 p-8 text-center space-y-2">
          <CalendarCheck className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-muted-foreground">কোনো দৈনিক কর্মী পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              দৈনিক কর্মীদের তালিকা ({toBn(members.length)} জন)
            </span>
            {pendingCount > 0 && (
              <span className="text-xs font-bold text-primary animate-pulse">
                {toBn(pendingCount)} জনের পরিবর্তন পেন্ডিং
              </span>
            )}
          </div>

          {members.map((m) => {
            const rec = marked[m.id];
            const isMarked = rec !== undefined;
            const pendingVal = pending[m.id];
            const hasPending = pendingVal !== undefined;
            const status = isMarked ? rec!.present : pendingVal;
            return (
              <div
                key={m.id}
                className={`rounded-2xl border bg-card p-3.5 transition-all ${
                  hasPending ? "border-primary ring-2 ring-primary/20 shadow-md" : "hover:border-border/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <MemberAvatar name={m.name} photoUrl={m.photo_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-sm">{m.name}</div>
                    {m.role ? <div className="text-xs text-muted-foreground">{m.role}</div> : null}
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      দৈনিক বেতন: ৳
                      {toBn(
                        isMarked && rec!.rate_override != null
                          ? rec!.rate_override
                          : (m.rate ?? 0),
                      )}
                      {isMarked && rec!.rate_override != null && (
                        <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold text-primary">
                          কাস্টম
                        </span>
                      )}
                    </div>
                    {hasPending && (
                      <div className="text-[10.5px] font-bold text-primary mt-0.5">
                        * সেভ করার জন্য অপেক্ষারত
                      </div>
                    )}
                  </div>

                  {isMarked ? (
                    <button
                      onClick={() => setEditMember(m)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition shadow-sm ${
                        status
                          ? "border-success bg-success/15 text-success hover:bg-success/25"
                          : "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/25"
                      }`}
                    >
                      {status ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      {status ? "উপস্থিত" : "অনুপস্থিত"}
                      <Pencil className="h-3 w-3 opacity-60 ml-0.5" />
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPending((p) => ({ ...p, [m.id]: true }))}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition shadow-sm ${
                          pendingVal === true
                            ? "border-success bg-success text-success-foreground scale-105"
                            : "border-border text-muted-foreground hover:border-success hover:text-success hover:bg-success/5"
                        }`}
                        title="উপস্থিত চিহ্নিত করুন"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setPending((p) => ({ ...p, [m.id]: false }));
                          setPendingRate((r) => {
                            const n = { ...r };
                            delete n[m.id];
                            return n;
                          });
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition shadow-sm ${
                          pendingVal === false
                            ? "border-destructive bg-destructive text-destructive-foreground scale-105"
                            : "border-border text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/5"
                        }`}
                        title="অনুপস্থিত চিহ্নিত করুন"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>

                {pendingVal === true && (
                  <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2">
                    <label className="text-xs font-semibold text-muted-foreground shrink-0">আজকের মজুরি (৳):</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder={String(m.rate ?? 0)}
                      value={pendingRate[m.id] ?? ""}
                      onChange={(e) => setPendingRate((r) => ({ ...r, [m.id]: e.target.value }))}
                      className="h-9 flex-1 text-xs font-semibold rounded-xl"
                    />
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      (ডিফল্ট: ৳{toBn(m.rate ?? 0)})
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ভাসমান সেভ বাটন (Floating Save Bar) */}
      {pendingCount > 0 && (
        <div className="sticky bottom-20 z-20 flex gap-2 rounded-3xl border bg-card/95 backdrop-blur-lg p-2.5 shadow-2xl">
          <Button
            variant="outline"
            onClick={() => {
              setPending({});
              setPendingRate({});
            }}
            disabled={saveAll.isPending}
            className="flex-1 rounded-2xl h-12 text-sm font-semibold"
          >
            বাতিল
          </Button>
          <Button
            onClick={() => saveAll.mutate()}
            disabled={saveAll.isPending}
            className="flex-[2] gap-2 rounded-2xl h-12 text-sm font-bold shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="h-4 w-4" />
            {saveAll.isPending ? "সেভ হচ্ছে..." : `হাজিরা সেভ করুন (${toBn(pendingCount)})`}
          </Button>
        </div>
      )}

      {/* ৪. হাজিরার ইতিহাস (Attendance History) */}
      <div className="space-y-3 pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">হাজিরার ইতিহাস</h2>
          </div>
          {historyDate && (
            <button
              onClick={() => setHistoryDate("")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              সব ইতিহাস দেখুন
            </button>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">তারিখ অনুযায়ী ফিল্টার করুন</label>
          <Input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="h-10 rounded-2xl"
          />
        </div>

        {(() => {
          const filtered = historyDate
            ? historyGroups.filter((g) => g.date === historyDate)
            : historyGroups;
          if (filtered.length === 0) {
            return (
              <div className="rounded-3xl border border-dashed bg-card/60 p-6 text-center">
                <p className="text-sm text-muted-foreground font-medium">
                  {historyDate
                    ? `${bnDate(historyDate)} তারিখে কোনো হাজিরার রেকর্ড নেই`
                    : "এখনো কোনো হাজিরার রেকর্ড নেই"}
                </p>
              </div>
            );
          }
          return (
            <div className="space-y-2.5">
              {filtered.map((g, i) => (
                <details
                  key={i}
                  className="group rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden transition-all shadow-sm"
                  open={!!historyDate}
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-3 p-3.5 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{bnDate(g.date)}</div>
                      {g.shooting && (
                        <div className="truncate text-xs text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                          <Clapperboard className="h-3.5 w-3.5 text-primary" /> {g.shooting}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
                        <Check className="inline h-3 w-3 mr-0.5" /> {toBn(g.present.length)} জন
                      </span>
                      <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive">
                        <X className="inline h-3 w-3 mr-0.5" /> {toBn(g.absent.length)} জন
                      </span>
                    </div>
                  </summary>
                  <div className="border-t px-4 py-3 text-xs space-y-2 bg-muted/10">
                    {g.present.length > 0 && (
                      <div>
                        <span className="font-bold text-success">উপস্থিত ({toBn(g.present.length)}): </span>
                        <span className="text-foreground">{g.present.join("， ")}</span>
                      </div>
                    )}
                    {g.absent.length > 0 && (
                      <div>
                        <span className="font-bold text-destructive">অনুপস্থিত ({toBn(g.absent.length)}): </span>
                        <span className="text-muted-foreground">{g.absent.join("， ")}</span>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ৫. হাজিরা এডিট ডায়লগ */}
      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Pencil className="h-4 w-4 text-primary" /> হাজিরা সংশোধন
            </DialogTitle>
          </DialogHeader>
          {editMember && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                <MemberAvatar name={editMember.name} photoUrl={editMember.photo_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-sm">{editMember.name}</div>
                  <div className="text-xs text-muted-foreground">{bnDate(date)}</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  আজকের মজুরি (ডিফল্ট ৳{toBn(editMember.rate ?? 0)})
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  placeholder={String(editMember.rate ?? 0)}
                  className="h-11 rounded-2xl font-semibold text-sm"
                />
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-muted-foreground">উপস্থিতি অবস্থা পরিবর্তন</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const num = editRate !== "" ? Number(editRate) : NaN;
                      const ro = !Number.isNaN(num) && num !== (editMember.rate ?? null) ? num : null;
                      mark.mutate({ memberId: editMember.id, present: true, rate_override: ro });
                      setEditMember(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-bold transition shadow-sm ${
                      marked[editMember.id]?.present
                        ? "border-success bg-success text-success-foreground"
                        : "border-border hover:border-success hover:text-success hover:bg-success/5"
                    }`}
                  >
                    <Check className="h-4 w-4" /> উপস্থিত
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      mark.mutate({ memberId: editMember.id, present: false, rate_override: null });
                      setEditMember(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-bold transition shadow-sm ${
                      marked[editMember.id]?.present === false
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-border hover:border-destructive hover:text-destructive hover:bg-destructive/5"
                    }`}
                  >
                    <X className="h-4 w-4" /> অনুপস্থিত
                  </button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <ConfirmDelete
              trigger={
                <Button variant="destructive" className="w-full gap-2 rounded-2xl h-11 text-xs font-bold">
                  <Trash2 className="h-4 w-4" /> এই দিনের হাজিরা ডিলিট করুন
                </Button>
              }
              title="হাজিরা ডিলিট করবেন?"
              description={editMember ? `${editMember.name}-এর ${bnDate(date)} তারিখের হাজিরা মুছে ফেলা হবে।` : ""}
              relatedItems={["এই দিনের জন্য কর্মীর প্রাপ্য টাকার হিসাব ব্যালেন্স থেকে কমে যাবে"]}
              onConfirm={() => {
                if (editMember) removeAttendance.mutate(editMember.id);
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
