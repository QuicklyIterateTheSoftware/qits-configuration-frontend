import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ApplicationSummary } from '../api/dto';
import { ConfigurationApi } from '../api/configuration-api';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { plural } from '../ui/format';
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
                    <a [routerLink]="['/applications', application.application]">{{
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

  protected readonly state = signal<Loadable<readonly ApplicationSummary[]>>(LOADING);

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
    this.api.applications().then(
      (applications) => this.state.set(ready(applications)),
      (error: unknown) => this.state.set(failed(error)),
    );
  }
}
