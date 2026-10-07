"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Heart,
  FileText,
  Map,
  Radio,
  BarChart3,
  Users,
  MapPin,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { SessionPayload } from "@/lib/auth";

interface Props {
  session: SessionPayload;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileText;
  minRole: "family" | "volunteer" | "operator" | "admin";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/reports", label: "Reports", icon: FileText, minRole: "volunteer" },
  { href: "/reports/new", label: "New Report", icon: FileText, minRole: "volunteer" },
  { href: "/map", label: "Map", icon: Map, minRole: "volunteer" },
  { href: "/control", label: "Control Room", icon: Radio, minRole: "operator" },
  { href: "/control/monitor", label: "Crowd Monitor", icon: Shield, minRole: "operator" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, minRole: "admin" },
  { href: "/admin/users", label: "Users", icon: Users, minRole: "admin" },
  { href: "/admin/pois", label: "POI Management", icon: MapPin, minRole: "admin" },
];

const ROLE_LEVEL: Record<string, number> = {
  family: 0,
  volunteer: 1,
  operator: 2,
  admin: 3,
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-danger-bg text-destructive",
  operator: "bg-primary-subtle text-saffron",
  volunteer: "bg-success-bg text-success-text",
  family: "bg-info-bg text-info-text",
};

export function DashboardShell({ session, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userLevel = ROLE_LEVEL[session.role] ?? 0;
  const visibleItems = NAV_ITEMS.filter(
    (item) => userLevel >= (ROLE_LEVEL[item.minRole] ?? 0)
  );

  const handleLogout = async () => {
    await fetch("/api/auth?action=logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-subtle">
              <Heart size={18} className="text-saffron" />
            </div>
            <span className="text-lg font-bold text-foreground">
              Kumbh Milaap
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-ink-2 hover:bg-neutral-bg lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-subtle text-saffron"
                    : "text-ink-2 hover:bg-neutral-bg hover:text-foreground"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal/5 text-sm font-bold text-foreground">
              {session.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {session.name}
              </p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-2xs font-bold uppercase ${
                  ROLE_COLORS[session.role] ?? ""
                }`}
              >
                {session.role}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink-2 transition-colors hover:bg-neutral-bg hover:text-foreground"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-foreground hover:bg-neutral-bg"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-saffron" />
            <span className="font-bold text-foreground">Kumbh Milaap</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-2xs font-bold uppercase ${
                ROLE_COLORS[session.role] ?? ""
              }`}
            >
              {session.role}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
