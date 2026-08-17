import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideQitsNavigationLinks } from '@qits/ui-components';
import type { ConfigurationEntry } from '../api/dto';
import { routes } from '../app.routes';

const ENTRIES = '/configuration/api/applications/qits-docs/entries';

/** A value longer than any table cell wants to be — the ordinary case on this screen. */
const LONG_VALUE =
  '/srv/platform/docs/a-very-long-host-path-that-nobody-would-choose-by-hand:' +
  '/work/docs/an-equally-long-container-path:ro';

/**
 * The editor, state by state.
 *
 * Four claims are worth a test here and each of them is a way this page could be quietly wrong:
 *
 * - **a value is never truncated.** The whole point of the screen is reading what a deployment will
 *   carry, and a cell that clipped at some width would say something false about it while looking
 *   entirely normal.
 * - **a write re-reads the store rather than patching the table.** The service decides what a write
 *   stored, so a table patched from the request would show what was typed.
 * - **deleting asks first, and the first press costs no request.** The confirmation is in the row
 *   rather than in `window.confirm` precisely so this test can exist — jsdom implements no such
 *   dialog, and a confirmation that cannot be proven is a confirmation nobody maintains.
 * - **a refusal is the service's own sentence, verbatim.** It is the only string on the page that
 *   says what to type instead.
 */
describe('EntriesPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const entry = (over: Partial<ConfigurationEntry> = {}): ConfigurationEntry => ({
    application: 'qits-docs',
    key: 'env.QITS_REGISTRY',
    value: 'registry.dev.localhost:8080',
    entryClass: 'plain',
    revision: 41,
    updatedAt: '2026-08-17T09:12:03Z',
    updatedBy: 'wohlben',
    ...over,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideQitsNavigationLinks([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 8; round += 1) {
      await Promise.resolve();
      await harness.fixture.whenStable();
    }
  }

  function page(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  /** A button by the words on it — the way an operator finds it. */
  function press(label: string, within: ParentNode = page()): void {
    const button = Array.from(within.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    expect(button, `no button labelled “${label}”`).toBeTruthy();
    button?.click();
  }

  function type(selector: string, value: string): void {
    const field = page().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    expect(field, `no field at ${selector}`).toBeTruthy();
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
  }

  async function open(entries: readonly ConfigurationEntry[]): Promise<void> {
    harness = await RouterTestingHarness.create('/applications/qits-docs');
    await settle();
    http.expectOne(ENTRIES).flush({ entries });
    await settle();
  }

  it('draws one application’s entries in one request, with key, value and class', async () => {
    await open([entry(), entry({ key: 'mounts[0]', value: '/srv:/work:ro', revision: 42 })]);

    const rows = page().querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('env.QITS_REGISTRY');
    expect(rows[0].textContent).toContain('registry.dev.localhost:8080');
    expect(rows[0].textContent).toContain('plain');
    expect(rows[1].textContent).toContain('mounts[0]');
    expect(page().querySelector('h1')?.textContent).toContain('qits-docs');
    http.verify();
  });

  it('draws a long value whole, with nothing clipped away', async () => {
    await open([entry({ value: LONG_VALUE })]);

    expect(page().querySelector('td.value')?.textContent).toContain(LONG_VALUE);
    http.verify();
  });

  it('says an application with no entries has none, in a sentence', async () => {
    await open([]);

    expect(page().querySelector('table')).toBeNull();
    expect(page().querySelector('app-empty')?.textContent).toContain('no entries');
    http.verify();
  });

  it('links to this application’s history', async () => {
    await open([entry()]);

    expect(page().querySelector('.history-link')?.getAttribute('href')).toBe(
      '/applications/qits-docs/history',
    );
    http.verify();
  });

  it('edits a value in place, PUTs it, and re-reads the store afterwards', async () => {
    await open([entry()]);

    press('Edit');
    await settle();
    type('textarea.editor', 'registry.example:8080');
    press('Save');
    await settle();

    const write = http.expectOne(`${ENTRIES}/env.QITS_REGISTRY`);
    expect(write.request.method).toBe('PUT');
    expect(write.request.body).toEqual({ value: 'registry.example:8080' });
    write.flush({ entry: entry({ value: 'registry.example:8080', revision: 42 }) });
    await settle();

    // The re-read is the assertion: the screen shows what the STORE holds, not what was typed.
    http.expectOne(ENTRIES).flush({ entries: [entry({ value: 'registry.example:8080' })] });
    await settle();

    expect(page().querySelector('textarea.editor')).toBeNull();
    expect(page().querySelector('td.value')?.textContent).toContain('registry.example:8080');
    http.verify();
  });

  it('saves the empty string as a value rather than treating it as a removal', async () => {
    await open([entry()]);

    press('Edit');
    await settle();
    type('textarea.editor', '');
    press('Save');
    await settle();

    const write = http.expectOne(`${ENTRIES}/env.QITS_REGISTRY`);
    expect(write.request.body).toEqual({ value: '' });
    write.flush({ entry: entry({ value: '' }) });
    await settle();
    http.expectOne(ENTRIES).flush({ entries: [entry({ value: '' })] });
    await settle();

    expect(page().querySelector('td.value')?.textContent).toContain('(empty)');
    http.verify();
  });

  it('abandons an edit without writing anything', async () => {
    await open([entry()]);

    press('Edit');
    await settle();
    type('textarea.editor', 'never saved');
    press('Cancel');
    await settle();

    expect(page().querySelector('textarea.editor')).toBeNull();
    expect(page().querySelector('td.value')?.textContent).toContain('registry.dev.localhost:8080');
    http.verify();
  });

  it('asks before it deletes, and the asking costs no request', async () => {
    await open([entry()]);

    press('Delete');
    await settle();

    expect(page().querySelector('.confirm')?.textContent).toContain('Delete this entry?');
    http.verify();

    press('Delete');
    await settle();

    const removal = http.expectOne(`${ENTRIES}/env.QITS_REGISTRY`);
    expect(removal.request.method).toBe('DELETE');
    removal.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    http.expectOne(ENTRIES).flush({ entries: [] });
    await settle();

    expect(page().querySelector('app-empty')).not.toBeNull();
    http.verify();
  });

  it('keeps the entry when the confirmation is declined', async () => {
    await open([entry()]);

    press('Delete');
    await settle();
    press('Keep');
    await settle();

    expect(page().querySelector('.confirm')).toBeNull();
    expect(page().querySelectorAll('tbody tr')).toHaveLength(1);
    http.verify();
  });

  it('shows the service’s refusal of a write verbatim', async () => {
    await open([entry()]);

    press('Edit');
    await settle();
    type('textarea.editor', 'x');
    press('Save');
    await settle();

    const refusal = 'A value is required. Removing an entry is a DELETE.';
    http
      .expectOne(`${ENTRIES}/env.QITS_REGISTRY`)
      .flush({ message: refusal }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(page().querySelector('.page-error')?.textContent?.trim()).toBe(refusal);
    // The editor stays open on a refusal: the value that was refused is still there to correct.
    expect(page().querySelector('textarea.editor')).not.toBeNull();
    http.verify();
  });

  it('refuses a key the grammar rejects before it costs a request', async () => {
    await open([entry()]);

    type('.new input.text', 'volumes[0]');
    await settle();

    expect(page().querySelector('.field-problem')?.textContent).toContain('Not a valid key');
    const submit = Array.from(page().querySelectorAll<HTMLButtonElement>('.new button')).at(-1);
    expect(submit?.disabled).toBe(true);
    http.verify();
  });

  it('writes a new entry with the same PUT, then re-reads and clears the form', async () => {
    await open([entry()]);

    type('.new input.text', 'aliases[0]');
    type('.new textarea.text', 'docs.dev.localhost');
    await settle();

    page()
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    const write = http.expectOne(`${ENTRIES}/aliases%5B0%5D`);
    expect(write.request.method).toBe('PUT');
    expect(write.request.body).toEqual({ value: 'docs.dev.localhost' });
    write.flush(
      { entry: entry({ key: 'aliases[0]', value: 'docs.dev.localhost' }) },
      { status: 201, statusText: 'Created' },
    );
    await settle();

    http
      .expectOne(ENTRIES)
      .flush({ entries: [entry(), entry({ key: 'aliases[0]', value: 'docs.dev.localhost' })] });
    await settle();

    expect(page().querySelectorAll('tbody tr')).toHaveLength(2);
    expect(page().querySelector<HTMLInputElement>('.new input.text')?.value).toBe('');
    http.verify();
  });

  it('shows the service’s refusal of a new key verbatim, keeping what was typed', async () => {
    await open([]);

    type('.new input.text', 'env.QITS_OK');
    type('.new textarea.text', 'x');
    await settle();
    page()
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();

    const refusal =
      'Not a valid key: env.QITS_OK. A key is `env.<VAR>` or one of `mounts[i]`, ' +
      '`publishes[i]`, `groups[i]`, `aliases[i]`.';
    http
      .expectOne(`${ENTRIES}/env.QITS_OK`)
      .flush({ message: refusal }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(page().querySelector('.field-problem')?.textContent?.trim()).toBe(refusal);
    expect(page().querySelector<HTMLInputElement>('.new input.text')?.value).toBe('env.QITS_OK');
    http.verify();
  });

  it('re-reads when the route moves to another application', async () => {
    await open([entry()]);

    await harness.navigateByUrl('/applications/qits-ci');
    await settle();

    http
      .expectOne('/configuration/api/applications/qits-ci/entries')
      .flush({ entries: [entry({ application: 'qits-ci', key: 'env.QITS_CI' })] });
    await settle();

    expect(page().querySelector('h1')?.textContent).toContain('qits-ci');
    expect(page().querySelector('tbody tr')?.textContent).toContain('env.QITS_CI');
    http.verify();
  });
});
