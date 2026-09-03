import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  CalendarCheck,
  BadgeDollarSign,
  LogOut,
  LayoutDashboard,
  Clapperboard,
  Settings as SettingsIcon,
  UserSearch,
  MoreHorizontal,
  MessageSquare,
  Tv,
  FileText,
  PartyPopper,
  Wallet,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { InstallAppButton } from "@/components/install-app-button";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { SettingsDialog } from "@/components/settings-dialog";
import kmLogo from "@/assets/km-logo.png";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { denied: "1" } });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

const ALL_NAV_ITEMS = [
  { to: "/dashboard", label: "হোম", icon: LayoutDashboard },
  { to: "/members", label: "সদস্য", icon: Users },
  { to: "/attendance", label: "হাজিরা", icon: CalendarCheck },
  { to: "/shootings", label: "শুটিং", icon: Clapperboard },
  { to: "/payments", label: "পেমেন্ট", icon: BadgeDollarSign },
  { to: "/client-dues", label: "ক্লায়েন্ট হিসাব", icon: Wallet },
  { to: "/directory", label: "চ্যানেল/পরিচালক", icon: Tv },
  { to: "/reports", label: "রিপোর্ট/PDF", icon: FileText },
  { to: "/account-check", label: "একাউন্ট চেকিং", icon: UserSearch },
  { to: "/sms", label: "গ্রুপ SMS", icon: MessageSquare },
  { to: "/congrats", label: "অভিনন্দন কার্ড", icon: PartyPopper },
] as const;

const MOBILE_NAV = [
  { to: "/dashboard", label: "হোম", icon: LayoutDashboard },
  { to: "/attendance", label: "হাজিরা", icon: CalendarCheck },
  { to: "/payments", label: "পেমেন্ট", icon: BadgeDollarSign },
] as const;

const MORE_NAV = [
  { to: "/members", label: "সদস্য", icon: Users },
  { to: "/shootings", label: "শুটিং", icon: Clapperboard },
  { to: "/directory", label: "চ্যানেল/পরিচালক", icon: Tv },
  { to: "/client-dues", label: "ক্লায়েন্ট হিসাব", icon: Wallet },
  { to: "/reports", label: "রিপোর্ট/PDF", icon: FileText },
  { to: "/account-check", label: "একাউন্ট চেকিং", icon: UserSearch },
  { to: "/sms", label: "গ্রুপ SMS", icon: MessageSquare },
  { to: "/congrats", label: "অভিনন্দন কার্ড", icon: PartyPopper },
] as const;

const PAGE_ANIM: Record<string, string> = {
  "/dashboard": "page-anim-zoom",
  "/members": "page-anim-slide-right",
  "/attendance": "page-anim-slide-up",
  "/shootings": "page-anim-flip",
  "/payments": "page-anim-slide-left",
  "/account-check": "page-anim-blur",
  "/sms": "page-anim-slide-up",
  "/directory": "page-anim-slide-right",
};

function pageAnimClass(pathname: string) {
  return PAGE_ANIM[pathname] ?? "page-anim-blur";
}

function AuthedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  Route.useRouteContext();
  const [moreOpen, setMoreOpen] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("লগআউট হয়েছে");
    window.location.href = "/auth";
  };

  return (
    <div className="app-shell flex flex-col">
      <PullToRefresh />

      {/* Main Header (Desktop + Mobile) */}
      <header
        className="hero-gradient z-10 border-b border-white/10 text-white shadow-sm"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-3.5">
          {/* Logo & Title */}
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3 transition hover:opacity-95">
            <img
              src={kmLogo}
              alt="Kuakata Multimedia"
              className="h-10 w-10 shrink-0 rounded-xl bg-white/95 p-1 object-contain shadow-sm md:h-11 md:w-11"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold text-white md:text-lg">
                Kuakata Multimedia Finance
              </div>
              <div className="truncate text-[11px] text-white/80 md:text-xs">
                টিম ও বেতন ব্যবস্থাপনা সিস্টেম
              </div>
            </div>
          </Link>

          {/* Top Right Desktop & Mobile Actions */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <InstallAppButton />

            <SettingsDialog
              trigger={
                <button
                  className="grid h-9 w-9 place-items-center rounded-xl text-white/85 transition-colors hover:bg-white/20 hover:text-white md:h-10 md:w-10"
                  aria-label="সেটিংস"
                  title="সেটিংস"
                >
                  <SettingsIcon className="h-[18px] w-[18px]" />
                </button>
              }
            />

            <button
              onClick={logout}
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-white/85 transition-colors hover:bg-white/20 hover:text-white md:h-10 md:px-3"
              aria-label="লগআউট"
              title="লগআউট করুন"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="hidden text-xs font-semibold md:inline">লগআউট</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Links Bar (Shown on md/lg screens) */}
        <div className="hidden border-t border-white/15 px-6 py-2 md:block">
          <nav className="flex flex-wrap items-center gap-1.5">
            {ALL_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-white text-primary shadow-sm ring-1 ring-white/50"
                      : "text-white/85 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "stroke-[2.5]" : ""}`} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
        <div key={pathname} className={pageAnimClass(pathname)}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Floating Bottom Bar (Hidden on md/desktop screens) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center md:hidden">
        <nav
          className="hero-gradient pointer-events-auto w-full max-w-md border-t border-white/15 text-white shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.2)]"
          style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-4 px-1 py-1">
            {MOBILE_NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className="group flex flex-col items-center gap-0.5 py-1.5"
                >
                  <span
                    className={`grid h-7 w-10 place-items-center rounded-full transition-colors ${
                      active ? "bg-white text-primary shadow-sm" : "text-white/75"
                    }`}
                  >
                    <Icon className={`h-[15px] w-[15px] ${active ? "stroke-[2.4]" : ""}`} />
                  </span>
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      active ? "text-white" : "text-white/75"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}

            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button className="group flex flex-col items-center gap-0.5 py-1.5">
                  <span
                    className={`grid h-7 w-10 place-items-center rounded-full transition-colors ${
                      MORE_NAV.some((n) => n.to === pathname)
                        ? "bg-white text-primary shadow-sm"
                        : "text-white/75"
                    }`}
                  >
                    <MoreHorizontal className="h-[15px] w-[15px]" />
                  </span>
                  <span className="text-[10px] font-medium text-white/75">আরও</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="left-1/2 top-1/2 bottom-auto right-auto h-auto w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border-white/30 bg-white/20 p-6 shadow-2xl backdrop-blur-2xl sm:max-w-md dark:bg-white/10"
              >
                <SheetHeader>
                  <SheetTitle className="more-menu-title">আরও মেনু</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid grid-cols-3 gap-3 pb-4">
                  {MORE_NAV.map(({ to, label, icon: Icon }, i) => {
                    const active = pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setMoreOpen(false)}
                        style={{ animationDelay: `${i * 80}ms` }}
                        className={`more-menu-item flex flex-col items-center gap-2 rounded-2xl border border-white/40 bg-white/30 p-4 shadow-lg backdrop-blur-xl transition hover:scale-105 hover:bg-white/40 hover:shadow-xl active:scale-95 dark:bg-white/10 ${
                          active ? "ring-2 ring-primary text-primary" : ""
                        }`}
                      >
                        <span className="more-menu-icon grid h-11 w-11 place-items-center rounded-2xl bg-white/40 text-primary shadow-inner backdrop-blur-xl">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-center text-xs font-semibold">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </div>
  );
}
