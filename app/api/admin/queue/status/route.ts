import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '../../../../../lib/session';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  const requestedJobId = req.nextUrl.searchParams.get('jobId');
  const db = supabaseAdmin();

  const jobQuery = requestedJobId
    ? db.from('join_queue_jobs').select('id, status, total_count, target_guild_id, created_at').eq('id', requestedJobId).maybeSingle()
    : db
        .from('join_queue_jobs')
        .select('id, status, total_count, target_guild_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

  const { data: job, error } = await jobQuery;
  if (error) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ job: null });
  }
  const jobId = job.id as string;

  // Liczymy na zywo z rzeczywistych rekordow zamiast trzymac osobny, latwy do rozjechania
  // sie licznik - to jest zrodlo prawdy, nie moze sklamac nawet jesli wczesniej cos padlo.
  const [{ count: doneCount }, { count: failedCount }, { count: pendingCount }, { data: lastFailed }] =
    await Promise.all([
      db
        .from('join_queue_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('status', 'done'),
      db
        .from('join_queue_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('status', 'failed'),
      db
        .from('join_queue_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .in('status', ['pending', 'processing', 'rate_limited']),
      db
        .from('join_queue_items')
        .select('discord_id, last_error, updated_at')
        .eq('job_id', jobId)
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      target_guild_id: job.target_guild_id,
      total_count: job.total_count,
      done_count: doneCount ?? 0,
      failed_count: failedCount ?? 0,
      pending_count: pendingCount ?? 0,
    },
    lastError: lastFailed ?? null,
  });
}
