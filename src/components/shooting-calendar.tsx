import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBn, bnDate } from "@/lib/format";
import { useChannels, getChannelColor } from "@/lib/brand";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  MapPin,
  Users,
  Receipt,
  Sparkles,
  Tv,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

const BN_WEEKDAYS = [
  { name: "রবি", isWeekend: false },
  { name: "সোম", isWeekend: false },
  { name: "মঙ্গল", isWeekend: false },
  { name: "বুধ", isWeekend: false },
  { name: "বৃহঃ", isWeekend: false },
  { name: "শুক্র", isWeekend: true, color: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
  { name: "শনি", isWeekend: true, color: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
];

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Shooting = {
  id: string;
  name: string;
  shoot_date: string;
  location: string | null;
  director: string | null;
  channel: string | null;
};

export function ShootingCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: channels = [] } = useChannels();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthStart = fmt(new Date(year, month, 1));
  const monthEnd = fmt(new Date(year, month + 1, 0));

  const { data: shootings = [], isLoading } = useQuery({
    queryKey: ["calendar-shootings", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shootings")
        .select("id, name, shoot_date, location, director, channel")
        .gte("shoot_date", monthStart)
        .lte("shoot_date", monthEnd);
      if (error) throw error;
      return (data ?? []) as Shooting[];
    },
  });

  const byDay = useMemo(() => {
    const m: Record<number, Shooting[]> = {};
    shootings.forEach((s) => {
      if (!s.shoot_date) return;
      const d = parseInt(s.shoot_date.slice(8, 10), 10);
      if (!isNaN(d)) {
        (m[d] ||= []).push(s);
      }
    });
    return m;
  }, [shootings]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const selectedShootings = selectedDate
    ? shootings.filter((s) => s.shoot_date && s.shoot_date.slice(0, 10) === selectedDate)
    : [];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-card via-card to-background p-4 sm:p-5 shadow-lg">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-rose-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-primary to-rose-500 text-white shadow-md shadow-primary/25">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
              শুটিং ক্যালেন্ডার
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </h2>
            <p className="text-[11px] text-muted-foreground">তারিখ অনুযায়ী শুটিং সূচি ও তথ্য</p>
          </div>
        </div>

        {/* Month Switcher */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-primary/20 bg-primary/5 p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="grid h-8 w-8 place-items-center rounded-xl bg-background/80 text-foreground shadow-sm transition hover:bg-primary hover:text-white active:scale-95"
            aria-label="আগের মাস"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-xs font-black text-primary px-2">
            {BN_MONTHS[month]} {toBn(String(year))}
          </span>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="grid h-8 w-8 place-items-center rounded-xl bg-background/80 text-foreground shadow-sm transition hover:bg-primary hover:text-white active:scale-95"
            aria-label="পরের মাস"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-bold">
        {BN_WEEKDAYS.map((w) => (
          <div
            key={w.name}
            className={`py-1 rounded-xl text-[11px] ${
              w.color || "text-muted-foreground/90 bg-muted/30"
            }`}
          >
            {w.name}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) {
            return <div key={i} className="min-h-[62px] rounded-2xl bg-transparent" />;
          }

          const items = byDay[d];
          const has = !!items?.length;
          const isToday = isCurrentMonth && d === today.getDate();
          const firstName = items?.[0]?.name || "";
          const firstChannel = items?.[0]?.channel || "";
          const channelColor = has ? getChannelColor(firstChannel, channels) : undefined;

          return (
            <button
              type="button"
              key={i}
              disabled={!has}
              onClick={() => has && setSelectedDate(fmt(new Date(year, month, d)))}
              title={items?.map((x) => `${x.name} (${x.channel || "চ্যানেলহীন"})`).join(", ")}
              style={{
                borderColor: channelColor ? `${channelColor}80` : undefined,
                backgroundColor: channelColor ? `${channelColor}12` : undefined,
              }}
              className={`group relative min-h-[62px] sm:min-h-[68px] p-1.5 rounded-2xl text-left flex flex-col justify-between transition-all duration-200 ${
                has
                  ? "border-2 shadow-sm hover:shadow-md hover:scale-[1.03] cursor-pointer active:scale-95"
                  : "bg-background/70 hover:bg-accent/40 text-muted-foreground cursor-default border border-border/40"
              } ${
                isToday
                  ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background font-bold"
                  : ""
              }`}
            >
              {/* Date Header inside cell */}
              <div className="flex w-full items-center justify-between">
                <span
                  style={{ color: channelColor || undefined }}
                  className={`text-xs ${
                    has
                      ? "font-black text-sm"
                      : isToday
                        ? "font-bold text-emerald-600 dark:text-emerald-400"
                        : "font-semibold text-foreground/80"
                  }`}
                >
                  {toBn(d)}
                </span>
                {has && (
                  <span
                    style={{ backgroundColor: channelColor || undefined }}
                    className="grid h-4 w-4 place-items-center rounded-full text-white text-[9px] font-bold shadow-sm"
                  >
                    🎬
                  </span>
                )}
              </div>

              {/* Highlighted Shooting Name Badge with Channel Color */}
              {has ? (
                <div className="w-full mt-1">
                  <div
                    style={{
                      backgroundColor: channelColor || undefined,
                      boxShadow: channelColor ? `0 2px 8px ${channelColor}40` : undefined,
                    }}
                    className="w-full truncate rounded-xl px-1.5 py-1 text-[9.5px] sm:text-[10px] font-black text-white group-hover:brightness-110 transition flex items-center gap-1"
                    title={`${firstName} (${firstChannel})`}
                  >
                    <span className="truncate">{firstName}</span>
                  </div>
                </div>
              ) : (
                <div className="h-4" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend & Summary */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-md bg-gradient-to-r from-rose-500 to-amber-500 shadow-sm" /> চ্যানেলের ব্র্যান্ড কালার
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3 w-3 rounded-md ring-2 ring-emerald-500 bg-emerald-500/20" /> আজকের দিন
          </span>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          এই মাসে শুটিং: {toBn(shootings.length)} টি
        </span>
      </div>

      {/* Shooting Detail Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg rounded-3xl border-primary/30 p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </span>
              {selectedDate && bnDate(selectedDate)} — {toBn(selectedShootings.length)} টি শুটিং
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {selectedShootings.map((s) => (
              <ShootingDetailCard key={s.id} shooting={s} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type AttRow = {
  id: string;
  rate_override: number | null;
  members: { name: string; rate: number } | null;
};

type ExpRow = { id: string; amount: number; note: string | null };

function ShootingDetailCard({ shooting: s }: { shooting: Shooting }) {
  const { data: channels = [] } = useChannels();
  const channelColor = getChannelColor(s.channel, channels);

  const summary = useQuery({
    queryKey: ["shooting-summary", s.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("shooting_summary", { _shooting_id: s.id });
      const r = (data as { total_cost?: number; attendance_cost?: number; extra_cost?: number; present_count?: number }[] | null)?.[0];
      return {
        total: Number(r?.total_cost ?? 0),
        att: Number(r?.attendance_cost ?? 0),
        extra: Number(r?.extra_cost ?? 0),
        present: Number(r?.present_count ?? 0),
      };
    },
  });

  const attendance = useQuery({
    queryKey: ["shooting-attendance-detail", s.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, rate_override, members(name, rate)")
        .eq("shooting_id", s.id)
        .eq("present", true);
      if (error) throw error;
      return (data ?? []) as unknown as AttRow[];
    },
  });

  const expenses = useQuery({
    queryKey: ["shooting-expenses-detail", s.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_expenses")
        .select("id, amount, note")
        .eq("shooting_id", s.id);
      if (error) throw error;
      return (data ?? []) as ExpRow[];
    },
  });

  return (
    <div
      style={{ borderColor: `${channelColor}40` }}
      className="rounded-3xl border bg-gradient-to-b from-card to-muted/20 p-4 space-y-3 shadow-md"
    >
      <div className="flex items-start gap-3">
        <span
          style={{
            backgroundColor: channelColor,
            boxShadow: `0 4px 12px ${channelColor}40`,
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white shadow-md"
        >
          <Clapperboard className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold text-foreground tracking-tight">{s.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {s.channel && (
              <span
                style={{
                  color: channelColor,
                  backgroundColor: `${channelColor}18`,
                  borderColor: `${channelColor}35`,
                }}
                className="rounded-lg border px-2 py-0.5 font-bold flex items-center gap-1"
              >
                <Tv className="h-3 w-3" /> {s.channel}
              </span>
            )}
            {s.director && (
              <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> {s.director}
              </span>
            )}
            {s.location && (
              <span className="rounded-lg bg-muted px-2 py-0.5 text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {s.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3 Metric cards */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-primary/10 p-2.5 text-center">
        <div className="rounded-xl bg-background/70 p-1.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground font-medium">হাজিরা সংখ্যা</div>
          <div className="text-xs font-black text-primary">{toBn(summary.data?.present ?? 0)} জন</div>
        </div>
        <div className="rounded-xl bg-background/70 p-1.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground font-medium">হাজিরা খরচ</div>
          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{taka(summary.data?.att ?? 0)}</div>
        </div>
        <div className="rounded-xl bg-background/70 p-1.5 shadow-sm">
          <div className="text-[10px] text-muted-foreground font-medium">মোট খরচ</div>
          <div className="text-xs font-black text-rose-600 dark:text-rose-400">{taka(summary.data?.total ?? 0)}</div>
        </div>
      </div>

      {/* Attendees list */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Users className="h-3.5 w-3.5 text-primary" /> উপস্থিত সদস্যদের হাজিরা ({toBn((attendance.data ?? []).length)})
        </div>
        {(attendance.data ?? []).length === 0 ? (
          <div className="rounded-xl bg-muted/40 py-2 text-center text-xs text-muted-foreground">কোনো সদস্য উপস্থিত নেই</div>
        ) : (
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(attendance.data ?? []).map((a, i) => {
              const rate = a.rate_override ?? a.members?.rate ?? 0;
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-background border p-2 text-xs">
                  <span className="truncate font-medium text-foreground">{a.members?.name ?? "—"}</span>
                  <span className={`shrink-0 font-bold ${Number(rate) > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {Number(rate) > 0 ? taka(Number(rate)) : "মাসিক"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Expenses */}
      {(expenses.data ?? []).length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Receipt className="h-3.5 w-3.5 text-primary" /> অতিরিক্ত খরচ তালিকা
          </div>
          <ul className="space-y-1">
            {(expenses.data ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-background border p-2 text-xs">
                <span className="truncate text-muted-foreground">{e.note || "অতিরিক্ত খরচ"}</span>
                <span className="shrink-0 font-black text-primary">{taka(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
