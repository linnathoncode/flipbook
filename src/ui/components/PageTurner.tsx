import { useEffect, useRef } from 'react';

// An open book seen from slightly above, in a 48 × 34 box with the spine down x = 24.
const SPINE = 24;
const WIDTH = 17;
const TURN_MS = 650;
const f = (n: number) => n.toFixed(2);

/** A leaf lying flat on `side` (1 right, -1 left). Depth 0 is the open page; 1 is the cover underneath. */
function flatLeaf(side: 1 | -1, depth: number): string {
  const sx = SPINE + side * 0.9;
  const ox = SPINE + side * (WIDTH + depth * 3);
  const top = 4 + depth * 3;
  const bottom = 25 + depth * 3;
  const cx = SPINE + side * 8;
  return `M${f(sx)} ${f(6.5 + depth * 3)} Q${f(cx)} ${f(top - 0.5)} ${f(ox)} ${f(top)} L${f(ox)} ${f(bottom)} Q${f(cx)} ${f(bottom + 0.6)} ${f(sx)} ${f(27.5 + depth * 3)}Z`;
}

/** A page part way over, from flat on the right (0) to flat on the left (π). Standing up, it rises above the spine. */
function turningLeaf(angle: number): string {
  const across = Math.cos(angle);
  const up = Math.sin(angle);
  const ox = SPINE + WIDTH * across;
  const top = 4 - 9 * up;
  const bottom = 25 - 13 * up;
  const cx = SPINE + 8 * across;
  const sx = SPINE + (across >= 0 ? 0.9 : -0.9);
  return `M${f(sx)} 6.5 Q${f(cx)} ${f(top - 0.5 + up * 2)} ${f(ox)} ${f(top)} L${f(ox)} ${f(bottom)} Q${f(cx)} ${f(bottom + 0.6 + up * 2)} ${f(sx)} 27.5Z`;
}

const STILL = [1, 0].flatMap((depth) => [flatLeaf(-1, depth), flatLeaf(1, depth)]);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/**
 * The pricing indicator: a small book that turns one page each time `pages` goes up,
 * so the turning keeps pace with prices coming back. Holds still under reduced motion.
 */
export function PageTurner({ pages, width = 22 }: { pages: number; width?: number }) {
  const layer = useRef<SVGGElement>(null);
  const seen = useRef(pages);

  useEffect(() => {
    const turns = pages - seen.current;
    seen.current = pages;
    const group = layer.current;
    if (turns <= 0 || !group || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'leaf');
    group.append(path);
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / TURN_MS);
      path.setAttribute('d', turningLeaf(Math.PI * easeInOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
      else path.remove();
    });
    // A page already in the air finishes on its own; only an unmount cuts it short.
    return () => {
      if (!group.isConnected) cancelAnimationFrame(frame);
    };
  }, [pages]);

  return (
    <svg className="book" viewBox="0 -9 48 43" width={width} height={f((width * 43) / 48)} aria-hidden="true">
      {STILL.map((d) => <path key={d} className="leaf" d={d} />)}
      <g ref={layer} />
    </svg>
  );
}
