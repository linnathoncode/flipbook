import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { steamImageUrl } from '../steamImages';

/** What a hovered skin, sticker or charm shows enlarged. */
export interface CardContent {
  iconUrl?: string;
  title: string;
  lines: string[];
  /** Skins get a wide picture; stickers and charms a square one. */
  shape: 'item' | 'square';
  /** Rarity color for the backdrop. */
  color?: string;
}

interface Shown extends CardContent {
  anchor: DOMRect;
}

type Bind = (content: CardContent) => { onMouseEnter: (event: MouseEvent<HTMLElement>) => void; onMouseLeave: () => void };

const HoverCardContext = createContext<Bind>(() => ({ onMouseEnter: () => undefined, onMouseLeave: () => undefined }));

/** Long enough that sweeping the mouse down the table doesn't flash a card on every row. */
const OPEN_DELAY_MS = 140;
const GAP = 10;
const EDGE = 8;

const IMAGE_SIZE = { item: [256, 192], square: [128, 128] } as const;

export const useHoverCard = () => useContext(HoverCardContext);

export function HoverCardProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown>();
  const timer = useRef<number>();

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setShown(undefined);
  }, []);

  const bind = useCallback<Bind>(
    (content) => ({
      onMouseEnter: (event) => {
        const anchor = event.currentTarget.getBoundingClientRect();
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setShown({ ...content, anchor }), OPEN_DELAY_MS);
      },
      onMouseLeave: hide,
    }),
    [hide],
  );

  // The anchor moves when the table scrolls, so drop the card instead of leaving it floating somewhere else.
  useEffect(() => {
    if (!shown) return;
    window.addEventListener('scroll', hide, true);
    window.addEventListener('wheel', hide, { passive: true });
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('wheel', hide);
    };
  }, [shown, hide]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <HoverCardContext.Provider value={bind}>
      {children}
      {shown && createPortal(<Card {...shown} />, document.body)}
    </HoverCardContext.Provider>
  );
}

function Card({ anchor, iconUrl, title, lines, shape, color }: Shown) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ left: anchor.right + GAP, top: anchor.top, visibility: 'hidden' });
  const [width, height] = IMAGE_SIZE[shape];
  const src = steamImageUrl(iconUrl, width, height);

  // Right of the thing hovered if there's room, otherwise left; kept inside the window either way.
  useLayoutEffect(() => {
    const card = ref.current!.getBoundingClientRect();
    const fitsRight = anchor.right + GAP + card.width <= window.innerWidth - EDGE;
    const left = fitsRight ? anchor.right + GAP : Math.max(EDGE, anchor.left - GAP - card.width);
    const top = Math.min(Math.max(EDGE, anchor.top + anchor.height / 2 - card.height / 2), window.innerHeight - EDGE - card.height);
    setPosition({ left, top });
  }, [anchor]);

  return (
    <div ref={ref} className={`hcard ${shape}`} style={{ ...position, '--r': color ?? 'var(--rule)' } as CSSProperties} role="tooltip">
      {src && (
        <div className="hcard-img">
          <img src={src} alt="" referrerPolicy="no-referrer" onLoad={(event) => event.currentTarget.classList.add('in')} onError={(event) => (event.currentTarget.hidden = true)} />
        </div>
      )}
      <div className="hcard-text">
        <b>{title}</b>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
}
