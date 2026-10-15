const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' });
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatMoney = (dollars: number) => currency.format(dollars);
export const formatSignedMoney = (dollars: number) => signedCurrency.format(dollars);
export const formatPercent = (percent: number) => `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
export const formatDate = (iso: string) => date.format(new Date(iso));
export const formatFloat = (value?: number) => (value === undefined ? '' : value.toFixed(6));
