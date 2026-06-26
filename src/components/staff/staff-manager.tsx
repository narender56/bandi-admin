'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Ban, CheckCircle2, ShieldCheck } from 'lucide-react';

import type { StaffRow } from '@/lib/data';
import { createStaff, setStaffRole, setStaffBlocked } from '@/lib/actions';
import { formatDateTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type AssignableRole = 'admin' | 'support';

const ROLE_TONE: Record<string, 'default' | 'warning' | 'neutral'> = {
  super_admin: 'warning',
  admin: 'default',
  support: 'neutral',
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  support: 'Support',
};

export function StaffManager({
  staff,
  currentUserId,
}: {
  staff: StaffRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateStaffDialog onCreated={() => router.refresh()} />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  No staff accounts yet.
                </TableCell>
              </TableRow>
            ) : (
              staff.map((s) => {
                const isSuper = s.role === 'super_admin';
                const isSelf = s.id === currentUserId;
                const locked = isSuper || isSelf;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {isSuper && <ShieldCheck className="size-3.5 text-warning" />}
                        {s.full_name ?? 'Unnamed'}
                        {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.phone ?? '—'}</TableCell>
                    <TableCell>
                      {locked ? (
                        <Badge variant={ROLE_TONE[s.role] ?? 'neutral'}>
                          {ROLE_LABEL[s.role] ?? s.role}
                        </Badge>
                      ) : (
                        <Select
                          value={s.role}
                          onValueChange={(v) =>
                            run(() => setStaffRole(s.id, v as AssignableRole))
                          }
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.is_blocked ? (
                        <Badge variant="danger">Blocked</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(s.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {locked ? (
                        <span className="text-muted-foreground">—</span>
                      ) : s.is_blocked ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" size="sm" disabled={isPending}>
                              <CheckCircle2 className="size-4" /> Activate
                            </Button>
                          }
                          title={`Activate ${s.full_name ?? 'this staff member'}?`}
                          description="They will regain access to the admin console. This is recorded in the audit log."
                          confirmLabel="Activate"
                          confirmVariant="default"
                          pending={isPending}
                          onConfirm={() => run(() => setStaffBlocked(s.id, false))}
                        />
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <Button variant="danger" size="sm" disabled={isPending}>
                              <Ban className="size-4" /> Deactivate
                            </Button>
                          }
                          title={`Deactivate ${s.full_name ?? 'this staff member'}?`}
                          description="They will be signed out and blocked from the admin console until reactivated. This is recorded in the audit log."
                          confirmLabel="Deactivate"
                          pending={isPending}
                          onConfirm={() => run(() => setStaffBlocked(s.id, true))}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CreateStaffDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AssignableRole>('support');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('support');
    setError(null);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const err = await createStaff(email.trim(), password, fullName.trim(), role);
      if (err) {
        setError(err);
        return;
      }
      reset();
      setOpen(false);
      onCreated();
    });
  };

  const valid = fullName.trim() && email.trim() && password.length >= 8;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" /> Add staff
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
          <DialogDescription>
            Create a console account. They sign in with email and password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">Full name</Label>
            <Input
              id="staff-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@bandi.app"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password">Password</Label>
            <Input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!valid || isPending}>
            {isPending ? 'Creating…' : 'Create account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
