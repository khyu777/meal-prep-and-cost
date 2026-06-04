// Week boundary utilities — week runs Sunday to Saturday (matching dayOfWeek convention)

export function getWeekStart(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(offset: number): Date {
  const d = getWeekStart(offset);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatWeekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const year = end.getFullYear();
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  if (start.getMonth() === end.getMonth()) {
    return `${startStr}–${end.getDate()}, ${year}`;
  }
  return `${startStr}–${endStr}`;
}

export function planOverlapsWeek(
  planStart: string,
  planEnd: string,
  weekStart: Date,
  weekEnd: Date
): boolean {
  const ps = new Date(planStart);
  const pe = new Date(planEnd);
  return ps <= weekEnd && pe >= weekStart;
}
