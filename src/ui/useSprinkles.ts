import { useEffect } from 'react';

const CONTROLS = 'button:is(.btn, .nav-item, .chip), .seg button';
const BURST_DURATION = 530;
const FRAME_COUNT = 13;
const DIRECTIONS = [
  [0.16, -1], [0.62, -1], [1, -0.5], [1, 0.65],
  [-0.16, 1], [-0.62, 1], [-1, 0.5], [-1, -0.65],
];

const FLECKS = DIRECTIONS.map(([x, y], index) => ({
  glyph: index % 2 === 0 ? '+' : '.',
  left: `${50 * (1 + x)}%`,
  top: `${50 * (1 + y)}%`,
  frames: Array.from({ length: FRAME_COUNT + 1 }, (_, frame) => {
    const time = frame / FRAME_COUNT;
    const travel = 2 + 9 * (1 - (1 - time) ** 3);
    return {
      opacity: Math.min(time * 16, 1) * (1 - time) * (225 / 255),
      transform: `translate(${x * travel}px, ${y * travel}px)`,
      easing: 'step-end',
    };
  }),
}));

export function useSprinkles() {
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active: HTMLSpanElement | undefined;
    let animations: Animation[] = [];
    const clear = () => {
      animations.forEach((animation) => animation.cancel());
      animations = [];
      active?.remove();
      active = undefined;
    };

    const play = (event: MouseEvent) => {
      if (motion.matches || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(CONTROLS);
      if (!button || button.disabled) return;

      clear();
      const burst = document.createElement('span');
      burst.className = 'sprinkles';
      burst.setAttribute('aria-hidden', 'true');
      active = burst;
      button.append(burst);
      animations = FLECKS.map(({ glyph, left, top, frames }) => {
        const fleck = document.createElement('span');
        fleck.textContent = glyph;
        fleck.style.left = left;
        fleck.style.top = top;
        burst.append(fleck);
        return fleck.animate(frames, { duration: BURST_DURATION, fill: 'both' });
      });
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (active === burst) clear();
      });
    };

    const press = (event: PointerEvent) => {
      if (event.isPrimary && event.button === 0) play(event);
    };
    const keyboard = (event: MouseEvent) => {
      if (event.detail === 0) play(event);
    };

    document.addEventListener('pointerdown', press, true);
    document.addEventListener('click', keyboard, true);
    motion.addEventListener('change', clear);
    return () => {
      clear();
      motion.removeEventListener('change', clear);
      document.removeEventListener('pointerdown', press, true);
      document.removeEventListener('click', keyboard, true);
    };
  }, []);
}
