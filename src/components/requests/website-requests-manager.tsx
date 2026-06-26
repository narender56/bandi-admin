'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Mail, Phone, Car, MessageSquare } from 'lucide-react';

import type { WebsiteLeadRow } from '@/lib/data';
import { setWebsiteLeadStatus, type WebsiteLeadStatus } from '@/lib/actions';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

const STATUS: Record<WebsiteLeadStatus, { label: string; tone: 'default' | 'warning' | 'success' | 'neutral' | 'danger' }> = {
  new: { label: 'New', tone: 'warning' },
  contacted: { label: 'Contacted', tone: 'default' },
  qualified: { label: 'Qualified', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
  spam: { label: 'Spam', tone: 'danger' },
};

export function WebsiteRequestsManager({ leads }: { leads: WebsiteLeadRow[] }) {
  const [tab, setTab] = useState<'all' | 'driver_join' | 'contact'>('all');
  const visible = tab === 'all' ? leads : leads.filter((lead) => lead.lead_type === tab);
  const driverCount = leads.filter((lead) => lead.lead_type === 'driver_join').length;
  const contactCount = leads.filter((lead) => lead.lead_type === 'contact').length;

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
      <TabsList>
        <TabsTrigger value="all">
          <Inbox className="size-4" /> All <Badge>{leads.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="driver_join">
          <Car className="size-4" /> Driver leads <Badge>{driverCount}</Badge>
        </TabsTrigger>
        <TabsTrigger value="contact">
          <MessageSquare className="size-4" /> Contact <Badge>{contactCount}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value={tab}>
        <div className="grid gap-4">
          {visible.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              No website requests yet.
            </Card>
          ) : (
            visible.map((lead) => <LeadCard key={lead.id} lead={lead} />)
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function LeadCard({ lead }: { lead: WebsiteLeadRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status = STATUS[lead.status] ?? STATUS.new;
  const run = (next: WebsiteLeadStatus) =>
    startTransition(async () => {
      await setWebsiteLeadStatus(lead.id, next);
      router.refresh();
    });

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{lead.name}</h3>
            <Badge variant={lead.lead_type === 'driver_join' ? 'default' : 'neutral'}>
              {lead.lead_type === 'driver_join' ? 'Driver join' : 'Contact'}
            </Badge>
            <Badge variant={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(lead.created_at)} · {lead.city ?? 'City not given'} · {lead.source}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {lead.phone && (
              <a className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 font-medium" href={`tel:${lead.phone}`}>
                <Phone className="size-4" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 font-medium" href={`mailto:${lead.email}`}>
                <Mail className="size-4" /> {lead.email}
              </a>
            )}
            {lead.vehicle_type && (
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 font-medium">
                <Car className="size-4" /> {lead.vehicle_type}
              </span>
            )}
          </div>
          {lead.message && (
            <p className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-sm leading-6">
              {lead.message}
            </p>
          )}
        </div>
        <div className="flex min-w-52 flex-col gap-2">
          <Select
            value={lead.status}
            disabled={isPending}
            onValueChange={(value) => run(value as WebsiteLeadStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS).map(([value, meta]) => (
                <SelectItem key={value} value={value}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline">
            <a href={lead.phone ? `tel:${lead.phone}` : `mailto:${lead.email ?? ''}`}>
              Contact
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
