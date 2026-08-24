import { provideHttpClient } from '@angular/common/http';
import type { EnvironmentProviders } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideQitsNavigationLinks, provideQitsScope } from '@qits/ui-components';
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

  /**
   * Configured per test rather than in a `beforeEach`, because the scoped cases need one provider
   * more and `TestBed` refuses to be reconfigured once anything has been injected out of it.
   */
  function configure(extra: readonly EnvironmentProviders[] = []): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideQitsNavigationLinks([]),
        ...extra,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  async function settle(): Promise<void> {
    for (let round = 0; round < 8; round += 1) {
      await Promise.resolve();
      await harness.fixture.whenStable();
    }
  }

  async function open(): Promise<void> {
    configure();
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

  /**
   * The scoped form: an operator who arrived from a repository's sidebar wants that repository's
   * configuration, not a list to find it in.
   *
   * The two outcomes are the whole feature — the repository has an application here, or it does
   * not — and the second is what stops the redirect being a guess. Both are asserted against the
   * listing rather than against the name, because the name alone would land on a page for something
   * this service holds nothing for.
   */
  describe('under a repository scope', () => {
    async function openScoped(): Promise<void> {
      configure([provideQitsScope('repository')]);
      harness = await RouterTestingHarness.create('/qits/services/qits-docs');
      await settle();
    }

    it('replaces the address with the scoped repository own page when it has one', async () => {
      await openScoped();
      await answer([summary({ application: 'qits-docs' }), summary({ application: 'qits-ci' })]);

      expect(TestBed.inject(Router).url).toBe('/qits/services/qits-docs/applications/qits-docs');
      // The entries page is now on screen and issuing its own reads; they are not this spec's.
      http.match(() => true);
    });

    it('stays on the list with a note when the repository has no configuration', async () => {
      await openScoped();
      await answer([summary({ application: 'qits-ci' })]);

      expect(TestBed.inject(Router).url).toBe('/qits/services/qits-docs');
      expect(page().textContent).toContain('qits-docs has no configuration of its own here');
      expect(page().querySelectorAll('tbody tr')).toHaveLength(1);
      http.verify();
    });

    it('keeps its links inside the scope', async () => {
      await openScoped();
      await answer([summary({ application: 'qits-ci' })]);

      expect(page().querySelector('tbody a')?.getAttribute('href')).toBe(
        '/qits/services/qits-docs/applications/qits-ci',
      );
      http.verify();
    });
  });
});
