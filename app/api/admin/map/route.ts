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
    .select('discord_id, global_name, username, geo_country, geo_city, geo_lat, geo_lng')
    .not('geo_lat', 'is', null)
    .not('geo_lng', 'is', null);

  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({ points: data });
}
