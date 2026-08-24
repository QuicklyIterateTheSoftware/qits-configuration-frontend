import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { ApplicationSummary } from '../api/dto';
import { ConfigurationApi } from '../api/configuration-api';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { plural } from '../ui/format';
import { ConfigurationLinks } from '../ui/links';
import { LOADING, failed, ready, type Loadable } from '../ui/loadable';

/**
 * The front door: every application this service holds configuration for.
 *
 * **Load budget: one request, and nothing per row.** `GET /configuration/api/applications` answers
 * the name, the entry count and the head revision for each one, so the two numbers in this table
 * cost nothing extra — asking each application for its entries to count them would turn one request
 * into one per row and would be the same number twice.
 *
 * **An application at zero entries is still listed, and that is the service's decision rather than
 * this table's.** "Where did my configuration go" is the question this listing most needs to be able
 * to answer, so a row whose entries have all been deleted stays — with its head revision moved
 * forward, which is exactly how it says what happened.
 *
 * **The two numbers do not track each other, and the caption says so.** `entries` counts what is
 * stored now; `headRevision` counts how far the append-only log has run, so it moves forward on a
 * delete while the count goes down. Someone reading them as "N entries, N writes" would think a row
 * at 3 entries and revision 240 was a bug.
 *
 * There is no create-an-application form, because there is no such thing: an application exists here
 * because it has an entry, and the first entry is written on the application's own page. A form here
 * would create a name with nothing behind it, which the service has no row for.
 *
 * **With a repository in scope this page is a doorway rather than a destination.** An operator who
 * arrived from that repository's sidebar wants its configuration, not a list to find it in — so
 * when the listing contains an application of that name the page replaces the address with it. It
 * REPLACES rather than pushes: the list was never a step the reader took, and leaving it in the
 * history would make Back bounce them straight forward again.
 *
 * The redirect waits for the listing on purpose. Navigating on the name alone would land on a page
 * for an application this service has nothing for, and the honest answer to "this repository has no
 * configuration" is this list with a line saying so.
 */
@Component({
  selector: 'app-applications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Async, Empty],
  styleUrls: ['../ui/page.css'],
  template: `
    <header class="head">
      <h1>Deployment configuration</h1>
    </header>
    <p class="lede">
      What each application on this platform is deployed with. Every entry here is read by
      qits-platform-deployments on the application's next deployment, and every change to one is
      kept.
    </p>

    <app-async
      [state]="state()"
      loadingLabel="Loading applications"
      errorLabel="Could not load the applications"
      (retry)="load()"
    />

    @if (unconfigured(); as repository) {
      <p class="note" role="status">
        {{ repository }} has no configuration of its own here. Everything this service holds is
        below.
      </p>
    }

    @if (state().kind === 'ready') {
      @if (applications().length === 0) {
        <app-empty
          message="No application has configuration here yet. An application appears in this list when its first entry is written."
        />
      } @else {
        <div class="scroll">
          <table>
            <caption>
              {{
                caption()
              }}. Entries are what is stored now; the head revision is how far the write log has
              run, so it keeps moving forward when an entry is deleted.
            </caption>
            <thead>
              <tr>
                <th scope="col">Application</th>
                <th scope="col" class="num">Entries</th>
                <th scope="col" class="num">Head revision</th>
              </tr>
            </thead>
            <tbody>
              @for (application of applications(); track application.application) {
                <tr>
                  <td>
                    <a [routerLink]="links.commands('applications', application.application)">{{
                      application.application
                    }}</a>
                  </td>
                  <td class="num">{{ application.entries }}</td>
                  <td class="num">{{ application.headRevision }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    <p class="note">
      This is not what a deployment is running — it is what its next deployment will carry. The
      deployer reads an application's entries once per deployment and records the revision it
      deployed with.
    </p>
  `,
})
export class ApplicationsPage {
  private readonly api = inject(ConfigurationApi);
  private readonly router = inject(Router);
  protected readonly links = inject(ConfigurationLinks);

  protected readonly state = signal<Loadable<readonly ApplicationSummary[]>>(LOADING);

  /** The scoped repository, once the listing has answered and does NOT contain it. */
  protected readonly unconfigured = signal<string | undefined>(undefined);

  protected readonly applications = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : [];
  });

  protected readonly caption = computed(() =>
    plural(this.applications().length, 'application', 'applications'),
  );

  constructor() {
    this.load();
  }

  /** The page's one request, re-issued by the retry button and by nothing else. */
  protected load(): void {
    this.state.set(LOADING);
    this.unconfigured.set(undefined);
    this.api.applications().then(
      (applications) => {
        this.state.set(ready(applications));
        this.settleScope(applications);
      },
      (error: unknown) => this.state.set(failed(error)),
    );
  }

  /**
   * Go to the scoped repository's own page, or say plainly that it has none.
   *
   * Matched by NAME and by nothing else: an application id here is the deployed application's name,
   * which is the repository's. There is no field on either side recording the link, so a repository
   * whose application is named differently falls to the note rather than to a wrong page.
   */
  private settleScope(applications: readonly ApplicationSummary[]): void {
    const repository = this.links.scope()?.repository;
    if (!repository) return;
    if (applications.some((application) => application.application === repository)) {
      void this.router.navigate(this.links.commands('applications', repository), {
        replaceUrl: true,
      });
      return;
    }
    this.unconfigured.set(repository);
  }
}
