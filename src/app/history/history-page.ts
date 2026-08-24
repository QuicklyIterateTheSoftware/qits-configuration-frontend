import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, convertToParamMap } from '@angular/router';
import { ConfigurationApi } from '../api/configuration-api';
import type { ConfigurationRevision } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, actor, formatInstant, plural } from '../ui/format';
import { LOADING, failed, ready, type Loadable } from '../ui/loadable';
import { ConfigurationLinks } from '../ui/links';

/**
 * What has been written to one application's configuration, newest first.
 *
 * **Load budget: one request, and nothing per row.** `GET …/history` answers the whole log for this
 * application, and every column comes off the row it draws.
 *
 * **The order is the service's, not this page's.** `seq` is the append-only log's own sequence, and
 * the rows arrive newest first already. Re-sorting them here — by timestamp, say — would disagree
 * with the store the moment two writes share an instant, and the sequence is the thing the deployer
 * quotes when it records what it deployed with.
 *
 * **A deletion is a row with no value, and it is drawn as a word rather than as a blank.** An entry
 * may hold the empty string, so `value: null` alone could not tell a deletion from a blanking — the
 * service carries a `deleted` flag beside it for exactly that reason, and this table reads the flag.
 * A blank cell would have merged the two most different events in this log.
 *
 * **Nothing here restores a revision.** The store has no such route, and a button that re-PUT an old
 * value would be a restore that quietly wrote a NEW revision — a different thing, worth its own
 * decision, and not one to smuggle in behind a familiar word. Copying a value out of a row and
 * writing it on the entries page does the same work and says what it is doing.
 */
@Component({
  selector: 'app-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Async, Empty],
  styleUrls: ['../ui/page.css'],
  template: `
    <p class="crumbs">
      <a [routerLink]="links.commands()">Applications</a>
      <span class="sep">/</span>
      <a [routerLink]="links.commands('applications', application())">{{ application() }}</a>
      <span class="sep">/</span>
      <span>History</span>
    </p>

    <header class="head">
      <h1>{{ application() }} — history</h1>
    </header>
    <p class="lede">Every write to this application's configuration, newest first.</p>

    <app-async
      [state]="state()"
      loadingLabel="Loading history"
      errorLabel="Could not load the history"
      (retry)="load()"
    />

    @if (state().kind === 'ready') {
      @if (revisions().length === 0) {
        <app-empty
          message="Nothing has been written for this application. Its history begins with its first entry."
        />
      } @else {
        <div class="scroll">
          <table>
            <caption>
              {{
                caption()
              }}. A deleted entry keeps what it held — that is what makes an accidental delete
              answerable rather than merely regrettable.
            </caption>
            <thead>
              <tr>
                <th scope="col" class="num">Revision</th>
                <th scope="col">Key</th>
                <th scope="col">Value</th>
                <th scope="col">By</th>
                <th scope="col">At</th>
              </tr>
            </thead>
            <tbody>
              @for (revision of revisions(); track revision.seq) {
                <tr>
                  <th scope="row" class="num">{{ revision.seq }}</th>
                  <td class="mono key">{{ revision.key }}</td>
                  <td class="value mono">
                    @if (revision.deleted) {
                      <span class="deleted">deleted</span>
                    } @else if (revision.value === null || revision.value.length === 0) {
                      <span class="subtle empty-value">(empty)</span>
                    } @else {
                      {{ revision.value }}
                    }
                  </td>
                  <td class="subtle">{{ actor(revision.updatedBy) }}</td>
                  <td class="subtle">{{ formatInstant(revision.updatedAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    <p class="note">
      A write that changed nothing is not in this log. Setting an entry to the value it already
      holds stores no revision, which is what keeps a re-run of a seeding script free and this list
      a record of changes rather than of runs.
    </p>
  `,
  styles: `
    .key {
      max-width: 22rem;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .deleted {
      color: #b91c1c;
      font-style: italic;
    }
    .empty-value {
      font-style: italic;
    }
  `,
})
export class HistoryPage {
  protected readonly links = inject(ConfigurationLinks);

  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ConfigurationApi);

  protected readonly NONE = NONE;
  protected readonly actor = actor;
  protected readonly formatInstant = formatInstant;

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: convertToParamMap({}),
  });

  protected readonly application = computed(() => this.params().get('application') ?? '');

  protected readonly state = signal<Loadable<readonly ConfigurationRevision[]>>(LOADING);

  protected readonly revisions = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : [];
  });

  protected readonly caption = computed(() =>
    plural(this.revisions().length, 'recorded write', 'recorded writes'),
  );

  constructor() {
    // The application is a path segment, so this component is reused across two applications'
    // histories. Reading it as a signal is what makes that navigation a fetch.
    effect(() => {
      const application = this.application();
      if (application.length > 0) {
        this.load();
      }
    });
  }

  protected load(): void {
    const application = this.application();
    this.state.set(LOADING);
    this.api.history(application).then(
      (revisions) => this.state.set(ready(revisions)),
      (error: unknown) => this.state.set(failed(error)),
    );
  }
}
