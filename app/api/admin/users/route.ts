import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '../../../../lib/session';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const SORTABLE_COLUMNS = new Set(['verified_at', 'username', 'discord_id']);

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  const rawSearch = req.nextUrl.searchParams.get('search')?.trim() ?? '';
  const search = rawSearch.replace(/[^a-zA-Z0-9_ .]/g, '').slice(0, 64);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sortByParam = req.nextUrl.searchParams.get('sortBy') ?? 'verified_at';
  const sortBy = SORTABLE_COLUMNS.has(sortByParam) ? sortByParam : 'verified_at';
  const sortDir = req.nextUrl.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

  const country = req.nextUrl.searchParams.get('country')?.trim().slice(0, 100) ?? '';
  const dateFrom = req.nextUrl.searchParams.get('dateFrom') ?? '';

  let query = supabaseAdmin()
    .from('verified_users')
    .select(
      'discord_id, username, global_name, avatar_hash, verified_at, ip_address, geo_country, geo_city',
      { count: 'exact' }
    )
    .order(sortBy, { ascending: sortDir === 'asc' })
    .range(from, to);

  if (search) {
    query = query.or(`discord_id.ilike.%${search}%,username.ilike.%${search}%`);
  }
  if (country) {
    query = query.eq('geo_country', country);
  }
  if (dateFrom) {
    query = query.gte('verified_at', dateFrom);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({ users: data, total: count ?? 0, page, pageSize });
}
