import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { QITS_API_BASE } from './api-base';
import type {
  ApplicationSummary,
  ConfigurationEntry,
  ConfigurationRevision,
  ListApplicationsResponse,
  ListEntriesResponse,
  ListHistoryResponse,
  SetEntryResponse,
} from './dto';

/**
 * Everything this app reads and writes, and it speaks to exactly one upstream: qits-configuration,
 * through the edge, at `/configuration/api`.
 *
 * **This class writes, which makes it the first of its kind among the explorers** — the sibling
 * SPAs read a store somebody else fills. Two consequences are deliberate here:
 *
 * - **Every call is one-shot.** `firstValueFrom` unwraps the observable immediately, and there is no
 *   `httpResource` anywhere: a resource that re-fetched would re-issue a PUT or a DELETE, and the
 *   reads are re-issued by the pages after a write rather than on a schedule, so what is on screen
 *   is what the store answered after the change rather than what a cache remembers.
 * - **Failures are thrown, not described.** An `HttpErrorResponse` reaching a caller still holds the
 *   service's `{"message": …}` body, and that message is the one thing a refused write must show —
 *   qits-configuration names what is wrong with the value it refused, and paraphrasing it here would
 *   throw away the only sentence that tells an operator what to type instead. `ui/loadable.ts` is
 *   where that body is read, in one place.
 *
 * `HttpClient` on the fetch backend rather than bare `fetch()` buys two things: `HttpTestingController`,
 * which is the whole basis of this repository's specs, and a call that goes through `window.fetch`,
 * where the platform's browser telemetry can see it.
 *
 * **No `credentials` option anywhere, and that is the code that makes these calls correct.** Every
 * request is same-origin behind the edge, which sends the session cookie by default; the only value
 * worth setting would be the default, and the only value worth fearing (`omit`) would make every
 * call 401 at once.
 *
 * **The resolved read and the import route are deliberately absent.** `…/resolved` is the deployer's
 * own read — a flat, fully-prefixed property map it layers verbatim — and `POST …/import` is the
 * bootstrap's bulk seeding. Neither is a screen, and adding them here would invite one.
 */
@Injectable({ providedIn: 'root' })
export class ConfigurationApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(QITS_API_BASE);

  /** Every application this service holds configuration for, with entry counts and head revisions. */
  async applications(): Promise<readonly ApplicationSummary[]> {
    const response = await firstValueFrom(
      this.http.get<ListApplicationsResponse>(`${this.base}/configuration/api/applications`),
    );
    return response.applications ?? [];
  }

  /**
   * One application's current entries.
   *
   * An application nobody has configured is not a 404 here — the service answers an empty list — so
   * an empty array means "nothing stored", never "no such application".
   */
  async entries(application: string): Promise<readonly ConfigurationEntry[]> {
    const response = await firstValueFrom(
      this.http.get<ListEntriesResponse>(`${this.applicationUrl(application)}/entries`),
    );
    return response.entries ?? [];
  }

  /**
   * One application's write history, newest first. Deletions are in it, with a null value.
   *
   * The order is the SERVICE's and is not re-sorted here: `seq` is the append-only log's own
   * sequence, and a client that sorted by timestamp instead would disagree with it the moment two
   * writes share an instant.
   */
  async history(application: string): Promise<readonly ConfigurationRevision[]> {
    const response = await firstValueFrom(
      this.http.get<ListHistoryResponse>(`${this.applicationUrl(application)}/history`),
    );
    return response.revisions ?? [];
  }

  /**
   * Set one entry's value — 201 the first time the key is seen, 200 afterwards, and no revision at
   * all when the value is byte-for-byte what is already stored.
   *
   * The answer is the stored entry, so the caller can draw what the store now holds rather than what
   * it just typed. That difference is not cosmetic: the service trims nothing and rejects an absent
   * value, and a screen showing the request instead of the response would hide either.
   */
  async setEntry(application: string, key: string, value: string): Promise<ConfigurationEntry> {
    const response = await firstValueFrom(
      this.http.put<SetEntryResponse>(this.entryUrl(application, key), { value }),
    );
    return response.entry;
  }

  /**
   * Remove one entry. 204, or 404 when it is not there.
   *
   * The value is not lost — the service appends a deleted revision — which is what makes the
   * confirmation on the page a courtesy rather than the last line of defence, and what the history
   * page is for.
   */
  async deleteEntry(application: string, key: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(this.entryUrl(application, key)));
  }

  private applicationUrl(application: string): string {
    return `${this.base}/configuration/api/applications/${encodeURIComponent(application)}`;
  }

  /**
   * **The key is percent-encoded, and `mounts[0]` is why.** Square brackets are legal in a path
   * segment by RFC 3986's letter and are mangled by enough of what sits between a browser and a
   * JAX-RS route that spelling them raw would be a bet. `encodeURIComponent` also keeps a key
   * holding a slash — which the grammar forbids, so it can only arrive by a service change — from
   * silently becoming two path segments and hitting a different route.
   */
  private entryUrl(application: string, key: string): string {
    return `${this.applicationUrl(application)}/entries/${encodeURIComponent(key)}`;
  }
}
