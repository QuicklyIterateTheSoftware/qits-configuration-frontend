/**
 * The wire, written down. Every type here is the shape qits-configuration sends on
 * `/configuration/api`, and nothing here is this application's own idea. This app only reads, so
 * only the read shapes are here.
 *
 * **`entryClass`, not `class`.** The column is `class` and the service says why it cannot spell it
 * that way on the wire — a Java record component cannot be named after a keyword. The name travels
 * as it is rather than being renamed here, so a field in a browser's network tab and a field in this
 * file are the same string.
 *
 * **A revision's `value` is null exactly when `deleted` is true.** An entry may hold the empty
 * string, so a null value alone could not tell a deletion from a blanking — which is why the flag
 * exists and why nothing here reads the null as "removed" on its own.
 */

/** One application in the listing: how many entries it holds, and how far its history has run. */
export interface ApplicationSummary {
  readonly application: string;
  readonly entries: number;
  readonly headRevision: number;
}

/** One current entry, as the API hands it back. */
export interface ConfigurationEntry {
  readonly application: string;
  readonly key: string;
  readonly value: string;
  readonly entryClass: string;
  readonly revision: number;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

/** One recorded write, from the append-only log. */
export interface ConfigurationRevision {
  readonly seq: number;
  readonly application: string;
  readonly key: string;
  readonly value: string | null;
  readonly deleted: boolean;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

/** `GET /configuration/api/applications` */
export interface ListApplicationsResponse {
  readonly applications: readonly ApplicationSummary[];
}

/** `GET /configuration/api/applications/{app}/entries` */
export interface ListEntriesResponse {
  readonly entries: readonly ConfigurationEntry[];
}

/** `GET /configuration/api/applications/{app}/history` — newest first, deletions included. */
export interface ListHistoryResponse {
  readonly revisions: readonly ConfigurationRevision[];
}
