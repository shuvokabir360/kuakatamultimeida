import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tv,
  ChevronRight,
  Plus,
  ArrowLeft,
  Calendar,
  Trash2,
  BadgeDollarSign,
  Wallet,
  Receipt,
  CircleAlert,
  Search,
  CheckCircle2,
  Clock,
  Clapperboard,
  History,
} from "lucide-react";
import { taka, toBn, bnDate } from "@/lib/format";
import { BrandAvatar, useChannels } from "@/lib/brand";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";

const clientDuesSearchSchema = z.object({
  channel: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/client-dues")({
  validateSearch: clientDuesSearchSchema,
  component: ClientDuesPage,
});

type Summary = {
  channel: string;
  shooting_count: number;
  contract_total: number;
  received_total: number;
  due_total: number;
};

function ClientDuesPage() {
  const search = useSearch({ from: "/_authenticated/client-dues" });
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(search.channel ?? null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (search.channel !== undefined) {
      setSelected(search.channel || null);
    }
  }, [search.channel]);

  const handleSelect = (channelName: string | null) => {
    setSelected(channelName);
    navigate({
      search: (prev: any) => ({
        ...prev,
        channel: channelName || undefined,
      }),
    });
  };

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["client-channel-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("client_channel_summary");
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      const map = new Map<string, Summary>();

      for (const r of list) {
        if (!r || !r.channel) continue;
        const key = String(r.channel).trim();
        const shooting_count = Number(r.shooting_count) || 0;
        const contract_total = Number(r.contract_total) || 0;
        const received_total = Number(r.received_total) || 0;
        const due_total = Number(r.due_total) || (contract_total - received_total);

        const lowerKey = key.toLowerCase();
        if (map.has(lowerKey)) {
          const prev = map.get(lowerKey)!;
          prev.shooting_count = Math.max(prev.shooting_count, shooting_count);
          prev.contract_total = Math.max(prev.contract_total, contract_total);
          prev.received_total = Math.max(prev.received_total, received_total);
          prev.due_total = prev.contract_total - prev.received_total;
        } else {
          map.set(lowerKey, {
            channel: key,
            shooting_count,
            contract_total,
            received_total,
            due_total,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.due_total - a.due_total);
    },
  });

  const filteredSummary = useMemo(() => {
    if (!query.trim()) return summary;
    const q = query.trim().toLowerCase();
    return summary.filter((s) => s.channel.toLowerCase().includes(q));
  }, [summary, query]);

  const totals = useMemo(() => {
    return summary.reduce(
      (acc, s) => ({
        contract: acc.contract + (Number(s.contract_total) || 0),
        received: acc.received + (Number(s.received_total) || 0),
        due: acc.due + (Number(s.due_total) || 0),
      }),
      { contract: 0, received: 0, due: 0 },
    );
  }, [summary]);

  if (selected) {
    return <ChannelDetail channel={selected} onBack={() => handleSelect(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ক্লায়েন্ট হিসাব</h1>
          <p className="text-xs text-muted-foreground">বাহিরের ক্লায়েন্ট চ্যানেলের পাওনা, চুক্তি ও প্রাপ্তি ব্যবস্থাপনা</p>
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          মোট ক্লায়েন্ট: <span className="font-bold text-foreground">{toBn(summary.length)}</span> টি
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <CompactStatCard
          label="মোট চুক্তি/পাওনা"
          value={taka(totals.contract)}
          subtext="সর্বমোট কাজের চুক্তি"
          Icon={Receipt}
          variant="primary"
        />
        <CompactStatCard
          label="সর্বমোট প্রাপ্ত"
          value={taka(totals.received)}
          subtext="জমা হয়েছে"
          Icon={Wallet}
          variant="success"
        />
        <CompactStatCard
          label="সর্বমোট বকেয়া"
          value={taka(totals.due)}
          subtext={totals.due > 0 ? "পাওনা বাকি আছে" : "কোনো বকেয়া নেই"}
          Icon={CircleAlert}
          variant={totals.due > 0 ? "danger" : "success"}
        />
      </div>

      {/* Search Input */}
      {summary.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ক্লায়েন্ট চ্যানেল খুঁজুন..."
            className="h-10 rounded-2xl pl-9 text-xs"
          />
        </div>
      )}

      {/* Loading & Empty State */}
      {isLoading && (
        <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
          ক্লায়েন্ট হিসাব লোড হচ্ছে…
        </div>
      )}

      {!isLoading && summary.length === 0 && (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
          <Tv className="mx-auto mb-2 h-10 w-10 text-muted-foreground/60" />
          <h3 className="text-sm font-semibold">এখনও কোনো বাহিরের চ্যানেল নেই</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            শুটিং যোগ করার সময় বাইরের চ্যানেলের নাম লিখুন বা ডিরেক্টরি পেজে চ্যানেল যুক্ত করুন
          </p>
        </div>
      )}

      {/* Channels List */}
      {!isLoading && filteredSummary.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSummary.map((s) => (
            <ChannelCard key={s.channel} data={s} onClick={() => handleSelect(s.channel)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompactStatCard({
  label,
  value,
  subtext,
  Icon,
  variant,
}: {
  label: string;
  value: string;
  subtext?: string;
  Icon: React.ComponentType<{ className?: string }>;
  variant: "primary" | "success" | "danger";
}) {
  const styles = {
    primary: {
      card: "bg-primary/5 border-primary/20",
      icon: "bg-primary/10 text-primary",
      val: "text-foreground",
    },
    success: {
      card: "bg-emerald-500/5 border-emerald-500/20",
      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      val: "text-emerald-600 dark:text-emerald-400",
    },
    danger: {
      card: "bg-rose-500/5 border-rose-500/20",
      icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      val: "text-rose-600 dark:text-rose-400",
    },
  }[variant];

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition ${styles.card}`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${styles.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className={`text-base font-bold tracking-tight ${styles.val}`}>{value}</div>
        {subtext && <div className="text-[10px] text-muted-foreground/80">{subtext}</div>}
      </div>
    </div>
  );
}

function ChannelCard({ data, onClick }: { data: Summary; onClick: () => void }) {
  const { data: channels = [] } = useChannels();
  const ch = channels.find((c) => c.name.toLowerCase() === data.channel.toLowerCase());
  const isCleared = data.due_total <= 0;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-accent/30 hover:shadow active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <BrandAvatar kind="channel" name={data.channel} src={ch?.logo_url} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h3 className="truncate font-bold text-sm text-foreground group-hover:text-primary transition">
              {data.channel}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                isCleared
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              }`}
            >
              {isCleared ? "পরিশোধিত" : "বকেয়া আছে"}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {toBn(data.shooting_count)} টি শুটিং • চুক্তি: <span className="font-semibold text-foreground">{taka(data.contract_total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          প্রাপ্ত: {taka(data.received_total)}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">বকেয়া:</span>
          <span className={`font-bold ${data.due_total > 0 ? "text-destructive" : "text-emerald-600"}`}>
            {taka(data.due_total)}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
        </div>
      </div>
    </button>
  );
}

type ChannelShooting = {
  id: string;
  name: string;
  shoot_date: string;
  contract_amount: number | null;
};

type ChannelPayment = {
  id: string;
  shooting_id: string | null;
  amount: number;
  received_at: string;
  method: string | null;
  note: string | null;
};

function ChannelDetail({ channel, onBack }: { channel: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: channels = [] } = useChannels();
  const ch = channels.find((c) => c.name.toLowerCase() === channel.toLowerCase());

  const { data: shootings = [], isLoading: shootingsLoading } = useQuery({
    queryKey: ["client-shootings", channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shootings")
        .select("id, name, shoot_date, contract_amount")
        .eq("channel", channel)
        .order("shoot_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChannelShooting[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("id, shooting_id, amount, received_at, method, note")
        .eq("channel", channel)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChannelPayment[];
    },
  });

  // FIFO auto-allocation: total received applied to shootings oldest to newest
  const paidByShooting = useMemo(() => {
    const totalReceived = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const ordered = [...shootings].sort((a, b) =>
      (a.shoot_date || "").localeCompare(b.shoot_date || "")
    );
    const m = new Map<string, number>();
    let pool = totalReceived;

    for (const s of ordered) {
      const contract = Number(s.contract_amount ?? 0);
      if (contract <= 0) {
        m.set(s.id, 0);
        continue;
      }
      const apply = Math.min(pool, contract);
      m.set(s.id, apply);
      pool -= apply;
      if (pool <= 0) pool = 0;
    }
    return m;
  }, [payments, shootings]);

  const unallocated = useMemo(() => {
    const totalReceived = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const contractSum = shootings.reduce(
      (s, x) => s + (Number(x.contract_amount ?? 0) || 0),
      0
    );
    return Math.max(0, totalReceived - contractSum);
  }, [payments, shootings]);

  const contractTotal = shootings.reduce(
    (s, x) => s + (Number(x.contract_amount ?? 0) || 0),
    0
  );
  const receivedTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const dueTotal = contractTotal - receivedTotal;
  const isCleared = dueTotal <= 0;

  const removePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-payments", channel] });
      qc.invalidateQueries({ queryKey: ["client-channel-summary"] });
      toast.success("পেমেন্ট মুছে ফেলা হয়েছে");
    },
  });

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-foreground active:scale-95"
            title="তালিকায় ফিরে যান"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <BrandAvatar kind="channel" name={channel} src={ch?.logo_url} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">ক্লায়েন্ট চ্যানেল</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                  isCleared
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                }`}
              >
                {isCleared ? "সম্পূর্ণ পরিশোধিত" : "বকেয়া বাকি"}
              </span>
            </div>
            <h1 className="truncate text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {channel}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AddPaymentDialog
            channel={channel}
            shootings={shootings}
            trigger={
              <Button className="w-full sm:w-auto gap-1.5 rounded-2xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98]">
                <Plus className="h-4 w-4" /> পেমেন্ট গ্রহণ করুন
              </Button>
            }
          />
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <CompactStatCard
          label="মোট চুক্তি/পাওনা"
          value={taka(contractTotal)}
          subtext={`মোট ${toBn(shootings.length)} টি শুটিং`}
          Icon={Receipt}
          variant="primary"
        />
        <CompactStatCard
          label="মোট প্রাপ্তি"
          value={taka(receivedTotal)}
          subtext={`মোট ${toBn(payments.length)} টি পেমেন্ট`}
          Icon={Wallet}
          variant="success"
        />
        <CompactStatCard
          label="বর্তমান বকেয়া"
          value={taka(dueTotal)}
          subtext={dueTotal > 0 ? "পাওনা আদায় বাকি" : "পরিশোধ সম্পন্ন"}
          Icon={CircleAlert}
          variant={dueTotal > 0 ? "danger" : "success"}
        />
      </div>

      {/* Main Content Layout: Shootings (Left/Top) & Payment History (Right/Bottom) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Shooting List (Left 7 Cols) */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Clapperboard className="h-4 w-4 text-primary" /> শুটিং তালিকা ({toBn(shootings.length)})
            </h2>
          </div>

          {shootingsLoading && (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              শুটিং তালিকা লোড হচ্ছে…
            </div>
          )}

          {!shootingsLoading && shootings.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-xs text-muted-foreground">
              এই ক্লায়েন্টের কোনো শুটিং যোগ করা হয়নি।
            </div>
          )}

          <div className="space-y-2.5">
            {shootings.map((s) => {
              const paid = paidByShooting.get(s.id) ?? 0;
              const contract = Number(s.contract_amount ?? 0);
              const due = contract - paid;
              const status =
                contract === 0
                  ? "মূল্য নেই"
                  : due <= 0
                    ? "পরিশোধিত"
                    : paid > 0
                      ? "আংশিক"
                      : "বকেয়া";
              const statusCls =
                status === "পরিশোধিত"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : status === "আংশিক"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : status === "বকেয়া"
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      : "bg-muted text-muted-foreground";

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border bg-card p-3.5 shadow-sm transition hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-sm text-foreground">{s.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 text-primary/70" />
                        <span>{s.shoot_date ? bnDate(s.shoot_date) : "তারিখ নেই"}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusCls}`}>
                      {status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2 text-center text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground">চুক্তি</div>
                      <div className="font-semibold text-foreground">{taka(contract)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">প্রাপ্ত</div>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">{taka(paid)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">বকেয়া</div>
                      <div className={`font-semibold ${due > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                        {taka(due)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex justify-end">
                    <AddPaymentDialog
                      channel={channel}
                      shootings={shootings}
                      defaultShootingId={s.id}
                      trigger={
                        <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl text-xs">
                          <BadgeDollarSign className="h-3.5 w-3.5 text-primary" /> পেমেন্ট নিন
                        </Button>
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment History (Right 5 Cols) */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <History className="h-4 w-4 text-primary" /> পেমেন্ট ইতিহাস ({toBn(payments.length)})
            </h2>
          </div>

          {payments.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-xs text-muted-foreground">
              এখনও কোনো পেমেন্ট রেকর্ড নেই
            </div>
          )}

          {payments.length > 0 && (
            <div className="rounded-2xl border bg-card p-2 shadow-sm">
              <ul className="divide-y divide-border/50">
                {payments.map((p) => {
                  const linked = p.shooting_id
                    ? shootings.find((s) => s.id === p.shooting_id)
                    : null;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 p-2.5 transition hover:bg-muted/30 rounded-xl">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {taka(Number(p.amount))}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            • {bnDate(p.received_at)}
                          </span>
                          {p.method && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9.5px] font-medium text-primary">
                              {p.method}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                          {linked ? `শুটিং: ${linked.name}` : "স্বয়ংক্রিয় বণ্টন (পুরাতন বকেয়া)"}
                          {p.note ? ` • ${p.note}` : ""}
                        </div>
                      </div>
                      <ConfirmDelete
                        trigger={
                          <button
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                            aria-label="পেমেন্ট মুছুন"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        }
                        title="পেমেন্ট মুছবেন?"
                        description={`${taka(Number(p.amount))} পেমেন্টটি মুছে ফেলা হবে।`}
                        onConfirm={() => removePayment.mutate(p.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {unallocated > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-primary">
              💡 এর মধ্যে <strong>{taka(unallocated)}</strong> অতিরিক্ত অগ্রিম হিসেবে রয়েছে।
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddPaymentDialog({
  channel,
  shootings,
  defaultShootingId,
  trigger,
}: {
  channel: string;
  shootings: ChannelShooting[];
  defaultShootingId?: string;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("ক্যাশ");
  const [shootingId, setShootingId] = useState<string>(defaultShootingId ?? "none");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("সঠিক পরিমাণ দিন");
      const { error } = await supabase.from("client_payments").insert({
        owner_id: u.user.id,
        channel,
        shooting_id: shootingId === "none" ? null : shootingId,
        amount: amt,
        received_at: date,
        method: method || null,
        note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-payments", channel] });
      qc.invalidateQueries({ queryKey: ["client-channel-summary"] });
      toast.success("পেমেন্ট যোগ হয়েছে");
      setOpen(false);
      setAmount("");
      setNote("");
      setShootingId(defaultShootingId ?? "none");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpen = (v: boolean) => {
    if (v) {
      setAmount("");
      setNote("");
      setDate(new Date().toISOString().slice(0, 10));
      setMethod("ক্যাশ");
      setShootingId(defaultShootingId ?? "none");
    }
    setOpen(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <BadgeDollarSign className="h-5 w-5 text-emerald-600" /> পেমেন্ট গ্রহণ — {channel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">পরিমাণ (৳) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="যেমন: 10000"
              className="h-10 rounded-xl"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">তারিখ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">মাধ্যম</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ক্যাশ">ক্যাশ</SelectItem>
                  <SelectItem value="বিকাশ">বিকাশ</SelectItem>
                  <SelectItem value="নগদ">নগদ</SelectItem>
                  <SelectItem value="রকেট">রকেট</SelectItem>
                  <SelectItem value="ব্যাংক">ব্যাংক</SelectItem>
                  <SelectItem value="চেক">চেক</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">কোন শুটিং-এর জন্য?</Label>
            <Select value={shootingId} onValueChange={setShootingId}>
              <SelectTrigger className="h-10 rounded-xl text-xs">
                <SelectValue placeholder="বাছুন" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">স্বয়ংক্রিয় — পুরাতন বকেয়া থেকে পরিশোধ</SelectItem>
                {shootings.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.shoot_date ? bnDate(s.shoot_date) : "তারিখ নেই"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">নোট (ঐচ্ছিক)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="পেমেন্ট সম্পর্কিত কোনো তথ্য..."
              className="rounded-xl text-xs resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 mt-1">
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !amount || Number(amount) <= 0}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {create.isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
