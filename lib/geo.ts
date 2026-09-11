export interface GeoResult {
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

const EMPTY: GeoResult = { country: null, city: null, lat: null, lng: null };

// ipapi.co - HTTPS, bez klucza, limit ok. 1000 zapytan/dzien - przy skali jednego serwera
// Discorda wystarczy z duzym zapasem. Awaria tego serwisu NIE blokuje weryfikacji, user po
// prostu nie dostanie wtedy punktu na mapie / lokalizacji w panelu.
export async function lookupGeo(ip: string): Promise<GeoResult> {
  if (!ip || ip === '0.0.0.0' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return EMPTY;
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'realizatorzy-vault/1.0' },
    });
    if (!res.ok) return EMPTY;
    const data = await res.json();
    if (data.error) return EMPTY;

    return {
      country: typeof data.country_name === 'string' ? data.country_name : null,
      city: typeof data.city === 'string' ? data.city : null,
      lat: typeof data.latitude === 'number' ? data.latitude : null,
      lng: typeof data.longitude === 'number' ? data.longitude : null,
    };
  } catch {
    return EMPTY;
  }
}
