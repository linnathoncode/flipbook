const MINUS = '−';
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const shortDateWithYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const grouped = (dollars: number) =>
  Math.abs(dollars).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Blank for a missing value: an empty cell reads better than a dash. */
export const formatMoney = (dollars?: number) => (dollars === undefined ? '' : `${dollars < 0 ? MINUS : ''}$${grouped(dollars)}`);
export const formatSignedMoney = (dollars: number) => `${dollars < 0 ? MINUS : '+'}$${grouped(dollars)}`;
export const formatPercent = (percent: number) => `${percent < 0 ? MINUS : '+'}${Math.abs(percent).toFixed(1)}%`;
export const formatFloat = (value: number | undefined, digits = 4) => (value === undefined ? '' : value.toFixed(digits));
export const formatDays = (days?: number) => (days === undefined ? '' : `${days}d`);
export const plural = (count: number, noun: string, many = `${noun}s`) => `${count} ${count === 1 ? noun : many}`;

/** "Oct 18", with the year only when it isn't this year. */
export function formatDate(iso?: string, now = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  return (date.getFullYear() === now.getFullYear() ? shortDate : shortDateWithYear).format(date);
}

/** "Oct" for "2026-10". */
export const formatMonth = (month: string) => monthName.format(new Date(`${month}-01T00:00:00Z`));

export function formatTimeAgo(iso: string, now = Date.now()): string {
  const elapsed = Date.parse(iso) - now;
  if (Math.abs(elapsed) < MINUTE_MS) return 'just now';
  if (Math.abs(elapsed) < HOUR_MS) return relative.format(Math.round(elapsed / MINUTE_MS), 'minute');
  if (Math.abs(elapsed) < DAY_MS) return relative.format(Math.round(elapsed / HOUR_MS), 'hour');
  return relative.format(Math.round(elapsed / DAY_MS), 'day');
}
