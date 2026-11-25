import { useEffect } from 'react';

const CONTROLS = 'button:is(.btn, .nav-item, .chip), .seg:not(.row-detail-toggle) button';
const MARKS = ['+', '.', '+', '.', '+', '.', '+', '.'];

export function useSprinkles() {
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active: HTMLSpanElement | undefined;

    const play = (event: MouseEvent) => {
      if (motion.matches || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(CONTROLS);
      if (!button || button.disabled) return;

      active?.remove();
      const burst = document.createElement('span');
      burst.className = 'sprinkles';
      burst.setAttribute('aria-hidden', 'true');
      for (const mark of MARKS) {
        const fleck = document.createElement('span');
        fleck.textContent = mark;
        burst.append(fleck);
      }
      const finish = () => {
        burst.remove();
        if (active === burst) active = undefined;
      };
      burst.addEventListener('animationend', finish, { once: true });
      burst.addEventListener('animationcancel', finish, { once: true });
      active = burst;
      button.append(burst);
    };

    const press = (event: PointerEvent) => {
      if (event.isPrimary && event.button === 0) play(event);
    };
    const keyboard = (event: MouseEvent) => {
      if (event.detail === 0) play(event);
    };

    document.addEventListener('pointerdown', press, true);
    document.addEventListener('click', keyboard, true);
    return () => {
      active?.remove();
      document.removeEventListener('pointerdown', press, true);
      document.removeEventListener('click', keyboard, true);
    };
  }, []);
}
