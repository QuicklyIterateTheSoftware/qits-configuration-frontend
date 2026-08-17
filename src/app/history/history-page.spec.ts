import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideQitsNavigationLinks } from '@qits/ui-components';
import type { ConfigurationRevision } from '../api/dto';
import { routes } from '../app.routes';

const HISTORY = '/configuration/api/applications/qits-docs/history';

/**
 * The write log, newest first.
 *
 * Two assertions carry this file. **The order is the service's**, so a row order asserted here is
 * the order the response arrived in and never a sort this page applied — `seq` is the append-only
 * sequence the deployer quotes, and re-sorting it would disagree with the store on any tie.
 * **A deletion is drawn as a word**, because an entry may hold the empty string: a blank cell would
 * have merged the two most different events in this log.
 */
describe('HistoryPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const revision = (over: Partial<ConfigurationRevision> = {}): ConfigurationRevision => ({
    seq: 41,
    application: 'qits-docs',
    key: 'env.QITS_REGISTRY',
    value: 'registry.dev.localhost:8080',
    deleted: false,
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

  async function open(revisions: readonly ConfigurationRevision[]): Promise<void> {
    harness = await RouterTestingHarness.create('/applications/qits-docs/history');
    await settle();
    http.expectOne(HISTORY).flush({ revisions });
    await settle();
  }

  it('draws the log in one request, in the order the service sent it', async () => {
    await open([
      revision({ seq: 43, key: 'env.LATER', value: 'two' }),
      revision({ seq: 42, key: 'env.EARLIER', value: 'one' }),
    ]);

    const rows = page().querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('43');
    expect(rows[0].textContent).toContain('env.LATER');
    expect(rows[1].textContent).toContain('42');
    http.verify();
  });

  it('draws every column a row carries: who wrote it and when, in UTC', async () => {
    await open([revision()]);

    const row = page().querySelector('tbody tr');
    expect(row?.textContent).toContain('wohlben');
    expect(row?.textContent).toContain('17 Aug 2026 09:12:03Z');
    http.verify();
  });

  it('says “deleted” for a removed entry rather than drawing a blank cell', async () => {
    await open([revision({ seq: 44, value: null, deleted: true })]);

    const value = page().querySelector('tbody td.value');
    expect(value?.textContent?.trim()).toBe('deleted');
    http.verify();
  });

  it('tells a blanked value apart from a deleted one', async () => {
    await open([revision({ seq: 45, value: '', deleted: false })]);

    const value = page().querySelector('tbody td.value');
    expect(value?.textContent?.trim()).toBe('(empty)');
    http.verify();
  });

  it('says nothing has been written rather than drawing an empty table', async () => {
    await open([]);

    expect(page().querySelector('table')).toBeNull();
    expect(page().querySelector('app-empty')?.textContent).toContain('Nothing has been written');
    http.verify();
  });

  it('offers the way back to the application and to the listing', async () => {
    await open([revision()]);

    const crumbs = Array.from(page().querySelectorAll('.crumbs a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(crumbs).toEqual(['/', '/applications/qits-docs']);
    http.verify();
  });

  it('reports a failed read and retries it on request', async () => {
    harness = await RouterTestingHarness.create('/applications/qits-docs/history');
    await settle();
    http
      .expectOne(HISTORY)
      .flush({ message: 'nope' }, { status: 503, statusText: 'Service Unavailable' });
    await settle();

    expect(page().querySelector('app-async')?.textContent).toContain('503 nope');

    page().querySelector<HTMLButtonElement>('app-async button')?.click();
    await settle();
    http.expectOne(HISTORY).flush({ revisions: [revision()] });
    await settle();

    expect(page().querySelectorAll('tbody tr')).toHaveLength(1);
    http.verify();
  });
});
