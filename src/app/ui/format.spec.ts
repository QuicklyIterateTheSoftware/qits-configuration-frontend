import { NONE, actor, formatInstant, plural } from './format';

/**
 * The conversions, asserted directly rather than through a template.
 *
 * `formatInstant` is checked against an offset input as well as a Z one: the service stamps UTC, but
 * a rendering that quietly used the browser's timezone would look right on this machine and put two
 * operators an hour apart.
 */
describe('formatInstant', () => {
  it('renders UTC, whatever the input’s offset is', () => {
    expect(formatInstant('2026-08-17T09:12:03Z')).toBe('17 Aug 2026 09:12:03Z');
    expect(formatInstant('2026-08-17T11:12:03+02:00')).toBe('17 Aug 2026 09:12:03Z');
  });

  it('draws the em dash for a missing or unparseable instant', () => {
    expect(formatInstant(null)).toBe(NONE);
    expect(formatInstant('not a date')).toBe(NONE);
  });
});

describe('plural', () => {
  it('never draws a count without the noun it counts', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry');
    expect(plural(0, 'entry', 'entries')).toBe('0 entries');
    expect(plural(2, 'application')).toBe('2 applications');
  });
});

describe('actor', () => {
  it('names the writer when the service recorded one', () => {
    expect(actor('wohlben')).toBe('wohlben');
  });

  it('says nothing rather than inventing “system” when it did not', () => {
    expect(actor(null)).toBe(NONE);
    expect(actor('')).toBe(NONE);
  });
});
