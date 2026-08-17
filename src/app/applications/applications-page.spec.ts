import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideQitsNavigationLinks } from '@qits/ui-components';
import type { ApplicationSummary } from '../api/dto';
import { routes } from '../app.routes';

/**
 * The listing, one state at a time.
 *
 * The assertion this file exists for is the first one: **one request, and none per row.** The entry
 * count and the head revision arrive with the listing, so a table of forty applications costs what a
 * table of one costs — and the day someone reaches for "just fetch each application's entries to
 * count them", `http.verify()` fails here.
 *
 * Driven through the router rather than by constructing the component, which is the house pattern:
 * the page is a lazy route and its own address is part of what it is.
 */
describe('ApplicationsPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const summary = (over: Partial<ApplicationSummary> = {}): ApplicationSummary => ({
    application: 'qits-docs',
    entries: 3,
    headRevision: 41,
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

  async function open(): Promise<void> {
    harness = await RouterTestingHarness.create('/');
    await settle();
  }

  function page(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  async function answer(applications: readonly ApplicationSummary[]): Promise<void> {
    http.expectOne('/configuration/api/applications').flush({ applications });
    await settle();
  }

  it('draws every application in one request, with its two numbers', async () => {
    await open();
    await answer([
      summary({ application: 'qits-docs', entries: 3, headRevision: 41 }),
      summary({ application: 'qits-ci', entries: 12, headRevision: 240 }),
    ]);

    const rows = page().querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('qits-docs');
    expect(rows[0].textContent).toContain('41');
    expect(rows[1].textContent).toContain('qits-ci');
    http.verify();
  });

  it('links each application to its own page', async () => {
    await open();
    await answer([summary({ application: 'qits-docs' })]);

    const link = page().querySelector('tbody a');
    expect(link?.getAttribute('href')).toBe('/applications/qits-docs');
    http.verify();
  });

  it('keeps an application whose entries have all been deleted, at zero', async () => {
    await open();
    await answer([summary({ application: 'qits-stt', entries: 0, headRevision: 9 })]);

    const row = page().querySelector('tbody tr');
    expect(row?.textContent).toContain('qits-stt');
    expect(row?.textContent).toContain('0');
    expect(page().querySelector('app-empty')).toBeNull();
    http.verify();
  });

  it('says the list is empty in a sentence rather than as blank space', async () => {
    await open();
    await answer([]);

    expect(page().querySelector('table')).toBeNull();
    expect(page().querySelector('app-empty')?.textContent).toContain('No application');
    http.verify();
  });

  it('reports a failed read and retries it on request', async () => {
    await open();
    http
      .expectOne('/configuration/api/applications')
      .flush({ message: 'nope' }, { status: 503, statusText: 'Service Unavailable' });
    await settle();

    expect(page().querySelector('app-async')?.textContent).toContain('503 nope');
    expect(page().querySelector('table')).toBeNull();

    page().querySelector<HTMLButtonElement>('app-async button')?.click();
    await settle();
    await answer([summary()]);

    expect(page().querySelectorAll('tbody tr')).toHaveLength(1);
    http.verify();
  });
});
