import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tv, UserCog, Camera, Loader2, Check, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Channel = {
  id: string;
  name: string;
  logo_url: string | null;
  color?: string | null;
  is_own?: boolean;
};

export type Director = { id: string; name: string; photo_url: string | null };

export const CHANNEL_COLORS = [
  { name: "লাল (Red)", value: "#ef4444", bg: "bg-red-500" },
  { name: "রোজ (Rose)", value: "#f43f5e", bg: "bg-rose-500" },
  { name: "গোলাপী (Pink)", value: "#ec4899", bg: "bg-pink-500" },
  { name: "পার্পল (Purple)", value: "#a855f7", bg: "bg-purple-500" },
  { name: "ভায়োলেট (Violet)", value: "#8b5cf6", bg: "bg-violet-500" },
  { name: "ইন্ডিগো (Indigo)", value: "#6366f1", bg: "bg-indigo-500" },
  { name: "নীল (Blue)", value: "#3b82f6", bg: "bg-blue-500" },
  { name: "সায়ান (Cyan)", value: "#06b6d4", bg: "bg-cyan-500" },
  { name: "টিয়াল (Teal)", value: "#14b8a6", bg: "bg-teal-500" },
  { name: "সবুজ (Emerald)", value: "#10b981", bg: "bg-emerald-500" },
  { name: "অ্যাম্বার (Amber)", value: "#f59e0b", bg: "bg-amber-500" },
  { name: "কমলা (Orange)", value: "#f97316", bg: "bg-orange-500" },
];

export function getChannelColor(name?: string | null, channels?: Channel[]): string {
  if (!name || !name.trim()) return "#6366f1";
  const trimmed = name.trim().toLowerCase();
  if (channels && channels.length > 0) {
    const found = channels.find((c) => c.name.trim().toLowerCase() === trimmed);
    if (found?.color && found.color.trim()) return found.color.trim();
  }
  // Deterministic fallback based on string hash
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CHANNEL_COLORS.length;
  return CHANNEL_COLORS[index].value;
}

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, logo_url, is_own, color")
        .order("name");
      if (error) throw error;
      const raw = (data ?? []) as Channel[];
      const map = new Map<string, Channel>();
      for (const c of raw) {
        if (!c || !c.name) continue;
        const key = c.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, { ...c });
        } else {
          const prev = map.get(key)!;
          if (c.logo_url !== undefined) prev.logo_url = c.logo_url;
          if (c.color !== undefined && c.color) prev.color = c.color;
          if (c.is_own !== undefined) prev.is_own = c.is_own;
          if (c.name) prev.name = c.name;
        }
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "bn"));
    },
  });
}

export function useDirectors() {
  return useQuery({
    queryKey: ["directors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors")
        .select("id, name, photo_url, phone")
        .order("name");
      if (error) throw error;
      const raw = (data ?? []) as Director[];
      const map = new Map<string, Director>();
      for (const d of raw) {
        if (!d || !d.name) continue;
        const key = d.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, { ...d });
        } else {
          const prev = map.get(key)!;
          if (d.photo_url !== undefined) prev.photo_url = d.photo_url;
          if ((d as any).phone !== undefined) (prev as any).phone = (d as any).phone;
          if (d.name) prev.name = d.name;
        }
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "bn"));
    },
  });
}

export async function ensureChannel(name: string, color?: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return trimmed;
  const { data: existing } = await supabase
    .from("channels")
    .select("id, name, color")
    .eq("name", trimmed)
    .maybeSingle();
  if (!existing) {
    await supabase
      .from("channels")
      .insert({
        owner_id: u.user.id,
        name: trimmed,
        color: color || getChannelColor(trimmed),
      })
      .select()
      .maybeSingle();
  }
  return trimmed;
}

export async function ensureDirector(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return trimmed;
  const { data: existing } = await supabase
    .from("directors")
    .select("id, name")
    .eq("name", trimmed)
    .maybeSingle();
  if (!existing) {
    await supabase
      .from("directors")
      .insert({ owner_id: u.user.id, name: trimmed })
      .select()
      .maybeSingle();
  }
  return trimmed;
}

// Resize image client-side to a small square dataURL (jpeg)
export async function fileToDataUrl(file: File, maxSize = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function initials(name: string) {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

export function BrandAvatar({
  name,
  src,
  kind,
  size = 24,
  className,
  color,
}: {
  name: string;
  src: string | null | undefined;
  kind: "channel" | "director";
  size?: number;
  className?: string;
  color?: string | null;
}) {
  const { data: channels = [] } = useChannels();
  const actualColor = color || (kind === "channel" ? getChannelColor(name, channels) : undefined);
  const Icon = kind === "channel" ? Tv : UserCog;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderColor: actualColor || "transparent",
        }}
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-border bg-muted shadow-sm",
          className,
        )}
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.42),
        backgroundColor: actualColor ? `${actualColor}25` : undefined,
        color: actualColor || undefined,
        borderColor: actualColor ? `${actualColor}60` : undefined,
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold shadow-sm border",
        !actualColor && "bg-primary/10 text-primary border-primary/20",
        className,
      )}
      aria-label={name}
    >
      {name?.trim() ? initials(name) : <Icon style={{ width: size * 0.6, height: size * 0.6 }} />}
    </span>
  );
}

/** Show a channel name with its logo & color */
export function ChannelChip({ name, size = 18 }: { name: string; size?: number }) {
  const { data: channels = [] } = useChannels();
  const ch = channels.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const color = getChannelColor(name, channels);

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 font-medium">
      <BrandAvatar kind="channel" name={name} src={ch?.logo_url} color={color} size={size} />
      <span className="truncate" style={{ color }}>{name}</span>
    </span>
  );
}

/** Show a director name with photo */
export function DirectorChip({ name, size = 18 }: { name: string; size?: number }) {
  const { data: directors = [] } = useDirectors();
  const d = directors.find((x) => x.name === name);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <BrandAvatar kind="director" name={name} src={d?.photo_url} size={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Generic combobox with avatar in dropdown */
function BrandCombobox({
  kind,
  value,
  onChange,
  className,
  placeholder,
  items,
}: {
  kind: "channel" | "director";
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder: string;
  items: { id: string; name: string; src: string | null; color?: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(value.toLowerCase()))
    : items;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <Input
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
          {filtered.map((item) => (
            <button
              type="button"
              key={item.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item.name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold hover:bg-accent transition"
            >
              <BrandAvatar kind={kind} name={item.name} src={item.src} color={item.color} size={24} />
              <span className="truncate" style={{ color: item.color || undefined }}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Combobox input for channels with logos & colors */
export function ChannelField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { data: channels = [] } = useChannels();
  return (
    <BrandCombobox
      kind="channel"
      value={value}
      onChange={onChange}
      className={className}
      placeholder="চ্যানেল নাম (টাইপ করুন বা ড্রপডাউন থেকে বাছুন)"
      items={channels.map((c) => ({ id: c.id, name: c.name, src: c.logo_url, color: c.color }))}
    />
  );
}

/** Combobox input for directors with photos */
export function DirectorField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { data: directors = [] } = useDirectors();
  return (
    <BrandCombobox
      kind="director"
      value={value}
      onChange={onChange}
      className={className}
      placeholder="পরিচালকের নাম (টাইপ করুন বা ড্রপডাউন থেকে বাছুন)"
      items={directors.map((d) => ({ id: d.id, name: d.name, src: d.photo_url }))}
    />
  );
}

/** Channel Color Palette Selector Component */
export function ChannelColorSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Palette className="h-3.5 w-3.5 text-primary" /> চ্যানেলের ব্র্যান্ড কালার
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="h-4 w-4 rounded-full border shadow-sm"
            style={{ backgroundColor: value || "#ef4444" }}
          />
          <input
            type="color"
            value={value || "#ef4444"}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            title="কাস্টম কালার বাছুন"
          />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
        {CHANNEL_COLORS.map((c) => {
          const selected = value.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              type="button"
              key={c.value}
              onClick={() => onChange(c.value)}
              title={c.name}
              style={{ backgroundColor: c.value }}
              className={`relative grid h-8 w-8 place-items-center rounded-xl shadow-sm transition hover:scale-110 active:scale-95 ${
                selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-105" : ""
              }`}
            >
              {selected && <Check className="h-4 w-4 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Upload + manage image for a channel or director (identified by name) */
export function BrandImageUpload({
  kind,
  name,
  currentUrl,
  size = 72,
  color,
}: {
  kind: "channel" | "director";
  name: string;
  currentUrl: string | null | undefined;
  size?: number;
  color?: string | null;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const table = kind === "channel" ? "channels" : "directors";
  const col = kind === "channel" ? "logo_url" : "photo_url";
  const queryKey = kind === "channel" ? "channels" : "directors";

  const save = useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("লগইন প্রয়োজন");
      const { error } = await supabase
        .from(table)
        .upsert(
          { owner_id: u.user.id, name, [col]: dataUrl } as never,
          { onConflict: "owner_id,name" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success("ছবি আপডেট হয়েছে");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPick = async (file: File) => {
    try {
      setBusy(true);
      const url = await fileToDataUrl(file, 256);
      await save.mutateAsync(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <BrandAvatar kind={kind} name={name} src={currentUrl} color={color} size={size} />
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          <Camera className="h-3.5 w-3.5" /> {currentUrl ? "ছবি পরিবর্তন" : "ছবি আপলোড"}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={() => save.mutate(null)}
            className="text-left text-[11px] text-destructive hover:underline"
          >
            ছবি মুছুন
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
