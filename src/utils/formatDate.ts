export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function timeOfDay(hour: number): string {
  if (hour < 5) return 'late night';
  if (hour < 9) return 'early morning';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'late evening';
}

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

// A soft relative stamp for the returning mirror, e.g. "Yesterday, late evening".
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const dayDelta = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);

  let day: string;
  if (dayDelta <= 0) day = 'Today';
  else if (dayDelta === 1) day = 'Yesterday';
  else if (dayDelta < 7) day = then.toLocaleDateString('en-US', { weekday: 'long' });
  else day = then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `${day}, ${timeOfDay(then.getHours())}`;
}
