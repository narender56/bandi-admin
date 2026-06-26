'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Check } from 'lucide-react';

import { updateMyName, changeMyPassword } from '@/lib/actions';
import type { AdminSession } from '@/lib/auth';
import type { StaffRegion } from '@/lib/data';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Support',
};

function regionLabel(r: StaffRegion): string {
  return [r.city, r.state, r.country].filter(Boolean).join(', ');
}

export function AccountForm({
  session,
  regions,
  dict,
}: {
  session: AdminSession;
  regions: StaffRegion[];
  dict: Dictionary;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ProfileCard session={session} regions={regions} dict={dict} />
      <PasswordCard dict={dict} />
    </div>
  );
}

function ProfileCard({
  session,
  regions,
  dict,
}: {
  session: AdminSession;
  regions: StaffRegion[];
  dict: Dictionary;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formik = useFormik({
    initialValues: { fullName: session.name },
    validationSchema: Yup.object({
      fullName: Yup.string().trim().required('Name is required'),
    }),
    onSubmit: (values) => {
      setError(null);
      setSaved(false);
      startTransition(async () => {
        const err = await updateMyName(values.fullName.trim());
        if (err) {
          setError(err);
          return;
        }
        setSaved(true);
        router.refresh();
      });
    },
  });

  return (
    <Card className="space-y-5 p-6">
      <h2 className="text-lg font-semibold">{dict.account.profile}</h2>

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="acct-name">{dict.account.name}</Label>
          <Input
            id="acct-name"
            name="fullName"
            value={formik.values.fullName}
            onChange={(e) => {
              setSaved(false);
              formik.handleChange(e);
            }}
            onBlur={formik.handleBlur}
          />
          {formik.touched.fullName && formik.errors.fullName && (
            <p className="text-sm text-danger">{formik.errors.fullName}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{dict.account.email}</Label>
          <Input value={session.email} disabled readOnly />
        </div>

        <div className="space-y-1.5">
          <Label>{dict.account.role}</Label>
          <div>
            <Badge variant="default">{ROLE_LABEL[session.role] ?? session.role}</Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{dict.account.regions}</Label>
          {session.role === 'super_admin' ? (
            <p className="text-sm text-muted-foreground">All regions (unrestricted)</p>
          ) : regions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.account.noRegions}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {regions.map((r) => (
                <Badge key={r.id} variant="neutral">
                  {regionLabel(r)}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending || !formik.dirty}>
            {isPending ? 'Saving…' : dict.account.save}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="size-4" /> {dict.account.saved}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

function PasswordCard({ dict }: { dict: Dictionary }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formik = useFormik({
    initialValues: { password: '' },
    validationSchema: Yup.object({
      password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .required('Password is required'),
    }),
    onSubmit: (values, { resetForm }) => {
      setError(null);
      setDone(false);
      startTransition(async () => {
        const err = await changeMyPassword(values.password);
        if (err) {
          setError(err);
          return;
        }
        setDone(true);
        resetForm();
      });
    },
  });

  return (
    <Card className="space-y-5 p-6">
      <h2 className="text-lg font-semibold">{dict.account.changePassword}</h2>

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="acct-password">{dict.account.newPassword}</Label>
          <Input
            id="acct-password"
            name="password"
            type="password"
            value={formik.values.password}
            onChange={(e) => {
              setDone(false);
              formik.handleChange(e);
            }}
            onBlur={formik.handleBlur}
            placeholder="At least 8 characters"
          />
          {formik.touched.password && formik.errors.password && (
            <p className="text-sm text-danger">{formik.errors.password}</p>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Updating…' : dict.account.changePassword}
          </Button>
          {done && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="size-4" /> {dict.account.passwordChanged}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
