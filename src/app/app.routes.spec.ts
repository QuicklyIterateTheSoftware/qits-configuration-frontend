import { provideZonelessChangeDetection } from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { NotFound } from './not-found/not-found';

/**
 * Each of the three doors is addressable three times — its own path, the same path under a project,
 * and the same path under the repository whose configuration it shows — and all three must land on
 * the SAME component. A second component for a scoped form is the failure this guards against: it
 * would compile, render, and drift.
 *
 * <p>Components are never created here. Without a `RouterOutlet` the router resolves the state and
 * stops, so this reads what each URL resolves to without booting the chrome or any of its reads.
 * The three pages are lazy, so what is compared is the resolved class rather than an import: two
 * addresses resolving to the same object is the claim, and its identity is enough to make it.
 */
describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(routes), provideLocationMocks()],
    });
  });

  async function resolve(url: string): Promise<unknown> {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    let node = router.routerState.snapshot.root;
    while (node.firstChild) node = node.firstChild;
    return node.component;
  }

  it('serves the listing unscoped and under a repository', async () => {
    const own = await resolve('/');
    expect(own).toBeTruthy();
    expect(await resolve('/qits/services/qits-docs')).toBe(own);
  });

  it('serves one application entries page in both spellings', async () => {
    const own = await resolve('/applications/qits-docs');
    expect(own).toBeTruthy();
    expect(await resolve('/qits/services/qits-docs/applications/qits-docs')).toBe(own);
  });

  it('serves the history page in both spellings', async () => {
    const own = await resolve('/applications/qits-docs/history');
    expect(own).toBeTruthy();
    expect(await resolve('/qits/daemons/qits-docs/applications/qits-docs/history')).toBe(own);
  });

  it('serves all three doors under a project', async () => {
    // `/qits` is where the chrome's project picker sends this app when a reader picks `qits`.
    expect(await resolve('/qits')).toBe(await resolve('/'));
    expect(await resolve('/qits/applications/qits-docs')).toBe(
      await resolve('/applications/qits-docs'),
    );
    expect(await resolve('/qits/applications/qits-docs/history')).toBe(
      await resolve('/applications/qits-docs/history'),
    );
  });

  /**
   * The literal wins, which is why OWN routes come first. `applications` is a plausible project
   * slug, and the ordering is what keeps it this app's own page rather than a scope — against the
   * project form as much as against the repository one.
   */
  it('reads a literal first segment as this app own page, not as a project', async () => {
    const own = await resolve('/applications/qits-docs');
    expect(own).not.toBe(NotFound);
    expect(await resolve('/applications/qits-docs/history')).not.toBe(own);
  });

  /** A second segment that is not a category is not a scope, so the 404 page takes it. */
  it('does not read an arbitrary three-segment path as a scope', async () => {
    expect(await resolve('/qits/nonsense/qits-docs')).toBe(NotFound);
    expect(await resolve('/no/such/page/here')).toBe(NotFound);
  });
});
