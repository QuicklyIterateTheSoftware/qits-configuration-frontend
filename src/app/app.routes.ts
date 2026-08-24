import type { CanMatchFn, Routes, UrlSegment } from '@angular/router';
import { QitsMainLayout, QITS_CATEGORIES, type QitsCategory } from '@qits/ui-components';
import { NotFound } from './not-found/not-found';

/**
 * Three doors, all of them inside the platform chrome.
 *
 * **`QitsMainLayout` is the root route component** — the platform's convention, stated in the
 * component's own docs. Mounted this way the bar and the navigation mount once and survive every
 * navigation beneath them; wrapping each page in a tag would rebuild the whole skeleton on every
 * hop. It is an eager import for that reason: it is not a page, it is the frame the pages arrive
 * in, and a frame that loaded in its own chunk would show a blank application while it did.
 *
 * **Nothing here renders outside the chrome.** qits-platform-spa-idp is the one repository on this
 * platform with pages that do, and the reason is peculiar to it: a sign-in page cannot show a
 * sidebar full of doors its visitor has not been admitted to yet. Every page here is an
 * administrator's, reached with a session already in hand, so all three sit under the layout — and
 * so does `**`, because this application owns the whole of its own host and an unknown URL is an
 * ordinary 404 with the chrome around it.
 *
 * **Every page loads lazily**, the idp scaffold's shape. The three screens share only the small
 * `ui/` furniture, so each URL costs about itself: an operator who opens a deep link to one
 * application's history downloads neither the applications listing nor the entries table.
 *
 * **The path shape repeats the API's, noun for noun.** `/applications/qits-docs` is the page for
 * what `GET /configuration/api/applications/qits-docs/entries` answers, and `…/history` for its
 * history. A bare id under the base href would have read better once and then
 * swallowed every future top-level route; every sibling repeats its noun for that reason.
 *
 * The listing is at `''` rather than at `applications` with a redirect: it is the front door, there
 * is nothing else it could be, and one address for one screen keeps the back button honest.
 */
const OWN: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./applications/applications-page').then((m) => m.ApplicationsPage),
  },
  {
    path: 'applications/:application',
    pathMatch: 'full',
    loadComponent: () => import('./entries/entries-page').then((m) => m.EntriesPage),
  },
  {
    path: 'applications/:application/history',
    loadComponent: () => import('./history/history-page').then((m) => m.HistoryPage),
  },
];

/**
 * Whether the address is really `/<slug>/<category>/<repo>/…` and not a page of this app's own.
 *
 * The second segment is the discriminator, because it is the only one whose vocabulary is closed:
 * a project slug can be anything, a repository name can be anything, and `services` is a category
 * on this platform and nothing else. qits-projects refuses a slug that spells a category or a
 * routed segment, so the two vocabularies cannot collide from the other side either.
 */
export const categoryIsKnown: CanMatchFn = (_route, segments: UrlSegment[]) =>
  QITS_CATEGORIES.includes(segments[1]?.path as QitsCategory);

/**
 * Each of the three doors is addressable THREE TIMES — at its own path, under a project, and under
 * the repository whose configuration it shows — and every spelling resolves to the same component.
 *
 * The project form is what the chrome's project picker navigates to: `UrlScope.select(slug)` goes
 * to `/<slug>/`, and without this route that pick would land on the 404 page.
 *
 * Order is the whole grammar, and it works because the three vocabularies cannot collide: a
 * category is never a slug, and a slug is never one of this app's own first segments. OWN routes
 * come first, so `/applications` is this app's own page and never a project called `applications`;
 * the repository form follows, guarded on the category; the project form takes what is left; and
 * `**` closes the list.
 *
 * The pages read `inject(QITS_SCOPE).scope()` rather than these three params. A page that read them
 * would work in one spelling and be blank in the others.
 */
export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [
      ...OWN,
      { path: ':project/:category/:repository', canMatch: [categoryIsKnown], children: OWN },
      { path: ':project', children: OWN },
      { path: '**', component: NotFound },
    ],
  },
];
