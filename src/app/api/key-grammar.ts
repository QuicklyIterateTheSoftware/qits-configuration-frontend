/**
 * The entry-key grammar, checked here so a typo is answered before it costs a round trip.
 *
 * **The server is the authority and this is a courtesy — that ordering is the whole design.**
 * qits-configuration's `ConfigurationKeys` is what actually refuses a key, and the reason it refuses
 * at all is worth knowing: a key becomes half of a property name the deployer layers into its own
 * configuration, and the deployer REFUSES a deployment carrying a key it does not recognise. So a
 * bad key is a failed deployment hours later unless something turns it into a sentence now.
 *
 * This file makes that sentence arrive on the keystroke rather than on the request. It never
 * *permits* anything: a key this file accepts still goes to the server, and if the server refuses it
 * the operator reads the SERVER's message, verbatim, not this one. That is what keeps a copy of a
 * grammar from becoming a second opinion about it — the failure mode of a client-side check is that
 * it drifts, and the only harmless drift is one that refuses too little.
 *
 * The grammar, from the service's own source:
 *
 * - `env.<VAR>` — an environment variable, `[A-Za-z_][A-Za-z0-9_]*` after the dot.
 * - `mounts[i]`, `publishes[i]`, `groups[i]`, `aliases[i]` — one to four digits in the brackets.
 *
 * What a value MEANS is nobody's business here and not the service's either: a mount specification,
 * a published port, a group id or a network alias is parsed by qits-platform-deployments'
 * `ServiceExtras`, which stays the single parser of those on the platform.
 */

/** The whole indexed family, in the order the service lists it. */
export const INDEXED_FAMILIES = ['mounts', 'publishes', 'groups', 'aliases'] as const;

/** `env.<VAR>` — the charset a shell will accept as a variable name. */
const ENV_KEY = /^env\.[A-Za-z_][A-Za-z0-9_]*$/;

/** `mounts[0]` and its three siblings. Four digits is a bound, not a limit anybody will reach. */
const INDEXED_KEY = /^(mounts|publishes|groups|aliases)\[[0-9]{1,4}]$/;

/** The service's own limit, refused here so a 400 does not have to say it. */
const KEY_MAX = 256;

/**
 * What is wrong with this key, or `null` when nothing is.
 *
 * The sentences follow the service's, because an operator who sees one form here and another form
 * from the server would reasonably think they hit two different rules.
 */
export function keyProblem(key: string): string | null {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return 'A key is required';
  }
  if (trimmed.length > KEY_MAX) {
    return `The key is longer than ${KEY_MAX} characters`;
  }
  if (ENV_KEY.test(trimmed) || INDEXED_KEY.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith('env.')) {
    return (
      `Not a valid environment variable name in key ${trimmed}. After \`env.\` it must start ` +
      'with a letter or an underscore and hold only letters, digits and underscores.'
    );
  }
  const bracket = trimmed.indexOf('[');
  if (bracket > 0) {
    const family = trimmed.slice(0, bracket);
    if ((INDEXED_FAMILIES as readonly string[]).includes(family)) {
      return (
        `Not a valid index in key ${trimmed}. \`${family}\` takes one to four digits in square ` +
        `brackets, as in ${family}[0].`
      );
    }
  }
  return (
    `Not a valid key: ${trimmed}. A key is \`env.<VAR>\` or one of \`mounts[i]\`, ` +
    '`publishes[i]`, `groups[i]`, `aliases[i]`.'
  );
}

/**
 * Which family a key belongs to, for the class column and for grouping — `env` or one of the four.
 *
 * A key this returns `null` for is one the grammar does not know, which the table draws as it
 * received it rather than guessing.
 */
export function keyFamily(key: string): string | null {
  if (ENV_KEY.test(key)) {
    return 'env';
  }
  const match = INDEXED_KEY.exec(key);
  return match ? match[1] : null;
}
