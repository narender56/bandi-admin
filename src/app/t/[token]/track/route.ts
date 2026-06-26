import { NextResponse } from 'next/server';

import { anonClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Public polling endpoint for the live-trip tracking page. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { data, error } = await anonClient().rpc('get_shared_ride', {
    p_token: token,
  });
  if (error || !data) {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  return NextResponse.json(
    { found: true, ride: data },
    { headers: { 'cache-control': 'no-store' } },
  );
}
