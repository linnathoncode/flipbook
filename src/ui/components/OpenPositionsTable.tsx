import { centsToDollars } from '../../domain/profit';
import type { Trade } from '../../domain/types';
import { formatDate, formatMoney } from '../format';
import { EmptyState } from './shared';
import { ItemCell } from './ItemCell';

export function OpenPositionsTable({ buys }: { buys: Trade[] }) {
  if (buys.length === 0) return <EmptyState text="Nothing held. Every buy has been matched to a sell." />;

  const newestFirst = [...buys].sort((a, b) => b.at.localeCompare(a.at));
  const totalCost = centsToDollars(buys.reduce((sum, buy) => sum + buy.priceCents, 0));

  return (
    <>
      <p className="muted">
        {buys.length} items held · {formatMoney(totalCost)} at cost
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Bought</th>
            <th className="num">Cost</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((buy) => (
            <tr key={buy.id}>
              <td><ItemCell trade={buy} /></td>
              <td>{formatDate(buy.at)}</td>
              <td className="num">{formatMoney(centsToDollars(buy.priceCents))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
