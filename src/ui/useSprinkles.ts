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

    const play = (anchor: HTMLElement) => {
      if (motion.matches) return;
      clear();
      const burst = document.createElement('span');
      burst.className = 'sprinkles';
      burst.setAttribute('aria-hidden', 'true');
      active = burst;
      anchor.append(burst);
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

    const playButton = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(CONTROLS);
      if (button && !button.disabled) play(button);
    };
    const playField = (field: HTMLInputElement | HTMLSelectElement) => {
      const anchor = field.closest<HTMLElement>('.field-sprinkle');
      if (anchor && !field.disabled && active?.parentElement !== anchor) play(anchor);
    };
    const press = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      if (event.target instanceof HTMLSelectElement) playField(event.target);
      else playButton(event);
    };
    const keyboard = (event: MouseEvent) => {
      if (event.detail === 0) playButton(event);
    };
    const focus = (event: FocusEvent) => {
      const field = event.target;
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) playField(field);
    };

    document.addEventListener('pointerdown', press, true);
    document.addEventListener('click', keyboard, true);
    document.addEventListener('focusin', focus);
    motion.addEventListener('change', clear);
    return () => {
      clear();
      motion.removeEventListener('change', clear);
      document.removeEventListener('pointerdown', press, true);
      document.removeEventListener('click', keyboard, true);
      document.removeEventListener('focusin', focus);
    };
  }, []);
}
