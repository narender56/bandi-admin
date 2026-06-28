'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  savePenaltyConfig,
  type PenaltyConfigRow,
} from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FieldType = 'bool' | 'num' | 'text';
type Field = { key: string; label: string; type: FieldType; hint?: string };

const SECTIONS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: 'Master switch',
    note: 'Turn every penalty off instantly. When off, rides cancel for free, exactly like today.',
    fields: [{ key: 'penalty_enabled', label: 'Penalties enabled', type: 'bool' }],
  },
  {
    title: 'Rider ends ride mid-trip',
    fields: [
      { key: 'rider_early_end_enabled', label: 'Allow rider to end mid-ride', type: 'bool' },
      { key: 'early_end_closing_fee_pct', label: 'Closing fee (% of remaining estimate)', type: 'num' },
    ],
  },
  {
    title: 'Driver ends ride mid-trip',
    fields: [
      { key: 'driver_midride_end_enabled', label: 'Allow driver to end mid-ride (with reason)', type: 'bool' },
    ],
  },
  {
    title: 'No-show',
    fields: [
      { key: 'noshow_enabled', label: 'Enable no-show reporting', type: 'bool' },
      { key: 'noshow_grace_min', label: 'Grace wait at pickup (minutes)', type: 'num' },
      { key: 'noshow_arrival_radius_m', label: 'Arrival radius to allow report (m)', type: 'num' },
      { key: 'noshow_fine_amount', label: 'No-show fee on review (₹)', type: 'num' },
      { key: 'noshow_company_upi_id', label: 'Company UPI ID (shown to blocked rider)', type: 'text' },
      { key: 'noshow_company_upi_qr', label: 'Company UPI QR image URL', type: 'text' },
      { key: 'noshow_unlock_sla_hours', label: 'Unlock SLA after payment (hours)', type: 'num' },
    ],
  },
];

function initialValues(config: PenaltyConfigRow[]): Record<string, string> {
  const byKey = new Map(config.map((r) => [r.key, r]));
  const out: Record<string, string> = {};
  for (const section of SECTIONS) {
    for (const f of section.fields) {
      const row = byKey.get(f.key);
      if (f.type === 'bool') out[f.key] = row?.value === 1 ? '1' : '0';
      else if (f.type === 'text') out[f.key] = row?.value_text ?? '';
      else out[f.key] = row?.value != null ? String(row.value) : '';
    }
  }
  return out;
}

export function PenaltySettings({ config }: { config: PenaltyConfigRow[] }) {
  const router = useRouter();
  const initial = useMemo(() => initialValues(config), [config]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(
    () => Object.keys(values).some((k) => values[k] !== initial[k]),
    [values, initial],
  );

  const set = (key: string, value: string) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await savePenaltyConfig(values);
      if (result) {
        setError(result);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => (
        <div
          key={section.title}
          className="rounded-xl border border-border bg-card p-5"
        >
          <h2 className="text-base font-semibold">{section.title}</h2>
          {section.note && (
            <p className="mt-1 text-xs text-muted-foreground">{section.note}</p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {section.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-sm">
                  {f.label}
                </Label>
                {f.type === 'bool' ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      id={f.key}
                      type="checkbox"
                      className="size-4"
                      checked={values[f.key] === '1'}
                      onChange={(e) => set(f.key, e.target.checked ? '1' : '0')}
                    />
                    {values[f.key] === '1' ? 'Enabled' : 'Disabled'}
                  </label>
                ) : (
                  <Input
                    id={f.key}
                    type={f.type === 'num' ? 'number' : 'text'}
                    inputMode={f.type === 'num' ? 'decimal' : undefined}
                    value={values[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !dirty && (
        <p className="text-sm text-success">Settings saved.</p>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending || !dirty}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        {dirty && !isPending && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
