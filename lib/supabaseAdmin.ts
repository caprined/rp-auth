import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// UWAGA: service role key ma pełny dostęp do bazy, omija RLS.
// Używany WYŁĄCZNIE po stronie serwera (API routes / route handlers), nigdy w kliencie.
let client: ReturnType<typeof createClient> | null = null;

export function supabaseAdmin() {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });
  }
  return client;
}
