import { centsToDollars } from '../../domain/profit';
import type { Trade } from '../../domain/types';
import { formatDate, formatMoney } from '../format';
import { EmptyState } from './shared';
import { ItemCell } from './ItemCell';

export function OpenPositionsTable({ buys }: { buys: Trade[] }) {
  if (buys.length === 0) return <EmptyState text="Nothing in hand. Every buy has been sold." />;

  const newestFirst = [...buys].sort((a, b) => b.at.localeCompare(a.at));
  const totalCost = centsToDollars(buys.reduce((sum, buy) => sum + buy.priceCents, 0));

  return (
    <>
      <p className="ledger-line ledger-line-small">
        <strong className="figure">{buys.length}</strong> items in hand, <strong className="figure">{formatMoney(totalCost)}</strong> at cost.
      </p>
      <table className="ledger">
        <thead>
          <tr>
            <th>Item</th>
            <th className="side">Bought</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((buy) => (
            <tr key={buy.id}>
              <td><ItemCell trade={buy} /></td>
              <td className="side">
                <span className="price">{formatMoney(centsToDollars(buy.priceCents))}</span>
                <span className="when">{formatDate(buy.at)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
