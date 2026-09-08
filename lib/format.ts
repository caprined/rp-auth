export function discordAvatarUrl(discordId: string, avatarHash: string | null): string {
  if (avatarHash) {
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=64`;
  }
  // Domyslny avatar Discorda - indeks liczony z ID (nowy system, bez discriminatora).
  const index = Number((BigInt(discordId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function relativeTimePl(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'przed chwilą';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${odmien(diffMin, 'minutę', 'minuty', 'minut')} temu`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ${odmien(diffH, 'godzinę', 'godziny', 'godzin')} temu`;

  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} ${odmien(diffD, 'dzień', 'dni', 'dni')} temu`;

  const diffMonth = Math.floor(diffD / 30);
  if (diffMonth < 12) return `${diffMonth} ${odmien(diffMonth, 'miesiąc', 'miesiące', 'miesięcy')} temu`;

  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} ${odmien(diffYear, 'rok', 'lata', 'lat')} temu`;
}

function odmien(n: number, jeden: string, kilka: string, wiele: string): string {
  if (n === 1) return jeden;
  const ostatnia = n % 10;
  const dziesiatki = n % 100;
  if (ostatnia >= 2 && ostatnia <= 4 && (dziesiatki < 10 || dziesiatki >= 20)) return kilka;
  return wiele;
}
