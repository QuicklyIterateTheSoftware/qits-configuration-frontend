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
import { QitsBadge, QitsButton } from '@qits/ui-components';
import { ConfigurationApi } from '../api/configuration-api';
import type { ConfigurationEntry } from '../api/dto';
import { keyProblem } from '../api/key-grammar';
import { Async } from '../ui/async';
import { Empty } from '../ui/empty';
import { NONE, actor, formatInstant, plural } from '../ui/format';
import { LOADING, failed, ready, refusalMessage, type Loadable } from '../ui/loadable';

/**
 * One application's configuration: what it is stored with now, and the three ways to change it.
 *
 * **Load budget: one request, plus one per change.** `GET …/entries` draws the whole table, and a
 * write is a PUT or a DELETE followed by a re-read of that same list. The re-read is deliberate and
 * it is not laziness: the service decides what a write stored — it trims nothing, it refuses an
 * absent value, it writes NO revision when the value is byte-for-byte what was already there — so a
 * table patched from the request would show what was typed while the store held something else.
 * One extra request per change buys a screen that cannot lie.
 *
 * **THE VALUE IS THE POINT OF THIS SCREEN, so nothing here truncates one.** These values are mount
 * specifications, alias lists, URLs with query strings, occasionally something very long, and an
 * operator reads them to answer "what will this deployment run with". A cell that clipped at 60
 * characters with an ellipsis would be a screen that says something false about a deployment. The
 * table wraps instead (see `.value` in ui/page.css), and the editor is a textarea for the same
 * reason — a single-line input makes a long value editable only by scrolling blind.
 *
 * **Editing is inline rather than a dialog**, because the thing being changed has to stay readable
 * beside its neighbours: a mount that collides with another mount is a mistake nobody makes when
 * both are on screen. A dialog would cover exactly the rows that make the edit answerable.
 *
 * **Deleting asks first, in the row.** `window.confirm` is what a browser offers and it is the wrong
 * instrument twice over — it renders outside the page's chrome and jsdom does not implement it at
 * all, so a suite could never prove that the confirmation exists. The two-press form is a state on
 * the row: press Delete, the row asks, press Delete again or Cancel. That it is provable is the
 * reason it is written this way.
 *
 * **A refused write shows the SERVICE's sentence, verbatim.** qits-configuration names which part of
 * the grammar a key missed, and that sentence is the only thing on screen that says what to type
 * instead; the client-side check in `api/key-grammar.ts` exists to save the round trip, never to
 * replace the answer. See `refusalMessage` in ui/loadable.ts.
 *
 * **What this page cannot tell you is when the change takes effect.** The deployer reads an
 * application's entries once per deployment, so a write here reaches a running container on its next
 * deployment and not before. The note at the foot says so, because an operator who assumed otherwise
 * would go looking for a bug in the deployer.
 */
@Component({
  selector: 'app-entries-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, QitsBadge, QitsButton, Async, Empty],
  templateUrl: './entries-page.html',
  styleUrls: ['../ui/page.css', './entries-page.css'],
})
export class EntriesPage {
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

  /** The key whose value is open in the editor, or null when none is. */
  protected readonly editing = signal<string | null>(null);

  /** What the editor holds. It starts as the stored value and is never written back to the row. */
  protected readonly draft = signal('');

  /** The key whose delete has been asked for and not yet confirmed. */
  protected readonly confirming = signal<string | null>(null);

  /** The key a request is in flight for. One at a time, which is what the disabled buttons enforce. */
  protected readonly busy = signal<string | null>(null);

  /** The service's own sentence about the last refused row operation, verbatim. */
  protected readonly rowRefusal = signal<string | null>(null);

  /** The new-entry form. */
  protected readonly newKey = signal('');
  protected readonly newValue = signal('');
  protected readonly creating = signal(false);
  protected readonly createRefusal = signal<string | null>(null);

  /**
   * What is wrong with the typed key, before it costs a request — and nothing at all while the field
   * is still empty, because "you have not typed anything yet" is not a complaint worth drawing.
   */
  protected readonly newKeyProblem = computed(() => {
    const key = this.newKey().trim();
    return key.length === 0 ? null : keyProblem(key);
  });

  /** Whether the form may be submitted: a key that is present and passes the grammar. */
  protected readonly canCreate = computed(
    () => this.newKey().trim().length > 0 && this.newKeyProblem() === null && !this.creating(),
  );

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

  /** The page's read, re-issued after every write and by the retry button. */
  protected load(): void {
    const application = this.application();
    this.state.set(LOADING);
    this.api.entries(application).then(
      (entries) => this.state.set(ready(entries)),
      (error: unknown) => this.state.set(failed(error)),
    );
  }

  protected startEdit(entry: ConfigurationEntry): void {
    this.rowRefusal.set(null);
    this.confirming.set(null);
    this.editing.set(entry.key);
    this.draft.set(entry.value);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.draft.set('');
    this.rowRefusal.set(null);
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected onNewKey(event: Event): void {
    this.newKey.set((event.target as HTMLInputElement).value);
    this.createRefusal.set(null);
  }

  protected onNewValue(event: Event): void {
    this.newValue.set((event.target as HTMLTextAreaElement).value);
  }

  /**
   * Save an edited value.
   *
   * The empty string is a value and is saved as one — the service keeps it and says so; removing an
   * entry is a DELETE. So there is no "is it blank" guard here, deliberately.
   */
  protected save(key: string): void {
    const application = this.application();
    this.busy.set(key);
    this.rowRefusal.set(null);
    this.api.setEntry(application, key, this.draft()).then(
      () => {
        this.busy.set(null);
        this.editing.set(null);
        this.draft.set('');
        this.load();
      },
      (error: unknown) => {
        this.busy.set(null);
        this.rowRefusal.set(refusalMessage(error));
      },
    );
  }

  /** First press: the row asks. */
  protected askDelete(key: string): void {
    this.rowRefusal.set(null);
    this.editing.set(null);
    this.confirming.set(key);
  }

  protected cancelDelete(): void {
    this.confirming.set(null);
  }

  /** Second press: the row goes. The value survives in the history, which is what makes this safe. */
  protected confirmDelete(key: string): void {
    const application = this.application();
    this.busy.set(key);
    this.rowRefusal.set(null);
    this.api.deleteEntry(application, key).then(
      () => {
        this.busy.set(null);
        this.confirming.set(null);
        this.load();
      },
      (error: unknown) => {
        this.busy.set(null);
        this.rowRefusal.set(refusalMessage(error));
      },
    );
  }

  /**
   * Write a new entry.
   *
   * The same PUT the editor uses, because the service has one write: a key it has not seen answers
   * 201 and a key it has answers 200. Nothing here checks first — a form that asked "does this
   * exist" before writing would race with the store and would still have to handle the answer it
   * got.
   */
  protected create(): void {
    if (!this.canCreate()) {
      return;
    }
    const application = this.application();
    const key = this.newKey().trim();
    this.creating.set(true);
    this.createRefusal.set(null);
    this.api.setEntry(application, key, this.newValue()).then(
      () => {
        this.creating.set(false);
        this.newKey.set('');
        this.newValue.set('');
        this.load();
      },
      (error: unknown) => {
        this.creating.set(false);
        this.createRefusal.set(refusalMessage(error));
      },
    );
  }
}
