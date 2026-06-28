'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  Car,
  UserPlus,
  Users,
  Route,
  Wallet,
  BarChart3,
  Star,
  SlidersHorizontal,
  LifeBuoy,
  Inbox,
  Flag,
  ClipboardCheck,
  Gavel,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { can, type StaffRole } from '@/lib/rbac';
import {
  NAV_ITEMS,
  NAV_GROUP_LABEL,
  type NavIcon,
  type NavItem,
} from '@/lib/nav';
import type { Dictionary } from '@/lib/i18n/dictionaries';

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  live: Radio,
  drivers: Car,
  onboarding: UserPlus,
  riders: Users,
  rides: Route,
  money: Wallet,
  analytics: BarChart3,
  ratings: Star,
  fares: SlidersHorizontal,
  support: LifeBuoy,
  requests: Inbox,
  reports: Flag,
  operations: ClipboardCheck,
  disputes: Gavel,
  staff: ShieldCheck,
  settings: Settings,
};

const GROUP_ORDER: NavItem['group'][] = [
  'overview',
  'people',
  'operations',
  'finance',
  'admin',
];

export function AppSidebar({
  role,
  locale,
  dict,
}: {
  role: StaffRole;
  locale: string;
  dict: Dictionary;
}) {
  const pathname = usePathname();
  const base = `/${locale}`;
  const allowed = NAV_ITEMS.filter((item) => can(role, item.capability));

  const href = (item: NavItem) => (item.href ? `${base}/${item.href}` : base);
  const isActive = (item: NavItem) => {
    const full = href(item);
    return item.href ? pathname.startsWith(full) : pathname === base;
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-base font-black text-primary-foreground shadow-lg shadow-primary/30">
          B
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-sidebar-active-foreground">
            Bandi
          </div>
          <div className="text-[11px] text-sidebar-muted">Operations</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {GROUP_ORDER.map((group) => {
          const items = allowed.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                {NAV_GROUP_LABEL[group]}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = isActive(item);
                  return (
                    <li key={item.key}>
                      <Link
                        href={href(item)}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-sidebar-active text-sidebar-active-foreground shadow-sm shadow-primary/30'
                            : 'text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-active-foreground',
                        )}
                      >
                        <Icon className="size-4.5 shrink-0" />
                        {dict.nav[item.key]}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-[10px] text-sidebar-muted">{dict.tagline}</p>
      </div>
    </aside>
  );
}
