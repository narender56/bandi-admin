import type { Capability } from './rbac';
import type { Dictionary } from './i18n/dictionaries';

export type NavIcon =
  | 'dashboard'
  | 'live'
  | 'drivers'
  | 'onboarding'
  | 'riders'
  | 'rides'
  | 'money'
  | 'analytics'
  | 'ratings'
  | 'fares'
  | 'support'
  | 'requests'
  | 'reports'
  | 'operations'
  | 'staff'
  | 'settings';

export interface NavItem {
  key: keyof Dictionary['nav'];
  href: string; // relative to /[locale]
  icon: NavIcon;
  capability: Capability;
  group: 'overview' | 'people' | 'operations' | 'finance' | 'admin';
}

/** Single source of truth for the sidebar. Each item is capability-gated. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '', icon: 'dashboard', capability: 'analytics:read', group: 'overview' },

  { key: 'drivers', href: 'drivers', icon: 'drivers', capability: 'directory:browse', group: 'people' },
  { key: 'riders', href: 'riders', icon: 'riders', capability: 'directory:browse', group: 'people' },

  { key: 'rides', href: 'rides', icon: 'rides', capability: 'profiles:view', group: 'operations' },
  { key: 'operations', href: 'operations', icon: 'operations', capability: 'operations:manage', group: 'operations' },
  { key: 'support', href: 'support', icon: 'support', capability: 'support:manage', group: 'operations' },
  { key: 'requests', href: 'requests', icon: 'requests', capability: 'support:manage', group: 'operations' },
  { key: 'reports', href: 'reports', icon: 'reports', capability: 'support:manage', group: 'operations' },

  { key: 'money', href: 'money', icon: 'money', capability: 'finance:view', group: 'finance' },
  { key: 'analytics', href: 'analytics', icon: 'analytics', capability: 'analytics:read', group: 'finance' },
  { key: 'fares', href: 'fares', icon: 'fares', capability: 'fares:write', group: 'finance' },

  { key: 'staff', href: 'staff', icon: 'staff', capability: 'staff:manage', group: 'admin' },
  { key: 'appSettings', href: 'app-settings', icon: 'settings', capability: 'settings:write', group: 'admin' },
];

export const NAV_GROUP_LABEL: Record<NavItem['group'], string> = {
  overview: 'Overview',
  people: 'People',
  operations: 'Operations',
  finance: 'Finance',
  admin: 'Administration',
};
