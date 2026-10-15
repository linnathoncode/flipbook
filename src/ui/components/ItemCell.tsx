import type { CSSProperties, SyntheticEvent } from 'react';
import { trackerDisplayName } from '../../domain/itemNames';
import type { Trade } from '../../domain/types';
import { formatFloat } from '../format';
import { rarityColor } from '../rarity';
import { WearBar } from './WearBar';

const STEAM_IMAGE_CDN = 'https://community.cloudflare.steamstatic.com/economy/image/';
const ICON_SIZE = '96fx72f';

/** Steam occasionally drops old icon URLs; an empty slot reads better than a broken-image glyph. */
function hideImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.visibility = 'hidden';
}

/** Compact drops the wear bar and shrinks the art so more rows fit on screen. */
export function ItemCell({ trade, compact = false }: { trade: Trade; compact?: boolean }) {
  const { item } = trade;
  const name = trade.source === 'xlsx' ? item.itemName : trackerDisplayName(item);
  const spine = { '--rarity': rarityColor(item) ?? 'var(--rule)' } as CSSProperties;

  return (
    <div className={`item ${compact ? 'is-compact' : ''}`} style={spine}>
      {item.iconUrl ? (
        <img src={`${STEAM_IMAGE_CDN}${item.iconUrl}/${ICON_SIZE}`} alt="" loading="lazy" onError={hideImage} />
      ) : (
        <span className="item-placeholder" aria-hidden="true" />
      )}
      <div className="item-text">
        <span className="item-name">
          {name}
          {trade.state === 'pending' && <span className="tag tag-pending">Pending</span>}
        </span>
        <span className="item-detail">
          {item.floatValue !== undefined && (compact ? <span className="mono">{formatFloat(item.floatValue)}</span> : <WearBar float={item.floatValue} />)}
          {item.paintSeed !== undefined && <span className="mono">seed {item.paintSeed}</span>}
          {trade.source === 'xlsx' && <span>From your tracker</span>}
        </span>
      </div>
    </div>
  );
}
