'use client';

import Link from 'next/link';
import { LogOut, UserCog, ChevronDown } from 'lucide-react';

import { logoutAction } from '@/lib/actions';
import type { AdminSession } from '@/lib/auth';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { GlobalSearch } from '@/components/global-search';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Support',
};

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'B'
  );
}

export function Topbar({
  session,
  locale,
  dict,
}: {
  session: AdminSession;
  locale: string;
  dict: Dictionary;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur md:px-6">
      <div className="flex flex-1 items-center">
        <GlobalSearch locale={locale} dict={dict} />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-9">
            <AvatarFallback>{initials(session.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight sm:block">
            <div className="text-sm font-semibold">{session.name}</div>
            <div className="text-[11px] text-muted-foreground">{ROLE_LABEL[session.role]}</div>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="truncate">{session.email}</span>
            <Badge variant="default">{ROLE_LABEL[session.role]}</Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/${locale}/account`}>
              <UserCog className="size-4" />
              {dict.account.title}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="text-danger focus:text-danger">
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="size-4" />
                {dict.nav.logout}
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
