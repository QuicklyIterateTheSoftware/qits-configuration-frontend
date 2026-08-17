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
} from './dto';

/**
 * Everything this app reads, and it speaks to exactly one upstream: qits-configuration, through the
 * edge, at `/configuration/api`.
 *
 * **THERE IS NO WRITE HERE, and its absence is the design.** The entries are system state: the
 * platform's own processes set them through the API, each write part of a larger operation with
 * more to do afterwards. This app is a reader of that state, so it holds no PUT and no DELETE —
 * nothing for a screen to reach for.
 *
 * Two consequences of the reads are deliberate:
 *
 * - **Every call is one-shot.** `firstValueFrom` unwraps the observable immediately, and there is no
 *   `httpResource` anywhere: the pages re-issue their own read from a retry button rather than on a
 *   schedule, so what is on screen is what the store answered rather than what a cache remembers.
 * - **Failures are thrown, not described.** An `HttpErrorResponse` reaching a caller still holds the
 *   service's `{"message": …}` body, and `ui/loadable.ts` is where that body is read, in one place.
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

  private applicationUrl(application: string): string {
    return `${this.base}/configuration/api/applications/${encodeURIComponent(application)}`;
  }
}
