import { supabaseAdmin } from './supabaseAdmin';

// Zwraca true jeśli zapytanie jest DOZWOLONE (nie przekroczono limitu).
export async function checkRateLimit(
  bucketKey: string,
  maxHits: number,
  windowSeconds: number
): Promise<boolean> {
  const db = supabaseAdmin();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error: countError } = await db
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('bucket_key', bucketKey)
    .gte('created_at', windowStart);

  if (countError) {
    // Fail-closed byłoby zbyt agresywne przy błędzie infra - przepuszczamy, ale logujemy.
    console.error('Rate limit check błąd:', countError.message);
    return true;
  }

  if ((count ?? 0) >= maxHits) return false;

  await db.from('rate_limit_hits').insert({ bucket_key: bucketKey });
  return true;
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? '0.0.0.0';
}
