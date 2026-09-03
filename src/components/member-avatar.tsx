import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "member-photos";

export function useMemberPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["member-photo", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
        return path;
      }
      try {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
        return data?.signedUrl || path;
      } catch {
        return path;
      }
    },
  });
}

type Size = "sm" | "md" | "lg" | "xl";
const SIZE: Record<Size, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

export function MemberAvatar({
  name,
  photoUrl,
  size = "md",
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  size?: Size;
  className?: string;
}) {
  const { data: url } = useMemberPhotoUrl(photoUrl);
  const initial = (name?.trim().charAt(0) || "?").toUpperCase();
  const base = `${SIZE[size]} shrink-0 overflow-hidden rounded-full bg-accent text-accent-foreground grid place-items-center font-semibold ${className}`;

  const finalSrc = url || (photoUrl && (photoUrl.startsWith("data:") || photoUrl.startsWith("http")) ? photoUrl : null);

  if (finalSrc) {
    return (
      <div className={base}>
        <img src={finalSrc} alt={name} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  return <div className={base}>{initial}</div>;
}

export { BUCKET as MEMBER_PHOTO_BUCKET };
