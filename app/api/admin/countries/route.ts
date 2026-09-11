import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/session';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  const { data, error } = await supabaseAdmin()
    .from('verified_users')
    .select('geo_country')
    .not('geo_country', 'is', null);

  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const countries = Array.from(new Set((data ?? []).map((r) => r.geo_country as string))).sort();
  return NextResponse.json({ countries });
}
