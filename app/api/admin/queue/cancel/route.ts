import { NextResponse } from 'next/server';
import { getAdminSession } from '../../../../../lib/session';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return new NextResponse('403 Forbidden', { status: 403 });
  }

  const db = supabaseAdmin();
  const { data: running } = await db
    .from('join_queue_jobs')
    .select('id')
    .eq('status', 'running')
    .maybeSingle();

  if (!running) {
    return NextResponse.json({ error: 'no_running_job' }, { status: 404 });
  }

  await db
    .from('join_queue_jobs')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', running.id as string);
  return NextResponse.json({ ok: true });
}
