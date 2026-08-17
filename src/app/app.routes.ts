import type { Routes } from '@angular/router';
import { QitsMainLayout } from '@qits/ui-components';
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
 * so does `**`, because `/configuration/` is a segment this application owns outright and an
 * unknown URL under it is an ordinary 404 with the chrome around it.
 *
 * **Every page loads lazily**, the idp scaffold's shape. The three screens share only the small
 * `ui/` furniture, so each URL costs about itself: an operator who opens a deep link to one
 * application's history downloads neither the applications listing nor the editor.
 *
 * **The path shape repeats the API's, noun for noun.** `/configuration/applications/qits-docs` is
 * the page for what `GET /configuration/api/applications/qits-docs/entries` answers, and
 * `…/history` for its history. A bare id under the base href would have read better once and then
 * swallowed every future top-level route; every sibling repeats its noun for that reason.
 *
 * The listing is at `''` rather than at `applications` with a redirect: it is the front door, there
 * is nothing else it could be, and one address for one screen keeps the back button honest.
 */
export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./applications/applications-page').then((m) => m.ApplicationsPage),
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
      { path: '**', component: NotFound },
    ],
  },
];
