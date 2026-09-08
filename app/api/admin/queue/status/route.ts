import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '../../../../../lib/session';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  const jobId = req.nextUrl.searchParams.get('jobId');
  const db = supabaseAdmin();

  const query = db
    .from('join_queue_jobs')
    .select('id, status, total_count, done_count, failed_count, target_guild_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data, error } = jobId
    ? await db
        .from('join_queue_jobs')
        .select('id, status, total_count, done_count, failed_count, target_guild_id, created_at')
        .eq('id', jobId)
        .maybeSingle()
    : await query.maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  return NextResponse.json({ job: data ?? null });
}
