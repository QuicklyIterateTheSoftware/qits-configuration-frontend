import { HttpErrorResponse } from '@angular/common/http';

/**
 * What one page — or one panel of a page — knows about the thing it is showing.
 *
 * Copied from spa-events rather than shared: there is no place to put it yet — @qits/ui-components
 * carries presentational components, not application types.
 */
export type Loadable<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly value: T }
  | { readonly kind: 'error'; readonly status: number; readonly message: string };

/** Never requested. */
export const IDLE: Loadable<never> = { kind: 'idle' };

/** Requested, nothing back yet. */
export const LOADING: Loadable<never> = { kind: 'loading' };

/** Arrived. */
export function ready<T>(value: T): Loadable<T> {
  return { kind: 'ready', value };
}

/** Did not arrive, and why — the status is kept because a 404 is a different screen from a 503. */
export function failed(error: unknown): Loadable<never> {
  return { kind: 'error', status: statusOf(error), message: describeError(error) };
}

/** The HTTP status, or 0 for anything that never reached a server. */
export function statusOf(error: unknown): number {
  return error instanceof HttpErrorResponse ? error.status : 0;
}

/**
 * The shortest true sentence about a failed READ. The services answer errors in a `{"message": …}`
 * envelope, so that message is preferred when there is one; a status of 0 means the request never
 * got an answer at all, which reads as "unreachable" rather than as an HTTP code that does not
 * exist.
 */
export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'the service is unreachable';
    }
    const message = serverMessage(error.error);
    return message ? `${error.status} ${message}` : `${error.status}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * WHAT A REFUSED WRITE SAYS, and the one place this app treats an error body as content rather than
 * as a diagnostic.
 *
 * qits-configuration refuses a key by naming exactly which part of the grammar it missed — "After
 * `env.` it must start with a letter or an underscore…" — and that sentence is the only thing on
 * screen that tells an operator what to type instead. So it is shown VERBATIM: no status code
 * bolted on the front, no rewording, no "the request failed" wrapper around it. A 400 whose body
 * carries no message is the one case with nothing to quote, and then the status is all there is.
 *
 * The status is still worth keeping out of the sentence rather than out of the page: a 400 is the
 * service disagreeing with what was typed, while a 401 or a 503 is not about the key at all.
 */
export function refusalMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'The service is unreachable.';
    }
    const message = serverMessage(error.error);
    return message ?? `The service refused this with HTTP ${error.status}.`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** The `message` field of an error body, when the body is one. */
function serverMessage(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message: unknown }).message;
    return typeof message === 'string' && message.length > 0 ? message : null;
  }
  return null;
}
