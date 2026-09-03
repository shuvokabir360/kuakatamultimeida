import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBn, bnDate } from "@/lib/format";
import { Wallet, CalendarCheck, ChevronDown } from "lucide-react";

type PaymentRow = { id: string; amount: number; paid_at: string; note: string | null };
type AttendanceRow = {
  id: string;
  date: string;
  present: boolean;
  rate_override: number | null;
  shooting_id: string | null;
  shootings: { name: string } | null;
};

export function MemberHistory({ memberId, memberRate }: { memberId: string; memberRate: number }) {
  const [tab, setTab] = useState<"payments" | "attendance">("payments");

  const payments = useQuery({
    queryKey: ["member-payments", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, paid_at, note")
        .eq("member_id", memberId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });

  const attendance = useQuery({
    queryKey: ["member-attendance", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, date, present, rate_override, shooting_id, shootings(name)")
        .eq("member_id", memberId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  const totalPaid = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const presentDays = (attendance.data ?? []).filter((a) => a.present).length;

  return (
    <div className="rounded-2xl border bg-card">
      <div className="grid grid-cols-2 gap-1 rounded-t-2xl bg-muted/40 p-1">
        <TabBtn
          active={tab === "payments"}
          onClick={() => setTab("payments")}
          Icon={Wallet}
          label="পেমেন্ট"
          badge={toBn(payments.data?.length ?? 0)}
        />
        <TabBtn
          active={tab === "attendance"}
          onClick={() => setTab("attendance")}
          Icon={CalendarCheck}
          label="হাজিরা"
          badge={toBn(presentDays)}
        />
      </div>

      {tab === "payments" ? (
        <div>
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="text-muted-foreground">মোট পরিশোধিত</span>
            <b className="text-success">{taka(totalPaid)}</b>
          </div>
          {payments.isLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">লোড হচ্ছে…</div>
          ) : (payments.data ?? []).length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">কোনো পেমেন্ট নেই</div>
          ) : (
            <ScrollList>
              {(payments.data ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{bnDate(p.paid_at)}</div>
                    {p.note && <div className="truncate text-[11px] text-muted-foreground">{p.note}</div>}
                  </div>
                  <b className="shrink-0 text-sm text-success">{taka(Number(p.amount))}</b>
                </li>
              ))}
            </ScrollList>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="text-muted-foreground">উপস্থিত দিন</span>
            <b>{toBn(presentDays)} দিন</b>
          </div>
          {attendance.isLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">লোড হচ্ছে…</div>
          ) : (attendance.data ?? []).length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">কোনো হাজিরা নেই</div>
          ) : (
            <ScrollList>
              {(attendance.data ?? []).map((a) => {
                const rate = a.rate_override ?? memberRate;
                return (
                  <li key={a.id} className="flex items-start justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs">{bnDate(a.date)}</div>
                      {a.shootings?.name && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {a.shootings.name}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          a.present
                            ? "bg-success/15 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {a.present ? "উপস্থিত" : "অনুপস্থিত"}
                      </span>
                      {a.present && Number(rate) > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {taka(Number(rate))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ScrollList>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
        {badge}
      </span>
    </button>
  );
}

function ScrollList({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <ul
        className={`divide-y overflow-y-auto ${expanded ? "max-h-[60vh]" : "max-h-64"}`}
      >
        {children}
      </ul>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-center gap-1 rounded-b-2xl border-t bg-muted/30 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/50"
      >
        <ChevronDown className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "সংক্ষিপ্ত" : "সব দেখুন"}
      </button>
    </>
  );
}
