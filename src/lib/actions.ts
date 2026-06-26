'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createHash, randomInt, randomUUID } from 'node:crypto';

import { EXPIRING_DOC_TYPES } from './driver-docs';
import type { VehicleType } from './vehicle-types';

import {
  getSession,
  signIn,
  signOut,
  updateSession,
  type AdminSession,
} from './auth';
import { serviceClient } from './supabase';
import { can, type Capability } from './rbac';
import {
  listLiveRides,
  listActiveSos,
  getStaffRegions,
  regionContainsScope,
  globalSearch,
  type LiveRideRow,
  type SosRow,
  type FareScope,
  type SearchResult,
} from './data';

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const locale = String(formData.get('locale') ?? 'en');
  if (!email || !password) return 'Enter your email and password';

  const error = await signIn(email, password);
  if (error) return error;
  redirect(`/${locale}`);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'en');
  await signOut();
  redirect(`/${locale}/login`);
}

/** Require a logged-in staff session, then assert it holds the capability. */
async function requireCapability(
  capability: Capability,
): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  if (!can(session.role, capability)) throw new Error('Forbidden');
  return session;
}

/** Append an entry to the admin audit log (best-effort; never blocks the action). */
async function audit(
  session: AdminSession,
  action: string,
  entity: string,
  entityId: string,
  summary?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await serviceClient().from('admin_audit_log').insert({
      actor_id: session.uid,
      actor_role: session.role,
      action,
      entity,
      entity_id: entityId,
      summary,
      meta,
    });
  } catch {
    // Audit logging must never break the primary action.
  }
}

/**
 * Notify a rider/driver about a change to their ticket / report / alert.
 * Writes an in-app notification row (delivered by the mobile app). Best-effort —
 * never blocks the primary action.
 *
 * NOTE: email/SMS delivery is not wired here — no SMTP/SMS provider is configured
 * yet. When one is added, dispatch it from this single helper so every status
 * transition stays in sync.
 */
async function notifyUser(
  userId: string,
  recipientRole: 'rider' | 'driver',
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await serviceClient()
      .from('notifications')
      .insert({
        user_id: userId,
        recipient_role: recipientRole,
        title,
        body,
        data: data ?? null,
        is_read: false,
      });
  } catch {
    // Notification delivery must never break the primary action.
  }
}

// ── Global search (header) ───────────────────────────────────
/** Debounced header search across drivers & riders by name or phone. */
export async function searchAction(term: string): Promise<SearchResult> {
  await requireCapability('profiles:view');
  return globalSearch(term);
}

export type WebsiteLeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'closed'
  | 'spam';

export async function setWebsiteLeadStatus(
  leadId: string,
  status: WebsiteLeadStatus,
): Promise<void> {
  const session = await requireCapability('support:manage');
  await serviceClient()
    .from('website_leads')
    .update({ status })
    .eq('id', leadId);
  await audit(
    session,
    'website_lead.status',
    'website_lead',
    leadId,
    `Set website lead status to ${status}`,
  );
  revalidatePath('/[locale]/requests', 'page');
}

// ── Live monitoring ──────────────────────────────────────────
export async function fetchLiveData(): Promise<{
  rides: LiveRideRow[];
  sos: SosRow[];
}> {
  await requireCapability('live:view');
  const [rides, sos] = await Promise.all([listLiveRides(), listActiveSos()]);
  return { rides, sos };
}

/** Force-cancel a live ride and free its assigned driver. */
export async function adminCancelRide(rideId: string): Promise<void> {
  const session = await requireCapability('rides:cancel');
  const svc = serviceClient();
  const { data: ride } = await svc
    .from('rides')
    .select('driver_id')
    .eq('id', rideId)
    .maybeSingle();
  await svc
    .from('rides')
    .update({
      status: 'cancelled',
      cancelled_by: 'system',
      cancel_reason: 'admin',
    })
    .eq('id', rideId);
  const driverId = (ride as { driver_id?: string } | null)?.driver_id;
  if (driverId) {
    await svc.from('drivers').update({ status: 'online' }).eq('id', driverId);
  }
  await audit(
    session,
    'ride.cancel',
    'ride',
    rideId,
    'Force-cancelled by admin',
  );
  revalidatePath('/[locale]/live', 'page');
}

/** Acknowledge an SOS alert (staff is now on it). */
export async function acknowledgeSos(sosId: string): Promise<void> {
  const session = await requireCapability('sos:ack');
  const svc = serviceClient();
  const { data: row } = await svc
    .from('sos_alerts')
    .select('user_id, role')
    .eq('id', sosId)
    .maybeSingle();
  await svc
    .from('sos_alerts')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', sosId);
  await audit(session, 'sos.acknowledge', 'sos_alert', sosId);
  if (row?.user_id) {
    await notifyUser(
      row.user_id as string,
      row.role as 'rider' | 'driver',
      'Help is on the way',
      'Our safety team has seen your SOS alert and is responding now.',
      { sos_id: sosId, status: 'acknowledged' },
    );
  }
  revalidatePath('/[locale]/support', 'page');
  revalidatePath('/[locale]/live', 'page');
}

/** Mark an SOS alert as resolved. */
export async function resolveSos(sosId: string): Promise<void> {
  const session = await requireCapability('sos:ack');
  const svc = serviceClient();
  const { data: row } = await svc
    .from('sos_alerts')
    .select('user_id, role')
    .eq('id', sosId)
    .maybeSingle();
  await svc
    .from('sos_alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: session.uid,
    })
    .eq('id', sosId);
  await audit(session, 'sos.resolve', 'sos_alert', sosId);
  if (row?.user_id) {
    await notifyUser(
      row.user_id as string,
      row.role as 'rider' | 'driver',
      'SOS resolved',
      'Your SOS alert has been resolved. Stay safe — contact us anytime if you need more help.',
      { sos_id: sosId, status: 'resolved' },
    );
  }
  revalidatePath('/[locale]/support', 'page');
  revalidatePath('/[locale]/live', 'page');
}

/** True if the driver currently has a ride that is accepted/arrived/in progress. */
async function hasActiveRide(
  svc: ReturnType<typeof serviceClient>,
  driverId: string,
): Promise<boolean> {
  const { data } = await svc
    .from('rides')
    .select('id')
    .eq('driver_id', driverId)
    .in('status', ['accepted', 'arrived', 'in_progress'])
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function setDriverApproval(
  driverId: string,
  approved: boolean,
): Promise<void> {
  const session = await requireCapability('drivers:onboard');
  const svc = serviceClient();
  if (approved) {
    const validationError = await validateDriverForApproval(driverId);
    if (validationError) throw new Error(validationError);
  }
  // Don't cut a driver off mid-ride: when revoking during an active ride, set
  // the flag now but leave them online so the current ride finishes. They
  // can't go back online afterwards (check_go_online gates unapproved drivers).
  const onActiveRide = !approved && (await hasActiveRide(svc, driverId));
  await svc
    .from('drivers')
    .update({
      is_approved: approved,
      ...(onActiveRide ? {} : { status: 'offline' }),
      onboarding_verified_at: approved ? new Date().toISOString() : null,
      onboarding_verified_by: approved ? session.uid : null,
    })
    .eq('id', driverId);
  if (!onActiveRide) {
    await svc.from('driver_locations').update({ is_online: false }).eq('driver_id', driverId);
  }
  await audit(
    session,
    approved ? 'driver.approve' : 'driver.revoke',
    'driver',
    driverId,
  );
  revalidatePath('/[locale]/drivers', 'page');
}

/**
 * Create a driver from the admin console: provisions the auth user, the
 * profile (role=driver), the drivers row, an initial vehicle and a wallet.
 * Created unapproved so it still flows through onboarding/document review.
 */
export type DriverDocType =
  | 'license'
  | 'rc'
  | 'permit'
  | 'insurance'
  | 'photo'
  | 'aadhaar'
  | 'puc';

const REQUIRED_DRIVER_DOCS: DriverDocType[] = [
  'license',
  'rc',
  'permit',
  'insurance',
  'puc',
  'aadhaar',
];

export type UploadedDriverFile = {
  storagePath: string;
  publicUrl: string;
  fileName: string;
};

export async function uploadDriverOnboardingFile(
  formData: FormData,
  kind: 'avatar' | 'vehicle' | 'document' | 'payment',
): Promise<{ file?: UploadedDriverFile; error?: string }> {
  const session = await requireCapability('drivers:onboard');
  const value = formData.get('file');
  if (!(value instanceof File) || value.size === 0) return { error: 'Choose a file' };
  if (value.size > 10 * 1024 * 1024) return { error: 'File must be 10 MB or smaller' };
  const allowed = kind === 'document'
    ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    : ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(value.type)) return { error: 'Use JPG, PNG, WebP, or PDF for documents' };
  const extension = value.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `onboarding/${session.uid}/${kind}/${randomUUID()}.${extension}`;
  const svc = serviceClient();
  const uploaded = await svc.storage.from('driver-onboarding').upload(
    path,
    Buffer.from(await value.arrayBuffer()),
    { contentType: value.type, upsert: false },
  );
  if (uploaded.error) return { error: uploaded.error.message };
  return {
    file: {
      storagePath: path,
      publicUrl: svc.storage.from('driver-onboarding').getPublicUrl(path).data.publicUrl,
      fileName: value.name,
    },
  };
}

export async function removeDriverOnboardingFile(storagePath: string): Promise<string | null> {
  const session = await requireCapability('drivers:onboard');
  if (!storagePath.startsWith(`onboarding/${session.uid}/`)) return 'Invalid upload path';
  const result = await serviceClient().storage.from('driver-onboarding').remove([storagePath]);
  return result.error?.message ?? null;
}

const otpHash = (code: string): string =>
  createHash('sha256').update(code).digest('hex');

export async function sendDriverOnboardingOtp(
  phone: string,
): Promise<{ challengeId?: string; testCode?: string; error?: string }> {
  const session = await requireCapability('drivers:onboard');
  const normalized = phone.trim();
  if (!/^(\+91[-\s]?|0)?[6-9]\d{9}$/.test(normalized)) return { error: 'Enter a valid Indian mobile number' };
  const code = String(randomInt(100000, 1000000));
  const result = await serviceClient().from('driver_onboarding_otp_challenges').insert({
    phone: normalized,
    code_hash: otpHash(code),
    created_by: session.uid,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }).select('id').single();
  if (result.error) return { error: result.error.message };
  // Replace this returned test code with SMS delivery before production launch.
  return { challengeId: result.data.id as string, testCode: code };
}

export async function verifyDriverOnboardingOtp(
  challengeId: string,
  code: string,
): Promise<string | null> {
  const session = await requireCapability('drivers:onboard');
  const svc = serviceClient();
  const challenge = await svc.from('driver_onboarding_otp_challenges')
    .select('id, code_hash, expires_at, verified_at, consumed_at, attempts')
    .eq('id', challengeId).eq('created_by', session.uid).maybeSingle();
  if (!challenge.data) return 'OTP challenge not found';
  if (challenge.data.consumed_at) return 'OTP was already used';
  if (new Date(challenge.data.expires_at as string) < new Date()) return 'OTP has expired';
  if ((challenge.data.attempts as number) >= 5) return 'Too many incorrect attempts';
  if (challenge.data.code_hash !== otpHash(code.trim())) {
    await svc.from('driver_onboarding_otp_challenges').update({ attempts: (challenge.data.attempts as number) + 1 }).eq('id', challengeId);
    return 'Code does not match';
  }
  const result = await svc.from('driver_onboarding_otp_challenges')
    .update({ verified_at: new Date().toISOString() }).eq('id', challengeId);
  return result.error?.message ?? null;
}

async function validateDriverForApproval(driverId: string): Promise<string | null> {
  const svc = serviceClient();
  const [driver, vehicles, documents] = await Promise.all([
    svc.from('drivers').select('full_name, phone, email, dob, gender, country, state, city, avatar_url, is_blocked, is_on_hold').eq('id', driverId).maybeSingle(),
    svc.from('vehicles').select('reg_no, model, color, photos').eq('driver_id', driverId).eq('is_active', true),
    svc.from('driver_documents').select('type, status, file_url').eq('driver_id', driverId),
  ]);
  const d = driver.data as Record<string, unknown> | null;
  if (!d) return 'Driver not found';
  const missingProfile = ['full_name', 'phone', 'email', 'dob', 'gender', 'country', 'state', 'city', 'avatar_url']
    .filter((key) => !String(d[key] ?? '').trim());
  if (missingProfile.length) return `Missing driver details: ${missingProfile.join(', ')}`;
  if (d.is_blocked === true || d.is_on_hold === true) return 'Blocked or held drivers cannot be approved';
  const vehicle = (vehicles.data ?? [])[0] as Record<string, unknown> | undefined;
  if (!vehicle || !vehicle.reg_no || !vehicle.model || !vehicle.color) return 'Complete vehicle details are required';
  if (!Array.isArray(vehicle.photos) || vehicle.photos.length < 3) return 'Front, rear, and side vehicle photos are required';
  const docs = (documents.data ?? []) as { type: string; status: string; file_url: string }[];
  for (const type of REQUIRED_DRIVER_DOCS) {
    if (!docs.some((doc) => doc.type === type && doc.status === 'approved' && doc.file_url)) {
      return `${type} must be uploaded and approved`;
    }
  }
  return null;
}

export async function createDriver(input: {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  country: string;
  state: string;
  city: string;
  vehicleType: VehicleType;
  regNo: string;
  model: string;
  color: string;
  upiId: string;
  paymentPhone: string;
  paymentQr?: UploadedDriverFile;
  avatar: UploadedDriverFile;
  vehiclePhotos: UploadedDriverFile[];
  documents: { type: DriverDocType; file: UploadedDriverFile; expiresAt?: string }[];
  verifiedInPerson: boolean;
  otpChallengeId: string;
}): Promise<string | null> {
  const session = await requireCapability('drivers:onboard');
  // Drivers authenticate with mobile-number OTP only — no password. Email is
  // optional. The phone is the identity, so it is required here.
  const requiredText = [input.fullName, input.email, input.phone, input.gender, input.dob, input.country, input.state, input.city, input.regNo, input.model, input.color];
  if (requiredText.some((value) => !value?.trim())) return 'Every driver and vehicle detail is required';
  if (!input.upiId?.trim() && !input.paymentPhone?.trim()) {
    return 'Add at least one way for riders to pay the driver (UPI ID or payment phone)';
  }
  if (!input.verifiedInPerson) return 'Confirm that identity and originals were verified in person';
  if (!input.avatar?.publicUrl) return 'Driver profile photo is required';
  if (input.vehiclePhotos.length < 3) return 'Front, rear, and side vehicle photos are required';
  const docTypes = new Set(input.documents.map((doc) => doc.type));
  if (REQUIRED_DRIVER_DOCS.some((type) => !docTypes.has(type))) return 'All required documents must be uploaded';
  const missingExpiry = input.documents.find(
    (doc) => EXPIRING_DOC_TYPES.includes(doc.type) && !doc.expiresAt,
  );
  if (missingExpiry) return `Enter the expiry date for the ${missingExpiry.type} document`;
  const svc = serviceClient();
  const challenge = await svc.from('driver_onboarding_otp_challenges')
    .select('id, phone, verified_at, expires_at, consumed_at')
    .eq('id', input.otpChallengeId).eq('created_by', session.uid).maybeSingle();
  if (!challenge.data || challenge.data.phone !== input.phone.trim() || !challenge.data.verified_at || challenge.data.consumed_at) {
    return 'Verify this mobile number with OTP before creating the driver';
  }
  if (new Date(challenge.data.expires_at as string) < new Date()) return 'OTP verification has expired';
  const { data, error } = await svc.auth.admin.createUser({
    phone: input.phone.trim(),
    email: input.email?.trim() || undefined,
    phone_confirm: true,
    email_confirm: !!input.email?.trim(),
  });
  if (error || !data.user) return error?.message ?? 'Could not create user';
  const uid = data.user.id;

  try {
    const driverResult = await svc.from('drivers').insert({
      id: uid,
      status: 'offline',
      is_approved: true,
      onboarding_verified_at: new Date().toISOString(),
      onboarding_verified_by: session.uid,
      city: input.city.trim(),
      state: input.state.trim(),
      country: input.country.trim(),
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      dob: input.dob,
      gender: input.gender.trim(),
      avatar_url: input.avatar.publicUrl,
      upi_id: input.upiId?.trim() || null,
      payment_phone: input.paymentPhone?.trim() || null,
      upi_qr_url: input.paymentQr?.publicUrl ?? null,
    });
    if (driverResult.error) throw driverResult.error;
    const vehicleResult = await svc.from('vehicles').insert({
      driver_id: uid,
      type: input.vehicleType,
      reg_no: input.regNo.trim(),
      model: input.model.trim(),
      color: input.color.trim(),
      photos: input.vehiclePhotos.map((photo) => photo.publicUrl),
    });
    if (vehicleResult.error) throw vehicleResult.error;
    const docsResult = await svc.from('driver_documents').insert(
      input.documents.map((d) => ({
          driver_id: uid,
          type: d.type,
          file_url: d.file.publicUrl,
          status: 'approved',
          expires_at: d.expiresAt ?? null,
          reviewed_by: session.uid,
          reviewed_at: new Date().toISOString(),
          notes: 'Original verified during onboarding',
      })),
    );
    if (docsResult.error) throw docsResult.error;
    const walletResult = await svc.from('wallets').insert({ driver_id: uid, balance: 0 });
    if (walletResult.error) throw walletResult.error;
    await svc.from('driver_onboarding_otp_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', input.otpChallengeId);
  } catch (error) {
    await svc.auth.admin.deleteUser(uid);
    return error instanceof Error ? error.message : 'Could not create driver';
  }
  await audit(session, 'driver.create', 'driver', uid, input.fullName, {
    city: input.city,
    phone: input.phone,
    otp_verified_at: challenge.data.verified_at,
    onboarding_verified_at: challenge.data.verified_at,
  });
  revalidatePath('/[locale]/drivers', 'page');
  return null;
}

/** Edit a driver's base data: profile fields, city, and primary vehicle. */
export async function updateDriverBaseData(
  driverId: string,
  values: {
    fullName: string;
    phone: string;
    email: string;
    dob: string;
    gender: string;
    country: string;
    state: string;
    city: string;
    vehicleType: string;
    regNo: string;
    model: string;
    color: string;
  },
): Promise<string | null> {
  const session = await requireCapability('drivers:onboard');
  if (!values.fullName.trim()) return 'Name is required';
  if (!values.phone.trim() || !values.gender.trim() || !values.city.trim()) {
    return 'Phone, gender, and city are required';
  }
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return 'Enter a valid email';
  }
  if (!values.regNo.trim() || !values.model.trim() || !values.color.trim()) {
    return 'Registration, model, and vehicle color are required';
  }
  const svc = serviceClient();

  await svc
    .from('drivers')
    .update({
      full_name: values.fullName.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      dob: values.dob.trim() || null,
      gender: values.gender.trim() || null,
      country: values.country.trim() || null,
      state: values.state.trim() || null,
      city: values.city.trim() || null,
    })
    .eq('id', driverId);

  const { data: existing } = await svc
    .from('vehicles')
    .select('id')
    .eq('driver_id', driverId)
    .limit(1)
    .maybeSingle();
  const vehicleFields = {
    type: values.vehicleType.trim() || 'auto',
    reg_no: values.regNo.trim(),
    model: values.model.trim() || null,
    color: values.color.trim() || null,
  };
  if (existing) {
    if (vehicleFields.reg_no) {
      await svc
        .from('vehicles')
        .update(vehicleFields)
        .eq('id', (existing as { id: string }).id);
    }
  } else if (vehicleFields.reg_no) {
    await svc
      .from('vehicles')
      .insert({ driver_id: driverId, ...vehicleFields });
  }

  await audit(session, 'driver.update', 'driver', driverId, values.fullName);
  revalidatePath('/[locale]/drivers/[id]', 'page');
  return null;
}

/**
 * Assert the session may edit fares for a geographic scope. super_admin is
 * unrestricted; an admin must hold a region grant that contains the scope.
 */
async function assertFareScopeAllowed(
  session: AdminSession,
  scope: FareScope,
): Promise<void> {
  if (session.role === 'super_admin') return;
  const regions = await getStaffRegions(session.uid);
  if (!regions.some((r) => regionContainsScope(r, scope))) {
    throw new Error('Forbidden: fare scope is outside your assigned regions');
  }
}

const norm = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

function scopeLabel(scope: FareScope): string {
  return (
    [scope.city, scope.state, scope.country].filter(Boolean).join(', ') ||
    'Global'
  );
}

export interface FareValues {
  base_fare: number;
  distance_rate: number;
  time_rate: number;
  waiting_rate: number;
  free_waiting_minutes: number;
  surcharge: number;
}

export async function updateFareConfig(
  id: string,
  values: FareValues,
): Promise<void> {
  const session = await requireCapability('fares:write');
  const svc = serviceClient();
  const { data: row } = await svc
    .from('fare_config')
    .select('country, state, city')
    .eq('id', id)
    .maybeSingle();
  if (!row) throw new Error('Fare config not found');
  const scope = row as unknown as FareScope;
  await assertFareScopeAllowed(session, scope);

  await svc
    .from('fare_config')
    .update({
      ...values,
      updated_by: session.uid,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  await audit(session, 'fare.update', 'fare_config', id, scopeLabel(scope), {
    ...values,
  });
  revalidatePath('/[locale]/fares', 'page');
}

/** Create a fare row for a new geographic scope (region-checked). */
export async function createFareConfig(values: {
  vehicle_type: VehicleType;
  country: string | null;
  state: string | null;
  city: string | null;
  base_fare: number;
  distance_rate: number;
  time_rate: number;
  waiting_rate: number;
  free_waiting_minutes: number;
  surcharge: number;
}): Promise<string | null> {
  const session = await requireCapability('fares:write');
  const scope: FareScope = {
    country: norm(values.country),
    state: norm(values.state),
    city: norm(values.city),
  };
  // A city scope requires a state; a state scope requires a country.
  if (scope.city && !scope.state) return 'A city scope needs a state';
  if (scope.state && !scope.country) return 'A state scope needs a country';
  try {
    await assertFareScopeAllowed(session, scope);
  } catch {
    return 'That scope is outside your assigned regions';
  }

  const svc = serviceClient();
  const { error } = await svc.from('fare_config').insert({
    vehicle_type: values.vehicle_type,
    ...scope,
    base_fare: values.base_fare,
    distance_rate: values.distance_rate,
    time_rate: values.time_rate,
    waiting_rate: values.waiting_rate,
    free_waiting_minutes: values.free_waiting_minutes,
    surcharge: values.surcharge,
    is_active: true,
    updated_by: session.uid,
  });
  if (error) {
    return error.code === '23505'
      ? 'An active fare already exists for this scope'
      : error.message;
  }
  await audit(
    session,
    'fare.create',
    'fare_config',
    scopeLabel(scope),
    scopeLabel(scope),
    { ...values },
  );
  revalidatePath('/[locale]/fares', 'page');
  return null;
}

/** Deactivate a non-global fare scope (the global default cannot be removed). */
export async function removeFareConfig(id: string): Promise<void> {
  const session = await requireCapability('fares:write');
  const svc = serviceClient();
  const { data: row } = await svc
    .from('fare_config')
    .select('country, state, city')
    .eq('id', id)
    .maybeSingle();
  if (!row) throw new Error('Fare config not found');
  const scope = row as unknown as FareScope;
  if (!scope.country && !scope.state && !scope.city) {
    throw new Error('The global default fare cannot be removed');
  }
  await assertFareScopeAllowed(session, scope);
  await svc.from('fare_config').update({ is_active: false }).eq('id', id);
  await audit(session, 'fare.remove', 'fare_config', id, scopeLabel(scope));
  revalidatePath('/[locale]/fares', 'page');
}

/** Enable/disable a vehicle type platform-wide, or adjust its label/seats. */
export async function updateVehicleTypeConfig(
  type: string,
  values: { is_enabled?: boolean; seats?: number; label?: string },
): Promise<string | null> {
  const session = await requireCapability('fares:write');
  const patch: Record<string, unknown> = {};
  if (typeof values.is_enabled === 'boolean') patch.is_enabled = values.is_enabled;
  if (typeof values.seats === 'number') {
    if (!Number.isInteger(values.seats) || values.seats < 1) {
      return 'Seats must be a whole number of at least 1';
    }
    patch.seats = values.seats;
  }
  if (typeof values.label === 'string') {
    if (!values.label.trim()) return 'Enter a label';
    patch.label = values.label.trim();
  }
  if (Object.keys(patch).length === 0) return null;

  const svc = serviceClient();
  patch.updated_by = session.uid;
  patch.updated_at = new Date().toISOString();
  const { error } = await svc
    .from('vehicle_type_config')
    .update(patch)
    .eq('type', type);
  if (error) return error.message;
  await audit(session, 'vehicle_type.update', 'vehicle_type_config', type, type, patch);
  revalidatePath('/[locale]/fares', 'page');
  return null;
}

// ── Driver onboarding: document review ───────────────────────
export async function reviewDocument(
  docId: string,
  driverId: string,
  status: 'approved' | 'rejected',
  notes?: string,
  expiresAt?: string | null,
): Promise<void> {
  const session = await requireCapability('drivers:onboard');
  const svc = serviceClient();
  await svc
    .from('driver_documents')
    .update({
      status,
      notes: notes ?? null,
      // Only set on approval; clearing it on reject would lose the recorded date.
      ...(status === 'approved' ? { expires_at: expiresAt ?? null } : {}),
      reviewed_by: session.uid,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', docId);
  await audit(
    session,
    `document.${status}`,
    'driver_document',
    docId,
    undefined,
    {
      driver_id: driverId,
    },
  );
  revalidatePath('/[locale]/drivers/[id]', 'page');
}

/** Update only the expiry date of a document (e.g. after a renewal). */
export async function updateDocumentExpiry(
  docId: string,
  driverId: string,
  expiresAt: string,
): Promise<string | null> {
  const session = await requireCapability('drivers:onboard');
  if (!expiresAt.trim()) return 'Enter the new expiry date';
  const svc = serviceClient();
  await svc
    .from('driver_documents')
    .update({
      expires_at: expiresAt,
      reviewed_by: session.uid,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', docId);
  await audit(session, 'document.update_expiry', 'driver_document', docId, undefined, {
    driver_id: driverId,
    expires_at: expiresAt,
  });
  revalidatePath('/[locale]/drivers/[id]', 'page');
  return null;
}

/**
 * Replace a document's file with a freshly uploaded one and mark it approved
 * (the admin has just verified the new original). Optionally records expiry.
 */
export async function replaceDriverDocument(
  docId: string,
  driverId: string,
  fileUrl: string,
  expiresAt?: string | null,
): Promise<string | null> {
  const session = await requireCapability('drivers:onboard');
  if (!fileUrl.trim()) return 'Upload the new document first';
  const svc = serviceClient();
  await svc
    .from('driver_documents')
    .update({
      file_url: fileUrl,
      status: 'approved',
      notes: null,
      expires_at: expiresAt ?? null,
      reviewed_by: session.uid,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', docId);
  await audit(session, 'document.replace', 'driver_document', docId, undefined, {
    driver_id: driverId,
  });
  revalidatePath('/[locale]/drivers/[id]', 'page');
  return null;
}

// ── Block / unblock a rider or driver ────────────────────────
export async function setUserBlocked(
  userId: string,
  blocked: boolean,
  reason?: string,
): Promise<void> {
  const session = await requireCapability('users:block');
  const svc = serviceClient();
  const [riderRow, activeDriverRide, activeRiderRide] = await Promise.all([
    svc.from('riders').select('id').eq('id', userId).maybeSingle(),
    svc.from('rides').select('id').eq('driver_id', userId).in('status', ['accepted', 'arrived', 'in_progress']).limit(1).maybeSingle(),
    svc.from('rides').select('id').eq('rider_id', userId).in('status', ['accepted', 'arrived', 'in_progress']).limit(1).maybeSingle(),
  ]);
  // Don't interrupt a ride in progress: apply the block immediately but only
  // force the driver offline once no ride is active. The block stands, so they
  // can't go back online after the current ride ends.
  const onActiveRide = !!(activeDriverRide.data || activeRiderRide.data);
  const patch = {
    is_blocked: blocked,
    blocked_at: blocked ? new Date().toISOString() : null,
    blocked_by: blocked ? session.uid : null,
    block_reason: blocked ? (reason ?? null) : null,
  };
  // The id belongs to either a rider or a driver; apply to both (one no-ops).
  await Promise.all([
    svc.from('riders').update(patch).eq('id', userId),
    svc.from('drivers').update(patch).eq('id', userId),
  ]);
  if (blocked && !onActiveRide) {
    await svc.from('drivers').update({ status: 'offline' }).eq('id', userId);
    await svc.from('driver_locations').update({ is_online: false }).eq('driver_id', userId);
  }
  // Driver updates notify through the database driver trigger. Riders need an
  // explicit row, including when this auth identity also has a driver profile.
  if (riderRow.data) {
    await notifyUser(
      userId,
      'rider',
      blocked ? 'Account blocked' : 'Account unblocked',
      blocked
        ? `Your Bandi account has been blocked.${reason?.trim() ? ` Reason: ${reason.trim()}` : ''}`
        : 'Your Bandi account has been unblocked. You may use the app again.',
      { type: blocked ? 'account_blocked' : 'account_unblocked' },
    );
  }
  await audit(
    session,
    blocked ? 'user.block' : 'user.unblock',
    'user',
    userId,
    reason,
  );
  revalidatePath('/[locale]/drivers/[id]', 'page');
  revalidatePath('/[locale]/riders/[id]', 'page');
}

export async function setDriverHold(
  driverId: string,
  held: boolean,
  reason?: string,
): Promise<void> {
  const session = await requireCapability('users:block');
  const svc = serviceClient();
  // Don't interrupt a ride in progress: apply the hold immediately but only
  // force the driver offline once no ride is active. The hold stands, so they
  // can't go back online after the current ride ends.
  const onActiveRide = held && (await hasActiveRide(svc, driverId));
  await svc.from('drivers').update({
    is_on_hold: held,
    held_at: held ? new Date().toISOString() : null,
    held_by: held ? session.uid : null,
    hold_reason: held ? reason?.trim() || null : null,
    ...(onActiveRide ? {} : { status: 'offline' }),
  }).eq('id', driverId);
  if (!onActiveRide) {
    await svc.from('driver_locations').update({ is_online: false }).eq('driver_id', driverId);
  }
  await audit(session, held ? 'driver.hold' : 'driver.release_hold', 'driver', driverId, reason);
  revalidatePath('/[locale]/drivers/[id]', 'page');
}

// ── Staff management (super_admin only) ──────────────────────
export async function createStaff(
  email: string,
  password: string,
  fullName: string,
  role: 'admin' | 'support',
): Promise<string | null> {
  const session = await requireCapability('staff:manage');
  const svc = serviceClient();
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) return error?.message ?? 'Could not create user';
  await svc
    .from('admin_profiles')
    .upsert({ id: data.user.id, role, full_name: fullName, email });
  await audit(
    session,
    'staff.create',
    'admin_profile',
    data.user.id,
    fullName,
    {
      role,
      email,
    },
  );
  revalidatePath('/[locale]/staff', 'page');
  return null;
}

export async function setStaffRole(
  profileId: string,
  role: 'super_admin' | 'admin' | 'support',
): Promise<void> {
  const session = await requireCapability('staff:manage');
  const svc = serviceClient();
  await svc.from('admin_profiles').update({ role }).eq('id', profileId);
  await audit(
    session,
    'staff.role_change',
    'admin_profile',
    profileId,
    undefined,
    {
      role,
    },
  );
  revalidatePath('/[locale]/staff', 'page');
}

/** Block or re-activate a staff member (super_admin only). */
export async function setStaffBlocked(
  profileId: string,
  blocked: boolean,
): Promise<void> {
  const session = await requireCapability('staff:manage');
  const svc = serviceClient();
  await svc
    .from('admin_profiles')
    .update({
      is_blocked: blocked,
      blocked_at: blocked ? new Date().toISOString() : null,
      blocked_by: blocked ? session.uid : null,
      is_active: !blocked,
    })
    .eq('id', profileId);
  await audit(
    session,
    blocked ? 'staff.block' : 'staff.activate',
    'admin_profile',
    profileId,
  );
  revalidatePath('/[locale]/staff', 'page');
}

/** Grant a staff member access to a country / state / city. */
export async function assignStaffRegion(
  staffId: string,
  region: { country: string; state: string | null; city: string | null },
): Promise<string | null> {
  const session = await requireCapability('staff:manage');
  const country = norm(region.country);
  const state = norm(region.state);
  const city = norm(region.city);
  if (!country) return 'Country is required';
  if (city && !state) return 'A city needs a state';

  const svc = serviceClient();
  const { error } = await svc
    .from('staff_regions')
    .insert({ staff_id: staffId, country, state, city });
  if (error) {
    return error.code === '23505'
      ? 'That region is already assigned'
      : error.message;
  }
  await audit(session, 'staff.region_grant', 'profile', staffId, undefined, {
    country,
    state,
    city,
  });
  revalidatePath('/[locale]/staff', 'page');
  return null;
}

/** Revoke a previously granted region. */
export async function removeStaffRegion(
  regionId: string,
  staffId: string,
): Promise<void> {
  const session = await requireCapability('staff:manage');
  const svc = serviceClient();
  await svc.from('staff_regions').delete().eq('id', regionId);
  await audit(session, 'staff.region_revoke', 'profile', staffId, undefined, {
    regionId,
  });
  revalidatePath('/[locale]/staff', 'page');
}

// ── Support triage ───────────────────────────────────────────
export async function setTicketPriority(
  ticketId: string,
  priority: 'low' | 'normal' | 'high' | 'urgent',
): Promise<void> {
  const session = await requireCapability('support:manage');
  const svc = serviceClient();
  await svc.from('support_tickets').update({ priority }).eq('id', ticketId);
  await audit(
    session,
    'ticket.priority',
    'support_ticket',
    ticketId,
    undefined,
    { priority },
  );
  revalidatePath('/[locale]/support', 'page');
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

const TICKET_USER_MESSAGE: Record<
  TicketStatus,
  { title: string; body: string }
> = {
  open: {
    title: 'Your support request was reopened',
    body: "We've reopened your request and will take another look shortly.",
  },
  in_progress: {
    title: "We're on your support request",
    body: 'Our support team has started working on your request.',
  },
  resolved: {
    title: 'Your support request is resolved',
    body: "We've resolved your support request. Reply to it if you still need help.",
  },
};

/** Move a support ticket through its lifecycle (open → in progress → resolved). */
export async function setTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Promise<void> {
  const session = await requireCapability('support:manage');
  const svc = serviceClient();
  const { data: row } = await svc
    .from('support_tickets')
    .select('user_id, user_role')
    .eq('id', ticketId)
    .maybeSingle();

  await svc
    .from('support_tickets')
    .update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      resolved_by: status === 'resolved' ? session.uid : null,
    })
    .eq('id', ticketId);

  await audit(session, `ticket.${status}`, 'support_ticket', ticketId);
  if (row?.user_id) {
    const msg = TICKET_USER_MESSAGE[status];
    await notifyUser(
      row.user_id as string,
      row.user_role as 'rider' | 'driver',
      msg.title,
      msg.body,
      {
      ticket_id: ticketId,
      status,
      },
    );
  }
  revalidatePath('/[locale]/support', 'page');
}

/** Save a staff-only internal note on a ticket (not sent to the user). */
export async function setTicketNote(
  ticketId: string,
  note: string,
): Promise<void> {
  const session = await requireCapability('support:manage');
  await serviceClient()
    .from('support_tickets')
    .update({ internal_note: note.trim() || null })
    .eq('id', ticketId);
  await audit(session, 'ticket.note', 'support_ticket', ticketId);
  revalidatePath('/[locale]/support', 'page');
}

// ── Reports (moderation) ─────────────────────────────────────
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

const REPORT_REPORTER_MESSAGE: Record<
  ReportStatus,
  { title: string; body: string } | null
> = {
  open: null,
  reviewing: {
    title: "We're reviewing your report",
    body: 'Thanks for your report — our team is reviewing it now.',
  },
  actioned: {
    title: 'Action taken on your report',
    body: "We've reviewed your report and taken appropriate action. Thank you for keeping Bandi safe.",
  },
  dismissed: {
    title: 'Update on your report',
    body: "We've reviewed your report and found no action was needed. Thank you for letting us know.",
  },
};

/** Triage a report (open → reviewing → actioned | dismissed) + notify reporter. */
export async function setReportStatus(
  reportId: string,
  status: ReportStatus,
  resolutionNote?: string,
): Promise<void> {
  const session = await requireCapability('support:manage');
  const svc = serviceClient();
  const { data: row } = await svc
    .from('reports')
    .select('reporter_id, reporter_role')
    .eq('id', reportId)
    .maybeSingle();

  const terminal = status === 'actioned' || status === 'dismissed';
  await svc
    .from('reports')
    .update({
      status,
      resolution_note: resolutionNote?.trim() || null,
      handled_by: terminal ? session.uid : null,
      handled_at: terminal ? new Date().toISOString() : null,
    })
    .eq('id', reportId);

  await audit(session, `report.${status}`, 'report', reportId, resolutionNote);
  const msg = REPORT_REPORTER_MESSAGE[status];
  if (msg && row?.reporter_id) {
    await notifyUser(
      row.reporter_id as string,
      row.reporter_role as 'rider' | 'driver',
      msg.title,
      msg.body,
      {
      report_id: reportId,
      status,
      },
    );
  }
  revalidatePath('/[locale]/reports', 'page');
}

// ── Subscription plans (daily fee config) ────────────────────
/** Create or update the daily subscription fee for a vehicle type + country. */
export async function upsertSubscriptionPlan(values: {
  id?: string;
  country: string | null;
  vehicle_type: 'auto' | 'bike' | 'cab';
  price: number;
  currency: string;
}): Promise<string | null> {
  const session = await requireCapability('subscriptions:manage');
  const svc = serviceClient();
  const country = norm(values.country);
  const patch = {
    country,
    vehicle_type: values.vehicle_type,
    price: values.price,
    currency: values.currency.trim() || 'INR',
    updated_by: session.uid,
    updated_at: new Date().toISOString(),
  };
  const label = `${values.vehicle_type} · ${country ?? 'Global'}`;

  if (values.id) {
    await svc.from('subscription_plans').update(patch).eq('id', values.id);
    await audit(
      session,
      'subscription_plan.update',
      'subscription_plan',
      values.id,
      label,
      {
        ...patch,
      },
    );
  } else {
    const { error } = await svc
      .from('subscription_plans')
      .insert({ ...patch, is_active: true });
    if (error) {
      return error.code === '23505'
        ? 'A plan already exists for this vehicle type and country'
        : error.message;
    }
    await audit(
      session,
      'subscription_plan.create',
      'subscription_plan',
      label,
      label,
      {
        ...patch,
      },
    );
  }
  revalidatePath('/[locale]/money', 'page');
  return null;
}

/** Deactivate a subscription plan. */
export async function removeSubscriptionPlan(id: string): Promise<void> {
  const session = await requireCapability('subscriptions:manage');
  await serviceClient()
    .from('subscription_plans')
    .update({ is_active: false })
    .eq('id', id);
  await audit(session, 'subscription_plan.remove', 'subscription_plan', id);
  revalidatePath('/[locale]/money', 'page');
}

/**
 * Waive a driver's subscription fee until a given date (free subscription).
 * Reuses drivers.founder_free_until as the "free until" date and flags the
 * driver as a founder so the badge/free status shows in their profile.
 */
export async function grantFreeSubscription(
  driverId: string,
  until: string,
): Promise<string | null> {
  const session = await requireCapability('subscriptions:manage');
  if (!until) return 'Pick an end date for the free period';
  const svc = serviceClient();
  await svc
    .from('drivers')
    .update({ is_founder: true, founder_free_until: until })
    .eq('id', driverId);
  await audit(
    session,
    'subscription.grant_free',
    'driver',
    driverId,
    `Free until ${until}`,
    {
      founder_free_until: until,
    },
  );
  revalidatePath('/[locale]/money', 'page');
  revalidatePath('/[locale]/drivers/[id]', 'page');
  return null;
}

/** End a driver's free subscription (they resume paying the daily fee). */
export async function revokeFreeSubscription(driverId: string): Promise<void> {
  const session = await requireCapability('subscriptions:manage');
  await serviceClient()
    .from('drivers')
    .update({ is_founder: false, founder_free_until: null })
    .eq('id', driverId);
  await audit(session, 'subscription.revoke_free', 'driver', driverId);
  revalidatePath('/[locale]/money', 'page');
  revalidatePath('/[locale]/drivers/[id]', 'page');
}

// ── Driver wallet (manual recharge / adjustment) ─────────────
/**
 * Credit or debit a driver's wallet directly — e.g. they paid the subscription
 * in cash, or we're correcting a balance. Records a wallet_transactions row,
 * updates the balance, and writes an audit entry. The wallet transaction trigger
 * owns driver notifications so each adjustment creates only one message.
 */
export async function rechargeWallet(
  driverId: string,
  amount: number,
  type: 'credit' | 'debit',
  reason: string,
): Promise<string | null> {
  const session = await requireCapability('wallet:manage');
  const value = Math.abs(Number(amount));
  if (!value || Number.isNaN(value)) return 'Enter an amount greater than zero';
  if (!reason.trim()) return 'A reason is required';

  const svc = serviceClient();
  const { data, error } = await svc.rpc('admin_adjust_driver_wallet', {
    p_driver: driverId,
    p_amount: value,
    p_type: type,
    p_reason: reason.trim(),
  });
  if (error) {
    if (error.message.includes('insufficient_balance')) {
      return 'Insufficient balance for this debit';
    }
    throw error;
  }
  const result = data as {
    transaction_id?: string;
    amount: number;
    balance: number;
  };
  const delta = result.amount;
  const next = result.balance;

  await audit(
    session,
    type === 'credit' ? 'wallet.credit' : 'wallet.debit',
    'driver',
    driverId,
    reason.trim(),
    { amount: delta, balance: next },
  );
  revalidatePath('/[locale]/drivers/[id]', 'page');
  return null;
}

export async function reviewWithdrawalRequest(
  driverId: string,
  requestId: string,
  action: 'approve' | 'reject' | 'mark_paid',
  notes?: string,
): Promise<string | null> {
  const session = await requireCapability('wallet:manage');
  const svc = serviceClient();
  const { error } = await svc.rpc('admin_review_driver_withdrawal', {
    p_request: requestId,
    p_action: action,
    p_admin_notes: notes?.trim() || null,
  });
  if (error) {
    if (error.message.includes('insufficient_balance')) {
      return 'Driver wallet balance is too low for this payout';
    }
    if (error.message.includes('invalid_status')) {
      return 'This request is no longer in the right status';
    }
    throw error;
  }

  await audit(
    session,
    `closure_settlement.${action}`,
    'driver_withdrawal_request',
    requestId,
    notes?.trim() || undefined,
    { driverId },
  );
  revalidatePath('/[locale]/drivers/[id]', 'page');
  return null;
}

// ── Production operations queue ─────────────────────────────
export interface OperationsCaseInput {
  signalKey: string;
  category: 'ride' | 'billing' | 'subscription' | 'onboarding' | 'account';
  priority: 'critical' | 'high' | 'medium' | 'low';
  entityType: string;
  entityId: string | null;
  title: string;
  summary: string | null;
  firstSeenAt: string;
}

export async function setOperationsCaseStatus(
  input: OperationsCaseInput,
  status: 'open' | 'in_review' | 'resolved' | 'dismissed',
  resolutionNote?: string,
): Promise<string | null> {
  const session = await requireCapability('operations:manage');
  const note = resolutionNote?.trim() ?? '';
  if (!input.signalKey || !input.title || !input.entityType)
    return 'Invalid operation signal';
  if ((status === 'resolved' || status === 'dismissed') && note.length < 5) {
    return 'Add a resolution note with at least 5 characters';
  }

  const terminal = status === 'resolved' || status === 'dismissed';
  const now = new Date().toISOString();
  const svc = serviceClient();
  const { data, error } = await svc
    .from('admin_operations_cases')
    .upsert(
      {
        signal_key: input.signalKey,
        category: input.category,
        priority: input.priority,
        status,
        entity_type: input.entityType,
        entity_id: input.entityId,
        title: input.title,
        summary: input.summary,
        assigned_to: status === 'open' ? null : session.uid,
        resolution_note: terminal ? note : null,
        first_seen_at: input.firstSeenAt,
        last_seen_at: now,
        resolved_at: terminal ? now : null,
        resolved_by: terminal ? session.uid : null,
      },
      { onConflict: 'signal_key' },
    )
    .select('id')
    .single();
  if (error) return error.message;

  // Keep the domain record in sync so the driver does not continue seeing a
  // dispute as open after operations has completed its review.
  if (input.entityType === 'dispute' && input.entityId) {
    const disputeStatus =
      status === 'in_review' ? 'reviewing' : terminal ? 'resolved' : 'open';
    const { error: disputeError } = await svc
      .from('disputes')
      .update({
        status: disputeStatus,
        resolution: terminal ? note : null,
        resolved_at: terminal ? now : null,
        resolved_by: terminal ? session.uid : null,
      })
      .eq('id', input.entityId);
    if (disputeError) return disputeError.message;
  }

  await audit(
    session,
    `operations_case.${status}`,
    input.entityType,
    input.entityId ?? (data.id as string),
    terminal ? note : input.title,
    {
      signal_key: input.signalKey,
      category: input.category,
      priority: input.priority,
    },
  );
  revalidatePath('/[locale]/operations', 'page');
  return null;
}

// ── My account (any signed-in staff) ─────────────────────────
/** Update the signed-in user's own display name. */
export async function updateMyName(fullName: string): Promise<string | null> {
  const session = await getSession();
  if (!session) return 'Unauthorized';
  const name = fullName.trim();
  if (!name) return 'Name is required';
  const svc = serviceClient();
  await svc
    .from('admin_profiles')
    .update({ full_name: name })
    .eq('id', session.uid);
  await updateSession({ name });
  revalidatePath('/[locale]/account', 'page');
  return null;
}

/** Change the signed-in user's own password. */
export async function changeMyPassword(
  password: string,
): Promise<string | null> {
  const session = await getSession();
  if (!session) return 'Unauthorized';
  if (password.length < 8) return 'Password must be at least 8 characters';
  const svc = serviceClient();
  const { error } = await svc.auth.admin.updateUserById(session.uid, {
    password,
  });
  if (error) return error.message;
  await audit(session, 'account.password_change', 'admin_profile', session.uid);
  return null;
}
