import { HttpErrorResponse } from '@angular/common/http';
import { describeError, refusalMessage, statusOf } from './loadable';

/**
 * Two readers of one error body, and the difference between them is the point.
 *
 * A failed READ is reported with its status, because "503" and "404" send an operator to different
 * places. A refused WRITE is reported with the service's sentence and nothing else: that sentence
 * names which part of the grammar the key missed, and it is the only thing on the page that says
 * what to type instead. Bolting a status code onto the front of it, or paraphrasing it, would make
 * the one useful string on the screen slightly wrong.
 */
describe('describeError', () => {
  it('prefers the service’s message and keeps the status in front of it', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { message: 'An application name is required' },
    });
    expect(describeError(error)).toBe('400 An application name is required');
  });

  it('says unreachable when the request never got an answer', () => {
    expect(describeError(new HttpErrorResponse({ status: 0 }))).toBe('the service is unreachable');
    expect(statusOf(new HttpErrorResponse({ status: 0 }))).toBe(0);
  });

  it('falls back to the status alone when the body carries no message', () => {
    expect(describeError(new HttpErrorResponse({ status: 503, error: 'gateway said no' }))).toBe(
      '503',
    );
  });
});

describe('refusalMessage', () => {
  it('quotes the service verbatim, with no status bolted on', () => {
    const refusal =
      'Not a valid key: volumes[0]. A key is `env.<VAR>` or one of `mounts[i]`, ' +
      '`publishes[i]`, `groups[i]`, `aliases[i]`.';
    const error = new HttpErrorResponse({ status: 400, error: { message: refusal } });
    expect(refusalMessage(error)).toBe(refusal);
  });

  it('says the status only when there is no sentence to quote', () => {
    expect(refusalMessage(new HttpErrorResponse({ status: 401 }))).toBe(
      'The service refused this with HTTP 401.',
    );
  });

  it('says unreachable rather than quoting an HTTP code that does not exist', () => {
    expect(refusalMessage(new HttpErrorResponse({ status: 0 }))).toBe(
      'The service is unreachable.',
    );
  });

  it('reads an empty message as no message at all', () => {
    const error = new HttpErrorResponse({ status: 400, error: { message: '' } });
    expect(refusalMessage(error)).toBe('The service refused this with HTTP 400.');
  });
});
