import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideQitsNavigationLinks } from '@qits/ui-components';
import { App } from './app';
import { routes } from './app.routes';

/**
 * A fixture navigation, not the platform's. `provideQitsNavigationLinks` answers the layout's
 * `QITS_NAVIGATION` from a literal, so the chrome makes no `/main-navigation` request — which is
 * what keeps `http.verify()` honest instead of failing on a call this file never asked for.
 */
const NAV = [
  { label: 'Deployments', href: '/platform-deployments/' },
  { label: 'Configuration', href: '/configuration/' },
] as const;

/**
 * The shell owns one thing — the outlet — so that is what is asserted here, plus the route table
 * putting all three doors inside the chrome and the deep links landing on the right page.
 *
 * The layout assertion is not ceremony. Every page here is an administrator's, and one accidentally
 * mounted outside `QitsMainLayout` would be a screen that edits a deployment's environment with no
 * way back to anything — invisible on the page itself and a two-character edit away in this table.
 */
describe('App', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideQitsNavigationLinks(NAV),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('is an outlet and nothing else', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const shell = fixture.nativeElement as HTMLElement;
    expect(shell.querySelector('router-outlet')).not.toBeNull();
    expect(shell.querySelector('h1')).toBeNull();
    http.verify();
  });

  it('draws the applications listing at the base path, inside the chrome', async () => {
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/configuration/api/applications').flush({ applications: [] });

    const layout = harness.routeNativeElement as HTMLElement;
    expect(layout.tagName.toLowerCase()).toBe('qits-main-layout');
    expect(layout.querySelectorAll('nav a')).toHaveLength(NAV.length);
    expect(layout.querySelector('main app-applications-page')).not.toBeNull();
    http.verify();
  });

  it('routes one application to its entries, still inside the chrome', async () => {
    const harness = await RouterTestingHarness.create('/applications/qits-docs');
    http.expectOne('/configuration/api/applications/qits-docs/entries').flush({ entries: [] });

    const layout = harness.routeNativeElement as HTMLElement;
    expect(layout.tagName.toLowerCase()).toBe('qits-main-layout');
    expect(layout.querySelector('main app-entries-page')).not.toBeNull();
    http.verify();
  });

  it('routes the history segment to the history page', async () => {
    const harness = await RouterTestingHarness.create('/applications/qits-docs/history');
    http.expectOne('/configuration/api/applications/qits-docs/history').flush({ revisions: [] });

    const layout = harness.routeNativeElement as HTMLElement;
    expect(layout.querySelector('main app-history-page')).not.toBeNull();
    http.verify();
  });

  it('draws an unknown URL under /configuration/ as a page, still inside the chrome', async () => {
    const harness = await RouterTestingHarness.create('/nothing-here');

    const layout = harness.routeNativeElement as HTMLElement;
    expect(layout.tagName.toLowerCase()).toBe('qits-main-layout');
    expect(layout.querySelector('main app-not-found')).not.toBeNull();
    http.verify();
  });
});
