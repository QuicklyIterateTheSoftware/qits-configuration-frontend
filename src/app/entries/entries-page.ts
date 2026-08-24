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
import { QitsBadge } from '@qits/ui-components';
import { ConfigurationApi } from '../api/configuration-api';
import type { ConfigurationEntry } from '../api/dto';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, actor, formatInstant, plural } from '../ui/format';
import { LOADING, failed, ready, type Loadable } from '../ui/loadable';
import { ConfigurationLinks } from '../ui/links';

/**
 * One application's configuration, as it is stored now.
 *
 * **This page reads and never writes, and that is a decision rather than an omission.** The entries
 * are system state: the platform's own processes write them through the API — a deployment, a
 * bootstrap import, a service that learns its own address — and every one of those writes is part of
 * a larger operation that has more to do afterwards. A hand edit in a browser lands in the middle of
 * that with none of the rest of it, so the screen offers no way to make one. The posture is said on
 * the page too, under the table, because a table without buttons otherwise reads as a table whose
 * buttons have not loaded.
 *
 * **Load budget: one request.** `GET …/entries` draws the whole table, and every column comes off
 * the row it draws.
 *
 * **THE VALUE IS THE POINT OF THIS SCREEN, so nothing here truncates one.** These values are mount
 * specifications, alias lists, URLs with query strings, occasionally something very long, and an
 * operator reads them to answer "what will this deployment run with". A cell that clipped at 60
 * characters with an ellipsis would be a screen that says something false about a deployment. The
 * table wraps instead — see `.value` in ui/page.css.
 *
 * **What this page cannot tell you is when a change takes effect.** The deployer reads an
 * application's entries once per deployment, so a write reaches a running container on its next
 * deployment and not before. The note at the foot says so, because an operator who assumed otherwise
 * would go looking for a bug in the deployer.
 */
@Component({
  selector: 'app-entries-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, QitsBadge, Async, Empty],
  templateUrl: './entries-page.html',
  styleUrls: ['../ui/page.css', './entries-page.css'],
})
export class EntriesPage {
  protected readonly links = inject(ConfigurationLinks);

  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ConfigurationApi);

  protected readonly NONE = NONE;
  protected readonly actor = actor;
  protected readonly formatInstant = formatInstant;

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: convertToParamMap({}),
  });

  /**
   * The application, as the path segment spells it. It is not validated here: a name the service
   * refuses answers 400, which is this page's own state rather than a routing decision, and a name
   * nobody has configured answers 200 with an empty list rather than a 404.
   */
  protected readonly application = computed(() => this.params().get('application') ?? '');

  /** The table. Its failure is the page's. */
  protected readonly state = signal<Loadable<readonly ConfigurationEntry[]>>(LOADING);

  protected readonly entries = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.value : [];
  });

  protected readonly caption = computed(() => plural(this.entries().length, 'entry', 'entries'));

  constructor() {
    // The application is a path segment, so moving between two applications REUSES this component
    // rather than rebuilding it. Reading it as a signal is what makes that navigation a fetch.
    effect(() => {
      const application = this.application();
      if (application.length > 0) {
        this.load();
      }
    });
  }

  /** The page's only request, re-issued by the retry button. */
  protected load(): void {
    const application = this.application();
    this.state.set(LOADING);
    this.api.entries(application).then(
      (entries) => this.state.set(ready(entries)),
      (error: unknown) => this.state.set(failed(error)),
    );
  }
}
