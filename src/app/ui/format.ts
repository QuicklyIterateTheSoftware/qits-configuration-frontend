/**
 * The small conversions the pages need, kept out of the templates so they can be asserted directly.
 *
 * **Every timestamp is rendered in UTC**, as in every sibling explorer: the service stamps
 * `Instant`s, and a browser-local rendering would make two operators looking at the same
 * configuration change disagree about when it happened.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** What is drawn where there is nothing to draw — one em dash, everywhere. */
export const NONE = '—';

function parse(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** `31 Jul 2026 14:02:11Z` — what a row's timestamp says, year and seconds included. */
export function formatInstant(iso: string | null): string {
  const date = parse(iso);
  if (!date) {
    return NONE;
  }
  return (
    `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`
  );
}

/** `10 entries`, `1 entry` — a count is never drawn without the noun it counts. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/**
 * Who made a write, or the honest answer when the service recorded nobody.
 *
 * A null `updatedBy` is not an anonymous writer — every route on this service is `@RolesAllowed`,
 * so nothing unauthenticated ever wrote a row. It means the identity carried no name worth
 * recording, and saying so beats inventing "system".
 */
export function actor(updatedBy: string | null): string {
  return updatedBy && updatedBy.length > 0 ? updatedBy : NONE;
}
