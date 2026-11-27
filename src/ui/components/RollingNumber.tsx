import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

interface Reading {
  value: number;
  text: string;
}

interface Roll {
  id: number;
  from: Reading;
  to: Reading;
  initial: boolean;
}

const isDigit = (character: string) => /^[0-9]$/.test(character);

export function RollingNumber({ value, text, zero }: Reading & { zero: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const previous = useRef<Reading>();
  const nextId = useRef(0);
  const [roll, setRoll] = useState<Roll>();

  useLayoutEffect(() => {
    const prior = previous.current;
    const current = { value, text };
    previous.current = current;
    const from = prior ?? { value: 0, text: zero };
    if (from.text === text) return;

    const node = element.current;
    if (!node || matchMedia('(prefers-reduced-motion: reduce)').matches
      || from.text.replace(/\D/g, '') === text.replace(/\D/g, '')) {
      setRoll(undefined);
      return;
    }
    const rect = node.getBoundingClientRect();
    const scrollport = node.closest('.tablewrap')?.getBoundingClientRect();
    if (rect.bottom <= (scrollport?.top ?? 0) || rect.top >= (scrollport?.bottom ?? innerHeight)
      || rect.right <= (scrollport?.left ?? 0) || rect.left >= (scrollport?.right ?? innerWidth)) {
      setRoll(undefined);
      return;
    }
    setRoll({ id: ++nextId.current, from, to: current, initial: !prior });
  }, [value, text, zero]);

  return (
    <span className="rolling-number" ref={element}>
      <span className={roll ? 'rolling-value rolling-value-covered' : 'rolling-value'}>{text}</span>
      {roll && (
        <span className="rolling-reels" key={roll.id} data-initial={roll.initial || undefined}
          aria-hidden="true" onAnimationEnd={() => setRoll(undefined)}>
          {renderReels(roll)}
        </span>
      )}
    </span>
  );
}

function renderReels({ from, to }: Roll) {
  const previousDigits = [...from.text].filter(isDigit);
  const digits = [...to.text].filter(isDigit);
  const direction = to.value < from.value ? -1 : 1;
  let digitIndex = previousDigits.length - digits.length;
  return [...to.text].map((character, index) => {
    if (!isDigit(character)) return character;
    const start = Number(previousDigits[digitIndex++] ?? 0);
    const finish = Number(character);
    if (start === finish) return character;

    const steps = 10 + ((direction * (finish - start) + 10) % 10);
    const sequence = Array.from({ length: steps + 1 }, (_, offset) => (start + direction * offset + 20) % 10);
    if (direction < 0) sequence.reverse();
    const distance = `-${steps}lh`;
    const style = {
      '--reel-start': direction > 0 ? '0' : distance,
      '--reel-end': direction > 0 ? distance : '0',
    } as CSSProperties;
    return (
      <span className="rolling-digit" key={index}>
        <span className="rolling-strip" style={style}>
          {sequence.map((digit, offset) => <span key={offset}>{digit}</span>)}
        </span>
      </span>
    );
  });
}
