import { trackerDisplayName } from '../../domain/itemNames';
import type { Trade } from '../../domain/types';
import { formatFloat } from '../format';

const STEAM_IMAGE_CDN = 'https://community.cloudflare.steamstatic.com/economy/image/';
const ICON_SIZE = '64fx48f';

export function ItemCell({ trade }: { trade: Trade }) {
  const { item } = trade;
  const name = trade.source === 'xlsx' ? item.itemName : trackerDisplayName(item);
  return (
    <div className="item">
      {item.iconUrl ? (
        <img src={`${STEAM_IMAGE_CDN}${item.iconUrl}/${ICON_SIZE}`} alt="" loading="lazy" />
      ) : (
        <span className="item-placeholder" />
      )}
      <div>
        <div>{name}</div>
        <div className="muted small">
          {formatFloat(item.floatValue)}
          {item.paintSeed !== undefined && ` · seed ${item.paintSeed}`}
          {trade.source === 'xlsx' && 'from tracker'}
          {trade.state === 'pending' && <span className="badge pending">pending</span>}
        </div>
      </div>
    </div>
  );
}
