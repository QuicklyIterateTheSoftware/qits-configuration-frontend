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
 * The table, state by state.
 *
 * Four claims are worth a test here and each of them is a way this page could be quietly wrong:
 *
 * - **a value is never truncated.** The whole point of the screen is reading what a deployment will
 *   carry, and a cell that clipped at some width would say something false about it while looking
 *   entirely normal.
 * - **the page offers no way to write.** The entries are system state and the platform's own
 *   processes set them; a button that reappeared here would invite a hand edit in the middle of an
 *   operation that has more to do afterwards.
 * - **it says so, in a sentence.** A table with no buttons otherwise reads as a table whose buttons
 *   failed to load.
 * - **a failed read is a failed read, with a way back.** The error is drawn where the table would
 *   be, and the retry re-issues the request.
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

  it('draws who changed a row and when', async () => {
    await open([entry({ updatedBy: 'qits-platform-deployments' })]);

    expect(page().querySelector('.changed')?.textContent).toContain('qits-platform-deployments');
    http.verify();
  });

  it('draws a long value whole, with nothing clipped away', async () => {
    await open([entry({ value: LONG_VALUE })]);

    expect(page().querySelector('td.value')?.textContent).toContain(LONG_VALUE);
    http.verify();
  });

  it('draws the empty string as a word rather than as a blank cell', async () => {
    await open([entry({ value: '' })]);

    expect(page().querySelector('td.value')?.textContent).toContain('(empty)');
    http.verify();
  });

  it('offers no way to write: no button, no field, no form', async () => {
    await open([entry()]);

    // Scoped to this page's own host: the chrome around it has buttons of its own, and they are
    // not what this test is about.
    const view = page().querySelector('app-entries-page');
    expect(view).not.toBeNull();
    expect(view?.querySelector('form')).toBeNull();
    expect(view?.querySelector('input')).toBeNull();
    expect(view?.querySelector('textarea')).toBeNull();
    expect(view?.querySelectorAll('button')).toHaveLength(0);
    http.verify();
  });

  it('says the view is read-only, in a sentence', async () => {
    await open([entry()]);

    expect(page().querySelector('.posture')?.textContent).toContain('read-only');
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

  it('draws a failed read where the table would be, and retries from there', async () => {
    harness = await RouterTestingHarness.create('/applications/qits-docs');
    await settle();
    http
      .expectOne(ENTRIES)
      .flush({ message: 'the store is down' }, { status: 503, statusText: 'Service Unavailable' });
    await settle();

    const error = page().querySelector('.async-error');
    expect(error?.textContent).toContain('Could not load the entries');
    expect(error?.textContent).toContain('503 the store is down');
    // The heading stays: a failed panel does not erase the page around it.
    expect(page().querySelector('h1')?.textContent).toContain('qits-docs');

    press('Retry');
    await settle();
    http.expectOne(ENTRIES).flush({ entries: [entry()] });
    await settle();

    expect(page().querySelectorAll('tbody tr')).toHaveLength(1);
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
