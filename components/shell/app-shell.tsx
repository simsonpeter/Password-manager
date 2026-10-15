"use client";

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Lock,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface AppShellProps {
  children: ReactNode;
  email: string | null;
  syncLabel: string;
  offline: boolean;
  onLock: () => void;
}

export function AppShell({ children, email, syncLabel, offline, onLock }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy text-white md:flex",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-teal-100">
            <Lock className="h-5 w-5" />
          </span>
          {collapsed ? null : (
            <div>
              <p className="text-lg font-semibold tracking-tight">AccessVault</p>
              <p className="text-xs text-slate-300">Client access codes</p>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold",
                  active ? "bg-white/10 text-white shadow-[inset_3px_0_0_#14b8a6]" : "text-slate-200 hover:bg-white/5",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {collapsed ? null : link.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 px-3 pb-5">
          <button type="button" onClick={onLock} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-100 hover:bg-white/10">
            <Lock className="h-5 w-5" />
            {collapsed ? null : "Lock now"}
          </button>
          {collapsed ? null : <p className="truncate px-3 text-xs text-slate-300">{email}</p>}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex min-h-11 w-full items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>
      </aside>

      <div className={cn("min-h-screen", collapsed ? "md:pl-20" : "md:pl-72")}>
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:hidden">
              <Lock className="h-5 w-5 text-navy" />
              <span className="font-semibold">AccessVault</span>
            </div>
            <p className={cn("text-sm font-medium", offline ? "text-danger" : "text-muted")} role="status">
              {offline ? "Offline. Vault data is not available without a connection." : syncLabel}
            </p>
            <button type="button" onClick={onLock} className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-navy md:hidden">
              <Lock className="h-4 w-4" />
              Lock
            </button>
          </div>
        </header>
        {offline ? (
          <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:mx-8">
            You are offline. Search refresh, saving, and cloud sync need a connection. AccessVault does not keep a readable offline copy of your codes.
          </div>
        ) : null}
        <main className="safe-bottom px-4 py-6 md:px-8">{children}</main>
      </div>

      <nav
        data-testid="mobile-nav"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Mobile"
      >
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                active ? "text-teal-800" : "text-muted",
              )}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function syncLabelFor(kind: string): string {
  if (kind === "syncing") return "Saving to the cloud…";
  if (kind === "saved") return "Synced";
  if (kind === "conflict") return "Cloud conflict. Your latest edit was not overwritten.";
  if (kind === "error") return "Not synced";
  if (kind === "offline") return "Offline";
  return "Ready";
}
