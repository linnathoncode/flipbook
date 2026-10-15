import { nameKey, trackerDisplayName } from '../src/domain/itemNames';
import { skin } from './builders';

describe('nameKey', () => {
  // Pairs taken from the hand-kept tracker and the matching CSFloat market hash names.
  it.each([
    ['Famas | Teardown - FN', 'FAMAS | Teardown (Factory New)'],
    ['P250  | Kintsugi - FT', 'P250 | Kintsugi (Field-Tested)'],
    ['Ursus Knife | Crimson Web - FT ', '★ Ursus Knife | Crimson Web (Field-Tested)'],
    ['Dragomir | Sabre - T Agent ', 'Dragomir | Sabre'],
    ['Michael Syfers | FBI Sniper - CT Agent ', 'Michael Syfers  | FBI Sniper'],
    ['M4A1-S | Nitro - FN + Lil Ava', 'M4A1-S | Nitro (Factory New)'],
    ['R8 | Banana Cannon - FT (0.174)', 'R8 | Banana Cannon (Field-Tested)'],
    ['AK-47 Neon Revolution - FT', 'AK-47 | Neon Revolution (Field-Tested)'],
    ['Train Pin', 'Train Pin'],
  ])('treats "%s" and "%s" as the same item', (trackerName, marketHashName) => {
    expect(nameKey(trackerName)).toBe(nameKey(marketHashName));
  });

  it('keeps different wears apart', () => {
    expect(nameKey('MP9 | Rose Iron - FN')).not.toBe(nameKey('MP9 | Rose Iron - MW'));
  });

  it('does not read wear out of words that merely contain the letters', () => {
    expect(nameKey('Five-Seven | Monkey Business - FT')).toBe(nameKey('Five-SeveN | Monkey Business (Field-Tested)'));
  });
});

describe('trackerDisplayName', () => {
  it('uses the tracker naming style', () => {
    expect(trackerDisplayName(skin())).toBe('AK-47 | Slate - MW');
  });

  it('drops the knife star and leaves wearless items alone', () => {
    expect(trackerDisplayName(skin({ itemName: '★ Ursus Knife | Night Stripe', wearName: 'Field-Tested' }))).toBe(
      'Ursus Knife | Night Stripe - FT',
    );
    expect(trackerDisplayName(skin({ itemName: 'Train Pin', wearName: undefined }))).toBe('Train Pin');
  });
});
