const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' });
const shortDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const formatMoney = (dollars: number) => currency.format(dollars);
export const formatSignedMoney = (dollars: number) => signedCurrency.format(dollars);
export const formatPercent = (percent: number) => `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
/** 2026-10-15: sortable and compact, for the sheet view. */
export const formatIsoDate = (iso: string) => shortDate.format(new Date(iso));
export const formatFloat = (value?: number) => (value === undefined ? '' : value.toFixed(6));
export const formatDays = (days?: number) => (days === undefined ? '—' : `${days}d`);

export function formatTimeAgo(iso: string, now = Date.now()): string {
  const elapsed = Date.parse(iso) - now;
  if (Math.abs(elapsed) < MINUTE_MS) return 'just now';
  if (Math.abs(elapsed) < HOUR_MS) return relative.format(Math.round(elapsed / MINUTE_MS), 'minute');
  if (Math.abs(elapsed) < DAY_MS) return relative.format(Math.round(elapsed / HOUR_MS), 'hour');
  return relative.format(Math.round(elapsed / DAY_MS), 'day');
}
