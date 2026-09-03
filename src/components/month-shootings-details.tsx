import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBn, bnDate } from "@/lib/format";
import { useChannels, getChannelColor } from "@/lib/brand";
import { Clapperboard, ChevronDown, ChevronLeft, ChevronRight, Calendar, Users, Receipt, MapPin } from "lucide-react";

type Shooting = {
  id: string;
  name: string;
  shoot_date: string;
  location: string | null;
  director: string | null;
  channel: string | null;
};

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

export function MonthShootingsDetails() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = `${BN_MONTHS[month]} ${toBn(String(year))}`;
  const monthStart = new Date(year, month, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const { data: shootings = [], isLoading } = useQuery({
    queryKey: ["month-shootings", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shootings")
        .select("id, name, shoot_date, location, director, channel")
        .gte("shoot_date", monthStart)
        .lte("shoot_date", monthEnd)
        .order("shoot_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Shooting[];
    },
  });

  const ids = shootings.map((s) => s.id);
  const summaries = useQuery({
    queryKey: ["month-shooting-summaries", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const out: Record<string, { total: number; att: number; extra: number; present: number }> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { data } = await supabase.rpc("shooting_summary", { _shooting_id: id });
          const r = (data as { total_cost?: number; attendance_cost?: number; extra_cost?: number; present_count?: number }[] | null)?.[0];
          out[id] = {
            total: Number(r?.total_cost ?? 0),
            att: Number(r?.attendance_cost ?? 0),
            extra: Number(r?.extra_cost ?? 0),
            present: Number(r?.present_count ?? 0),
          };
        }),
      );
      return out;
    },
  });

  const totals = useMemo(() => {
    const s = summaries.data ?? {};
    return Object.values(s).reduce(
      (acc, r) => ({ total: acc.total + r.total, att: acc.att + r.att, extra: acc.extra + r.extra }),
      { total: 0, att: 0, extra: 0 },
    );
  }, [summaries.data]);

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clapperboard className="h-4 w-4 text-primary" /> শুটিং বিবরণ ও খরচ
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:bg-muted/70"
            aria-label="আগের মাস"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[110px] text-center text-xs font-semibold text-primary">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:bg-muted/70"
            aria-label="পরের মাস"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">লোড হচ্ছে…</div>}
      {!isLoading && shootings.length === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">এই মাসে কোনো শুটিং নেই</div>
      )}

      {shootings.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl bg-primary/10 p-3 text-center">
            <div>
              <div className="text-[10px] text-muted-foreground">শুটিং</div>
              <div className="text-sm font-bold text-primary">{toBn(shootings.length)} টি</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">হাজিরা খরচ</div>
              <div className="text-sm font-bold">{taka(totals.att)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">মোট খরচ</div>
              <div className="text-sm font-bold text-primary">{taka(totals.total)}</div>
            </div>
          </div>

          <ul className="space-y-2">
            {shootings.map((s) => (
              <ShootingRow key={s.id} shooting={s} summary={summaries.data?.[s.id]} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type AttRow = {
  id: string;
  present: boolean;
  rate_override: number | null;
  members: { id: string; name: string; rate: number; photo_url: string | null } | null;
};

type ExpRow = { id: string; amount: number; note: string | null; spent_at: string };

function ShootingRow({
  shooting: s,
  summary,
}: {
  shooting: Shooting;
  summary: { total: number; att: number; extra: number; present: number } | undefined;
}) {
  const [open, setOpen] = useState(false);
  const { data: channels = [] } = useChannels();
  const channelColor = getChannelColor(s.channel, channels);

  const attendance = useQuery({
    queryKey: ["shooting-attendance-detail", s.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, present, rate_override, members(id, name, rate, photo_url)")
        .eq("shooting_id", s.id)
        .eq("present", true);
      if (error) throw error;
      return (data ?? []) as unknown as AttRow[];
    },
  });

  const expenses = useQuery({
    queryKey: ["shooting-expenses-detail", s.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_expenses")
        .select("id, amount, note, spent_at")
        .eq("shooting_id", s.id)
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExpRow[];
    },
  });

  return (
    <li
      style={{ borderColor: channelColor ? `${channelColor}45` : undefined }}
      className="rounded-2xl border bg-background shadow-sm overflow-hidden transition hover:shadow-md"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span
          style={{
            backgroundColor: channelColor,
            boxShadow: `0 4px 12px ${channelColor}35`,
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white shadow-md"
        >
          <Clapperboard className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              style={{ color: channelColor }}
              className="truncate text-sm font-bold text-foreground"
            >
              {s.name}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <Calendar className="h-3 w-3 text-primary" /> {bnDate(s.shoot_date)}
            </span>
            {s.channel && (
              <span
                style={{
                  color: channelColor,
                  backgroundColor: `${channelColor}18`,
                  borderColor: `${channelColor}30`,
                }}
                className="rounded-full border px-2 py-0.2 text-[10px] font-bold"
              >
                {s.channel}
              </span>
            )}
            {summary && (
              <span className="inline-flex items-center gap-0.5 text-[10.5px]">
                <Users className="h-3 w-3 text-muted-foreground" /> {toBn(summary.present)} জন
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">মোট খরচ</div>
          <div className="text-sm font-black text-primary">{taka(summary?.total ?? 0)}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 p-3">
          {(s.location || s.director || s.channel) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {s.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.location}</span>}
              {s.director && <span>পরিচালক: {s.director}</span>}
              {s.channel && <span>চ্যানেল: {s.channel}</span>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-2 text-center text-[11px]">
            <div>
              <div className="text-muted-foreground">হাজিরা খরচ</div>
              <div className="font-semibold">{taka(summary?.att ?? 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">অতিরিক্ত খরচ</div>
              <div className="font-semibold">{taka(summary?.extra ?? 0)}</div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Users className="h-3.5 w-3.5 text-primary" /> হাজিরা তালিকা
            </div>
            {attendance.isLoading ? (
              <div className="py-2 text-center text-xs text-muted-foreground">লোড হচ্ছে…</div>
            ) : (attendance.data ?? []).length === 0 ? (
              <div className="rounded-lg bg-muted/30 py-2 text-center text-xs text-muted-foreground">কোনো হাজিরা নেই</div>
            ) : (
              <ul className="space-y-1">
                {(attendance.data ?? []).map((a, i) => {
                  const rate = a.rate_override ?? a.members?.rate ?? 0;
                  return (
                    <li key={a.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs">
                      <span className="w-5 shrink-0 text-center text-[10px] text-muted-foreground">{toBn(i + 1)}.</span>
                      <div className="min-w-0 flex-1 truncate">{a.members?.name ?? "—"}</div>
                      <span className={`shrink-0 font-semibold ${Number(rate) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {Number(rate) > 0 ? taka(Number(rate)) : "মাসিক"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Receipt className="h-3.5 w-3.5 text-primary" /> অতিরিক্ত খরচ
            </div>
            {expenses.isLoading ? (
              <div className="py-2 text-center text-xs text-muted-foreground">লোড হচ্ছে…</div>
            ) : (expenses.data ?? []).length === 0 ? (
              <div className="rounded-lg bg-muted/30 py-2 text-center text-xs text-muted-foreground">কোনো অতিরিক্ত খরচ নেই</div>
            ) : (
              <ul className="space-y-1">
                {(expenses.data ?? []).map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs">
                    <span className="w-5 shrink-0 text-center text-[10px] text-muted-foreground">{toBn(i + 1)}.</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-muted-foreground">{bnDate(e.spent_at)}</div>
                      {e.note && <div className="truncate">{e.note}</div>}
                    </div>
                    <span className="shrink-0 font-semibold text-primary">{taka(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
