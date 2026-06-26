import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { anonClient, serviceClient } from './supabase';
import { can, isStaffRole, type Capability, type StaffRole } from './rbac';

const COOKIE = 'bandi_admin';
const MAX_AGE = 60 * 60 * 8; // 8 hours

export interface AdminSession {
  uid: string;
  email: string;
  name: string;
  role: StaffRole;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('Missing env var: SESSION_SECRET');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as AdminSession;
  } catch {
    return null;
  }
}

/** Read the current admin session from the cookie (verified). */
export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return decode(store.get(COOKIE)?.value);
}

/**
 * Page guard: require a session that holds `capability`, else redirect.
 * No session → login; insufficient role → dashboard. Use at the top of any
 * page a non-privileged role shouldn't reach by typing the URL.
 */
export async function requirePageCapability(
  capability: Capability,
  locale: string,
): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (!can(session.role, capability)) redirect(`/${locale}`);
  return session;
}

/**
 * Verify staff credentials against Supabase auth, confirm the profile role is a
 * staff role (admin / super_admin / support), and set a signed session cookie.
 * Returns an error string on failure.
 */
const MAX_FAILED_ATTEMPTS = 3; // lock after MORE than 3 invalid attempts
const LOCK_MINUTES = 15;

/** Record a failed login attempt and lock the email once it exceeds the limit. */
async function recordFailure(email: string): Promise<void> {
  const svc = serviceClient();
  const { data } = await svc
    .from('admin_login_attempts')
    .select('fail_count')
    .eq('email', email)
    .maybeSingle();
  const next = ((data?.fail_count as number) ?? 0) + 1;
  const locked_until =
    next > MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
      : null;
  await svc.from('admin_login_attempts').upsert({
    email,
    fail_count: next,
    locked_until,
    updated_at: new Date().toISOString(),
  });
}

/** Clear the failed-attempt counter for an email (on a successful login). */
async function clearFailures(email: string): Promise<void> {
  await serviceClient()
    .from('admin_login_attempts')
    .delete()
    .eq('email', email);
}

export async function signIn(
  email: string,
  password: string,
): Promise<string | null> {
  const svc = serviceClient();

  // Lockout gate: refuse if this email is currently locked out.
  const { data: attempt } = await svc
    .from('admin_login_attempts')
    .select('locked_until')
    .eq('email', email)
    .maybeSingle();
  if (
    attempt?.locked_until &&
    new Date(attempt.locked_until as string) > new Date()
  ) {
    return `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`;
  }

  const auth = anonClient();
  const { data, error } = await auth.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    await recordFailure(email);
    return 'Invalid email or password';
  }

  const { data: profile } = await svc
    .from('admin_profiles')
    .select('role, full_name, is_blocked')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || !isStaffRole(profile.role as string)) {
    await recordFailure(email);
    return 'This account does not have console access';
  }
  if (profile.is_blocked) return 'This account is blocked';

  await clearFailures(email);

  const session: AdminSession = {
    uid: data.user.id,
    email,
    name: (profile.full_name as string) ?? 'Staff',
    role: profile.role as StaffRole,
  };
  const store = await cookies();
  store.set(COOKIE, encode(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return null;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Re-issue the session cookie with updated fields (e.g. after a name edit). */
export async function updateSession(
  patch: Partial<AdminSession>,
): Promise<void> {
  const current = await getSession();
  if (!current) return;
  const next = { ...current, ...patch };
  const store = await cookies();
  store.set(COOKIE, encode(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}
