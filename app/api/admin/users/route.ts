import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/session';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  // Sanitizacja: PostgREST filter DSL traktuje przecinki/nawiasy specjalnie - tniemy je,
  // żeby user nie mógł wstrzyknąć dodatkowych warunków filtra przez pole wyszukiwania.
  const rawSearch = req.nextUrl.searchParams.get('search')?.trim() ?? '';
  const search = rawSearch.replace(/[^a-zA-Z0-9_ .]/g, '').slice(0, 64);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin()
    .from('verified_users')
    .select(
      'discord_id, username, global_name, avatar_hash, verified_at, ip_address, geo_country, geo_city',
      { count: 'exact' }
    )
    .order('verified_at', { ascending: false })
    .range(from, to);

  if (search) {
    // Szukamy po ID lub username - proste, bez zewnętrznych zależności.
    query = query.or(`discord_id.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({ users: data, total: count ?? 0, page, pageSize });
}
