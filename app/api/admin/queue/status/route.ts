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
    ? db
        .from('join_queue_jobs')
        .select('id, status, total_count, target_guild_id, created_at, completed_at')
        .eq('id', requestedJobId)
        .maybeSingle()
    : db
        .from('join_queue_jobs')
        .select('id, status, total_count, target_guild_id, created_at, completed_at')
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

  const [{ count: doneCount }, { count: failedCount }, { count: pendingCount }, { data: lastFailed }, { data: allFailed }] =
    await Promise.all([
      db.from('join_queue_items').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'done'),
      db.from('join_queue_items').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'failed'),
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
      db.from('join_queue_items').select('last_error').eq('job_id', jobId).eq('status', 'failed'),
    ]);

  // Rozbicie bledow na kategorie z liczba wystapien kazdej - do podsumowania po zakonczeniu.
  const errorBreakdown: Record<string, number> = {};
  for (const row of allFailed ?? []) {
    const key = (row.last_error as string) || 'nieznany_blad';
    errorBreakdown[key] = (errorBreakdown[key] ?? 0) + 1;
  }

  const createdAt = job.created_at as string;
  const completedAt = job.completed_at as string | null;
  const durationSeconds = completedAt
    ? Math.round((new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 1000)
    : null;

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      target_guild_id: job.target_guild_id,
      total_count: job.total_count,
      done_count: doneCount ?? 0,
      failed_count: failedCount ?? 0,
      pending_count: pendingCount ?? 0,
      created_at: createdAt,
      completed_at: completedAt,
      duration_seconds: durationSeconds,
    },
    lastError: lastFailed ?? null,
    errorBreakdown,
  });
}
