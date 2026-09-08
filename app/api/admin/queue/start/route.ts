import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '../../../../../lib/session';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

const GUILD_ID_RE = /^[0-9]{15,25}$/;

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  let body: { targetGuildId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!body.targetGuildId || !GUILD_ID_RE.test(body.targetGuildId)) {
    return NextResponse.json({ error: 'invalid_guild_id' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // Nie odpalamy drugiej kolejki, jeśli poprzednia jeszcze się przetwarza.
  const { data: running } = await db
    .from('join_queue_jobs')
    .select('id')
    .eq('status', 'running')
    .limit(1)
    .maybeSingle();
  if (running) {
    return NextResponse.json({ error: 'job_already_running', jobId: running.id }, { status: 409 });
  }

  const { data: users, error: usersError } = await db.from('verified_users').select('discord_id');
  if (usersError) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const { data: job, error: jobError } = await db
    .from('join_queue_jobs')
    .insert({
      target_guild_id: body.targetGuildId,
      triggered_by_discord_id: session.discordId,
      total_count: users?.length ?? 0,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'job_create_failed' }, { status: 500 });
  }

  if (users && users.length > 0) {
    const items = users.map((u) => ({ job_id: job.id, discord_id: u.discord_id as string }));
    const { error: itemsError } = await db.from('join_queue_items').insert(items);
    if (itemsError) {
      return NextResponse.json({ error: 'items_create_failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, jobId: job.id, totalCount: users?.length ?? 0 });
}
