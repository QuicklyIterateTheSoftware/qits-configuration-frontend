import { keyFamily, keyProblem } from './key-grammar';

/**
 * The grammar, case by case, against qits-configuration's own `ConfigurationKeys`.
 *
 * This file is the guard on the one claim this copy makes: **it never permits what the service
 * refuses.** A key it accepts still travels to the service, so the expensive drift is the other
 * direction — a key the service would take and this file rejects can never be written at all, and
 * the operator has no way to argue with it.
 */
describe('keyProblem', () => {
  it('takes an environment variable in the charset a shell accepts', () => {
    expect(keyProblem('env.QITS_REGISTRY')).toBeNull();
    expect(keyProblem('env._UNDERSCORE_FIRST')).toBeNull();
    expect(keyProblem('env.a')).toBeNull();
  });

  it('takes each of the four indexed families, one to four digits', () => {
    expect(keyProblem('mounts[0]')).toBeNull();
    expect(keyProblem('publishes[12]')).toBeNull();
    expect(keyProblem('groups[999]')).toBeNull();
    expect(keyProblem('aliases[1234]')).toBeNull();
  });

  it('refuses an environment name that could not be a shell variable, and says which part', () => {
    expect(keyProblem('env.9LIVES')).toContain('environment variable name');
    expect(keyProblem('env.WITH-DASH')).toContain('environment variable name');
    expect(keyProblem('env.')).toContain('environment variable name');
  });

  it('refuses an index that is really a payload, naming the family it belongs to', () => {
    expect(keyProblem('mounts[]')).toContain('`mounts` takes one to four digits');
    expect(keyProblem('aliases[12345]')).toContain('`aliases` takes one to four digits');
    expect(keyProblem('publishes[a]')).toContain('`publishes` takes one to four digits');
  });

  it('refuses anything outside the grammar by listing what the grammar is', () => {
    expect(keyProblem('QITS_REGISTRY')).toContain('A key is `env.<VAR>`');
    expect(keyProblem('volumes[0]')).toContain('A key is `env.<VAR>`');
    expect(keyProblem('env')).toContain('A key is `env.<VAR>`');
  });

  it('refuses an empty key and one past the service length limit', () => {
    expect(keyProblem('')).toBe('A key is required');
    expect(keyProblem('   ')).toBe('A key is required');
    expect(keyProblem('env.' + 'A'.repeat(300))).toContain('longer than 256');
  });

  it('reads a padded key the way the service does, by trimming it first', () => {
    expect(keyProblem('  env.QITS_REGISTRY  ')).toBeNull();
  });
});

describe('keyFamily', () => {
  it('names the family a key belongs to', () => {
    expect(keyFamily('env.QITS_REGISTRY')).toBe('env');
    expect(keyFamily('mounts[3]')).toBe('mounts');
    expect(keyFamily('aliases[0]')).toBe('aliases');
  });

  it('answers null for a key the grammar does not know, rather than guessing one', () => {
    expect(keyFamily('volumes[0]')).toBeNull();
    expect(keyFamily('QITS_REGISTRY')).toBeNull();
  });
});
