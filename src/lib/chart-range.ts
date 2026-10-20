export function last30Days(today: string) {
  const end = Date.parse(`${today}T00:00:00Z`);
  const days = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(end - (29 - index) * 86_400_000).toISOString().slice(0, 10),
    amount: 0,
    count: 0,
  }));
  return { days, start: days[0].date, endExclusive: new Date(end + 86_400_000).toISOString().slice(0, 10) };
}
