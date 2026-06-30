/**
 * Role-based access control for the admin console.
 *
 * The admin web talks to Supabase with the service-role key (bypasses RLS), so
 * RBAC is enforced here at the app layer — every server action checks a
 * capability, and the sidebar/pages hide what a role can't use. Capabilities
 * (not roles) are checked at call sites so the matrix can change in one place.
 */

export type StaffRole = 'super_admin' | 'admin' | 'support';

export type Capability =
  | 'analytics:read' // dashboards, charts, leaderboards
  | 'finance:view' // revenue, subscriptions, wallet reconciliation
  | 'fares:write' // tune fare config
  | 'subscriptions:manage' // set subscription plans + grant free subscriptions
  | 'wallet:manage' // credit/debit a driver's wallet (e.g. cash recharge)
  | 'staff:manage' // create/edit staff + roles
  | 'drivers:onboard' // approve/reject drivers + documents
  | 'directory:browse' // browse the driver / rider directories
  | 'users:block' // block/unblock riders & drivers
  | 'live:view' // live rides + map
  | 'rides:cancel' // cancel an in-flight ride
  | 'operations:manage' // own and resolve cross-domain exception cases
  | 'support:manage' // triage/resolve support tickets
  | 'profiles:view' // open driver/rider profiles
  | 'sos:ack' // acknowledge/resolve SOS alerts
  | 'settings:write'; // edit app-wide settings (penalties, etc.)

const MATRIX: Record<StaffRole, Capability[]> = {
  super_admin: [
    'analytics:read',
    'finance:view',
    'fares:write',
    'subscriptions:manage',
    'wallet:manage',
    'staff:manage',
    'drivers:onboard',
    'directory:browse',
    'users:block',
    'live:view',
    'rides:cancel',
    'operations:manage',
    'support:manage',
    'profiles:view',
    'sos:ack',
    'settings:write',
  ],
  admin: [
    'analytics:read',
    'finance:view',
    'fares:write', // region-scoped at the action layer (see actions.ts)
    'subscriptions:manage',
    'wallet:manage',
    'drivers:onboard',
    'directory:browse',
    'users:block',
    'live:view',
    'rides:cancel',
    'operations:manage',
    'support:manage',
    'profiles:view',
    'sos:ack',
    'settings:write',
  ],
  support: ['support:manage', 'profiles:view', 'sos:ack', 'operations:manage', 'rides:cancel'],
};

export const STAFF_ROLES: readonly StaffRole[] = ['super_admin', 'admin', 'support'];

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

export function can(role: StaffRole, capability: Capability): boolean {
  return MATRIX[role]?.includes(capability) ?? false;
}
