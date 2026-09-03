import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Tv,
  UserCog,
  Calendar,
  Clapperboard,
  ChevronRight,
  Search,
  Plus,
  Trash2,
  Phone,
  Settings,
  Lock,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toBn, bnDate, taka } from "@/lib/format";
import {
  BrandAvatar,
  BrandImageUpload,
  ChannelChip,
  DirectorChip,
  useChannels,
  useDirectors,
  ChannelColorSelector,
  getChannelColor,
} from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/directory")({
  component: DirectoryPage,
});

type Shooting = {
  id: string;
  name: string;
  shoot_date: string;
  location: string | null;
  director: string | null;
  channel: string | null;
};

type Summary = {
  present_count: number;
  attendance_cost: number;
  extra_cost: number;
  total_cost: number;
};

function DirectoryPage() {
  const [tab, setTab] = useState<"channel" | "director">("channel");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [addDirectorOpen, setAddDirectorOpen] = useState(false);

  const { data: shootings = [], isLoading } = useQuery({
    queryKey: ["shootings", "directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shootings")
        .select("id, name, shoot_date, location, director, channel")
        .order("shoot_date", { ascending: false });
      if (error) throw error;
      return data as Shooting[];
    },
  });

  const { data: channels = [] } = useChannels();
  const { data: directors = [] } = useDirectors();

  // Group shootings & merge with registered channels/directors
  const groups = useMemo(() => {
    const map = new Map<string, Shooting[]>();
    for (const s of shootings) {
      const key = (tab === "channel" ? s.channel : s.director)?.trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const registered =
      tab === "channel" ? channels.map((c) => c.name) : directors.map((d) => d.name);
    for (const n of registered) if (!map.has(n)) map.set(n, []);
    return [...map.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name, "bn"));
  }, [shootings, tab, channels, directors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  const selectedItems = selected
    ? groups.find((g) => g.name === selected)?.items ?? []
    : [];

  const selectedRecord = selected
    ? tab === "channel"
      ? channels.find((c) => c.name === selected)
      : directors.find((d) => d.name === selected)
    : null;
  const selectedImage =
    selectedRecord && "logo_url" in selectedRecord
      ? selectedRecord.logo_url
      : selectedRecord && "photo_url" in selectedRecord
      ? selectedRecord.photo_url
      : null;

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">ডিরেক্টরি</h1>
          <p className="text-sm text-muted-foreground">
            চ্যানেল ও পরিচালকদের কাজের তালিকা ও পরিচালনা
          </p>
        </div>

        <div>
          {tab === "channel" ? (
            <Button
              onClick={() => setAddChannelOpen(true)}
              className="w-full gap-1.5 rounded-2xl shadow-sm sm:w-auto"
            >
              <Plus className="h-4 w-4" /> নতুন চ্যানেল যোগ করুন
            </Button>
          ) : (
            <Button
              onClick={() => setAddDirectorOpen(true)}
              className="w-full gap-1.5 rounded-2xl shadow-sm sm:w-auto"
            >
              <Plus className="h-4 w-4" /> নতুন পরিচালক যোগ করুন
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-1">
        <button
          onClick={() => {
            setTab("channel");
            setSelected(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
            tab === "channel"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tv className="h-4 w-4" /> চ্যানেল ({toBn(channels.length)})
        </button>
        <button
          onClick={() => {
            setTab("director");
            setSelected(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
            tab === "director"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCog className="h-4 w-4" /> পরিচালক ({toBn(directors.length)})
        </button>
      </div>

      {!selected && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "channel" ? "চ্যানেল খুঁজুন…" : "পরিচালক খুঁজুন…"}
              className="h-11 rounded-2xl pl-9"
            />
          </div>

          {isLoading && (
            <div className="py-10 text-center text-muted-foreground">লোড হচ্ছে…</div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
              {tab === "channel" ? (
                <Tv className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              ) : (
                <UserCog className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
              )}
              <h3 className="text-sm font-medium">কোনো তথ্য পাওয়া যায়নি</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                নতুন {tab === "channel" ? "চ্যানেল" : "পরিচালক"} যুক্ত করতে উপরের বাটনে চাপুন।
              </p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((g) => (
                <DirectoryCard
                  key={g.name}
                  name={g.name}
                  kind={tab}
                  shootings={g.items}
                  onClick={() => setSelected(g.name)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <SelectedDetail
          name={selected}
          kind={tab}
          items={selectedItems}
          imageUrl={selectedImage}
          onBack={() => setSelected(null)}
          onRename={(newName) => setSelected(newName)}
        />
      )}

      {/* Add Dialogs */}
      <AddChannelDialog open={addChannelOpen} onOpenChange={setAddChannelOpen} />
      <AddDirectorDialog open={addDirectorOpen} onOpenChange={setAddDirectorOpen} />
    </div>
  );
}

function DirectoryCard({
  name,
  kind,
  shootings,
  onClick,
}: {
  name: string;
  kind: "channel" | "director";
  shootings: Shooting[];
  onClick: () => void;
}) {
  const { data: channels = [] } = useChannels();
  const { data: directors = [] } = useDirectors();
  const ch = kind === "channel" ? channels.find((c) => c.name.toLowerCase() === name.toLowerCase()) : null;
  const d = kind === "director" ? directors.find((x) => x.name.toLowerCase() === name.toLowerCase()) : null;
  const image = ch?.logo_url || d?.photo_url;
  const channelColor = ch?.color || (kind === "channel" ? getChannelColor(name, channels) : undefined);

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-sm transition hover:border-primary/40 hover:bg-accent/40 active:scale-[0.99]"
      style={{ borderColor: channelColor ? `${channelColor}40` : undefined }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <BrandAvatar kind={kind} name={name} src={image} color={channelColor} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-sm text-foreground" style={{ color: channelColor }}>
            {name}
          </div>
          <div className="text-xs text-muted-foreground">
            {toBn(shootings.length)} টি শুটিং
          </div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

// Add Channel Dialog
function AddChannelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [isOwn, setIsOwn] = useState(false);
  const [color, setColor] = useState("#ef4444");
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("চ্যানেলের নাম আবশ্যক");
      const { error } = await supabase.from("channels").insert({
        name: trimmed,
        is_own: isOwn,
        color: color || "#ef4444",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["client-channel-summary"] });
      toast.success("চ্যানেল সফলভাবে যুক্ত হয়েছে");
      setName("");
      setIsOwn(false);
      setColor("#ef4444");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "চ্যানেল যোগ করা যায়নি"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" /> নতুন চ্যানেল যোগ করুন
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">চ্যানেলের নাম *</Label>
            <Input
              placeholder="উদা: Kuakata Multimedia, Eagle Music"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>

          {/* Color Selector */}
          <ChannelColorSelector value={color} onChange={setColor} />

          <div className="flex items-center justify-between rounded-2xl border bg-muted/30 p-3.5">
            <div>
              <div className="text-sm font-semibold">নিজের চ্যানেল?</div>
              <div className="text-xs text-muted-foreground">
                {isOwn
                  ? "নিজের চ্যানেল হলে ক্লায়েন্ট বকেয়া হিসাবে আসবে না"
                  : "বাহিরের ক্লায়েন্ট চ্যানেল হিসাবে চুক্তি ও বকেয়া হিসাব থাকবে"}
              </div>
            </div>
            <Switch checked={isOwn} onCheckedChange={setIsOwn} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            বাতিল
          </Button>
          <Button
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !name.trim()}
            className="rounded-xl"
          >
            {addMutation.isPending ? "যোগ হচ্ছে…" : "সংরক্ষণ করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add Director Dialog
function AddDirectorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("পরিচালকের নাম আবশ্যক");
      const { error } = await supabase.from("directors").insert({
        name: trimmed,
        phone: phone.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directors"] });
      toast.success("পরিচালক সফলভাবে যুক্ত হয়েছে");
      setName("");
      setPhone("");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "পরিচালক যোগ করা যায়নি"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" /> নতুন পরিচালক যোগ করুন
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">পরিচালকের নাম *</Label>
            <Input
              placeholder="উদা: শুভ, সোহাগ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">মোবাইল নাম্বার (ঐচ্ছিক)</Label>
            <Input
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            বাতিল
          </Button>
          <Button
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !name.trim()}
            className="rounded-xl"
          >
            {addMutation.isPending ? "যোগ হচ্ছে…" : "সংরক্ষণ করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectedDetail({
  name,
  kind,
  items,
  imageUrl,
  onBack,
  onRename,
}: {
  name: string;
  kind: "channel" | "director";
  items: Shooting[];
  imageUrl: string | null | undefined;
  onBack: () => void;
  onRename?: (newName: string) => void;
}) {
  const ids = items.map((i) => i.id);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: channels = [] } = useChannels();
  const ch = kind === "channel" ? channels.find((c) => c.name.toLowerCase() === name.toLowerCase()) : null;
  const channelColor = ch?.color || (kind === "channel" ? getChannelColor(name, channels) : undefined);
  const isOwn = !!ch?.is_own;

  const { data: summaries } = useQuery({
    queryKey: ["directory-summaries", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const out: Record<string, Summary> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { data, error } = await supabase.rpc("shooting_summary", {
            _shooting_id: id,
          });
          if (error) return;
          const row = (data as Summary[] | null)?.[0];
          if (row) {
            out[id] = {
              present_count: Number(row.present_count ?? 0),
              attendance_cost: Number(row.attendance_cost ?? 0),
              extra_cost: Number(row.extra_cost ?? 0),
              total_cost: Number(row.total_cost ?? 0),
            };
          }
        }),
      );
      return out;
    },
  });

  const totalCost = Object.values(summaries ?? {}).reduce(
    (a, s) => a + (s.total_cost ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        ← ফিরে যান
      </button>

      {/* Top Profile Header Card */}
      <div className="rounded-3xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <BrandAvatar kind={kind} name={name} src={imageUrl} color={channelColor} size={60} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {kind === "channel" ? "চ্যানেল প্রোফাইল" : "পরিচালক প্রোফাইল"}
                </span>
                {kind === "channel" && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      isOwn
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground border"
                    }`}
                  >
                    {isOwn ? "নিজের চ্যানেল" : "ক্লায়েন্ট চ্যানেল"}
                  </span>
                )}
              </div>
              <div
                className="truncate text-xl font-black text-foreground mt-0.5"
                style={{ color: channelColor }}
              >
                {name}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            className="gap-2 rounded-2xl border-primary/30 hover:bg-primary/5 shadow-sm self-start sm:self-center"
          >
            <Settings className="h-4 w-4 text-primary" />
            {kind === "channel" ? "ক্লায়েন্ট সেটিংস" : "পরিচালক সেটিংস"}
          </Button>
        </div>
      </div>

      {/* 2 Summary Stats Cards */}
      <div className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">মোট শুটিং সংখ্যা</div>
            <div className="mt-0.5 text-lg font-bold">{toBn(items.length)}</div>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3">
            <div className="text-xs font-medium text-primary">মোট শুটিং খরচ</div>
            <div className="mt-0.5 text-lg font-bold text-primary">{taka(totalCost)}</div>
          </div>
        </div>
      </div>

      {/* Shootings List */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-semibold text-foreground">শুটিং কাজের তালিকা</h3>
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            এই {kind === "channel" ? "চ্যানেলে" : "পরিচালকের অধীনে"} এখনও কোনো শুটিং রেকর্ড করা হয়নি।
          </div>
        )}
        {items.map((s) => {
          const sum = summaries?.[s.id];
          return (
            <Link
              key={s.id}
              to="/shootings"
              className="flex items-start gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/30 active:scale-[0.99]"
            >
              <span
                style={{
                  backgroundColor: channelColor,
                  boxShadow: channelColor ? `0 4px 12px ${channelColor}35` : undefined,
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm"
              >
                <Clapperboard className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> {bnDate(s.shoot_date)}
                </div>
                {kind === "channel" && s.director && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="text-muted-foreground/70 shrink-0">পরিচালক:</span>
                    <DirectorChip name={s.director} size={14} />
                  </div>
                )}
                {kind === "director" && s.channel && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="text-muted-foreground/70 shrink-0">চ্যানেল:</span>
                    <ChannelChip name={s.channel} size={14} />
                  </div>
                )}
                {s.location && (
                  <div className="truncate text-xs text-muted-foreground">
                    {s.location}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10.5px] text-muted-foreground">খরচ</div>
                <div className="text-sm font-bold text-primary">
                  {taka(sum?.total_cost ?? 0)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Client / Director Settings Modal */}
      <ClientSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        kind={kind}
        name={name}
        imageUrl={imageUrl}
        items={items}
        onRename={onRename}
        onDelete={onBack}
      />
    </div>
  );
}

// Client / Director Settings Dialog
function ClientSettingsDialog({
  open,
  onOpenChange,
  kind,
  name,
  imageUrl,
  items = [],
  onRename,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "channel" | "director";
  name: string;
  imageUrl: string | null | undefined;
  items?: Shooting[];
  onRename?: (newName: string) => void;
  onDelete?: () => void;
}) {
  const qc = useQueryClient();
  const { data: channels = [] } = useChannels();
  const { data: directors = [] } = useDirectors();

  const currentChannel = kind === "channel" ? channels.find((c) => c.name.toLowerCase() === name.toLowerCase()) : null;
  const currentDirector = kind === "director" ? directors.find((d) => d.name.toLowerCase() === name.toLowerCase()) : null;

  const [editName, setEditName] = useState(name);
  const [editColor, setEditColor] = useState(currentChannel?.color || getChannelColor(name, channels));
  const [editIsOwn, setEditIsOwn] = useState(Boolean(currentChannel?.is_own));
  const [editPhone, setEditPhone] = useState((currentDirector as any)?.phone || "");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Sync state whenever modal opens or entity changes
  useEffect(() => {
    if (open) {
      setEditName(name);
      setEditColor(currentChannel?.color || getChannelColor(name, channels));
      setEditIsOwn(Boolean(currentChannel?.is_own));
      setEditPhone((currentDirector as any)?.phone || "");
    }
  }, [open, name, currentChannel, currentDirector, channels]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = editName.trim();
      if (!trimmedName) throw new Error("নাম আবশ্যক");

      if (kind === "channel") {
        const { error } = await supabase.from("channels").update({
          old_name: name,
          name: trimmedName,
          color: editColor,
          is_own: editIsOwn,
        }).eq("name", name);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("directors").update({
          old_name: name,
          name: trimmedName,
          phone: editPhone.trim(),
        }).eq("name", name);
        if (error) throw error;
      }
      return trimmedName;
    },
    onSuccess: async (newName) => {
      await qc.invalidateQueries({ queryKey: ["channels"] });
      await qc.invalidateQueries({ queryKey: ["directors"] });
      await qc.invalidateQueries({ queryKey: ["client-channel-summary"] });
      await qc.invalidateQueries({ queryKey: ["calendar-shootings"] });
      await qc.invalidateQueries({ queryKey: ["shootings"] });
      await qc.invalidateQueries({ queryKey: ["directory-summaries"] });
      await qc.refetchQueries({ queryKey: ["channels"] });
      toast.success(kind === "channel" ? "ক্লায়েন্ট সেটিংস সংরক্ষিত হয়েছে" : "পরিচালক সেটিংস সংরক্ষিত হয়েছে");
      if (onRename && newName !== name) {
        onRename(newName);
      }
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "সংরক্ষণ করা যায়নি"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-3xl sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {kind === "channel" ? "ক্লায়েন্ট সেটিংস (চ্যানেল)" : "পরিচালক সেটিংস"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Profile Picture / Logo */}
            <div className="rounded-2xl border bg-muted/20 p-3.5 space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {kind === "channel" ? "প্রোফাইল ছবি / লোগো" : "পরিচালকের ছবি"}
              </Label>
              <BrandImageUpload
                kind={kind}
                name={name}
                currentUrl={imageUrl}
                color={kind === "channel" ? editColor : undefined}
                size={64}
              />
            </div>

            {/* 2. Name Edit */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {kind === "channel" ? "চ্যানেলের নাম" : "পরিচালকের নাম"} *
              </Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="নাম লিখুন"
                className="h-11 rounded-xl"
              />
            </div>

            {/* 3. Director Phone (if kind === 'director') */}
            {kind === "director" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">ফোন নম্বর</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="০১XXXXXXXXX"
                  className="h-11 rounded-xl"
                />
              </div>
            )}

            {/* 4. Brand Color (if kind === 'channel') */}
            {kind === "channel" && (
              <div className="rounded-2xl border bg-muted/20 p-3.5">
                <ChannelColorSelector value={editColor} onChange={setEditColor} />
              </div>
            )}

            {/* 5. Channel Type / Ownership (if kind === 'channel') */}
            {kind === "channel" && (
              <div className="flex items-center justify-between rounded-2xl border bg-muted/20 p-3.5">
                <div className="min-w-0 pr-2">
                  <div className="text-sm font-semibold">নিজের চ্যানেল?</div>
                  <div className="text-xs text-muted-foreground">
                    {editIsOwn
                      ? "নিজের চ্যানেল হলে ক্লায়েন্ট বকেয়া হিসাবে আসবে না"
                      : "বাহিরের ক্লায়েন্ট চ্যানেল হিসাবে চুক্তি ও বকেয়া হিসাব থাকবে"}
                  </div>
                </div>
                <Switch checked={editIsOwn} onCheckedChange={setEditIsOwn} />
              </div>
            )}

            {/* 6. Delete Action Section */}
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    {kind === "channel" ? "চ্যানেল মুছে ফেলুন" : "পরিচালক মুছে ফেলুন"}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    মুছে ফেলতে অ্যাডমিন লগইন পাসওয়ার্ড লাগবে
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteModalOpen(true)}
                  className="rounded-xl h-8 text-xs font-bold gap-1 shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" /> ডিলিট
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              বাতিল
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !editName.trim()}
              className="rounded-xl gap-1.5 font-bold"
            >
              {saveMutation.isPending ? "সংরক্ষণ হচ্ছে…" : "পরিবর্তন সংরক্ষণ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Password Protected Delete Dialog */}
      <AdminPasswordDeleteDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title={kind === "channel" ? `"${name}" চ্যানেল ডিলিট করবেন?` : `"${name}" পরিচালক ডিলিট করবেন?`}
        description={
          kind === "channel"
            ? `এই চ্যানেলটি সম্পূর্ণভাবে মুছে ফেলতে আপনার অ্যাডমিন লগইন পাসওয়ার্ড দিয়ে নিশ্চিত করুন।`
            : `এই পরিচালককে সম্পূর্ণভাবে মুছে ফেলতে আপনার অ্যাডমিন লগইন পাসওয়ার্ড দিয়ে নিশ্চিত করুন।`
        }
        onConfirm={async () => {
          const targetId = currentChannel?.id || (currentChannel as any)?._id;
          const isHex = targetId && /^[0-9a-fA-F]{24}$/.test(String(targetId));

          // 1. Delete channel document if hex ID exists
          if (kind === "channel" && isHex) {
            await supabase.from("channels").delete().eq("id", String(targetId)).catch(() => {});
          } else if (kind === "director") {
            const dirId = currentDirector?.id || (currentDirector as any)?._id;
            if (dirId && /^[0-9a-fA-F]{24}$/.test(String(dirId))) {
              await supabase.from("directors").delete().eq("id", String(dirId)).catch(() => {});
            }
          }

          // 2. Unlink any shootings that were tagged with this channel/director
          if (kind === "channel") {
            for (const item of items) {
              if (item.id) {
                await supabase.from("shootings").update({ channel: "" }).eq("id", item.id);
              }
            }
          } else {
            for (const item of items) {
              if (item.id) {
                await supabase.from("shootings").update({ director: "" }).eq("id", item.id);
              }
            }
          }

          await qc.invalidateQueries({ queryKey: ["channels"] });
          await qc.invalidateQueries({ queryKey: ["directors"] });
          await qc.invalidateQueries({ queryKey: ["client-channel-summary"] });
          await qc.invalidateQueries({ queryKey: ["calendar-shootings"] });
          await qc.invalidateQueries({ queryKey: ["shootings"] });
          await qc.invalidateQueries({ queryKey: ["directory-summaries"] });
          toast.success(
            kind === "channel"
              ? `"${name}" চ্যানেলটি মুছে ফেলা হয়েছে`
              : `"${name}" পরিচালক মুছে ফেলা হয়েছে`
          );
          onOpenChange(false);
          if (onDelete) onDelete();
        }}
      />
    </>
  );
}

// Admin Password Confirmation Dialog
function AdminPasswordDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
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

  const handleVerifyAndDelete = async () => {
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
      const token = localStorage.getItem("km_token") || localStorage.getItem("km_finance_token") || "";
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
      toast.error(err.message || "ভুল পাসওয়ার্ড! ডিলিট করা যায়নি।");
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
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="font-medium">
              নিরাপত্তার স্বার্থে এই চ্যানেলটি মুছতে আপনার অ্যাডমিন লগইন পাসওয়ার্ড প্রদান আবশ্যক।
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
                    handleVerifyAndDelete();
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
            onClick={handleVerifyAndDelete}
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
