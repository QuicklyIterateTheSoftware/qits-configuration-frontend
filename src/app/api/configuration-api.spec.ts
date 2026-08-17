import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigurationApi } from './configuration-api';

/**
 * The three reads, at the addresses qits-configuration serves them at. There are only three: this
 * app writes nothing.
 *
 * The assertions worth having here are the ones that are invisible on screen when they are wrong:
 * **every path is relative**, because a configured origin would leave the edge's session cookie
 * behind and turn every read into a 401; **every call is a GET**, which is what keeps this class a
 * reader; and **a failure reaches the caller whole**, because the page draws the service's own
 * sentence from it.
 */
describe('ConfigurationApi', () => {
  let api: ConfigurationApi;
  let http: HttpTestingController;

  const entry = {
    application: 'qits-docs',
    key: 'env.QITS_REGISTRY',
    value: 'registry.dev.localhost:8080',
    entryClass: 'plain',
    revision: 41,
    updatedAt: '2026-08-17T09:12:00Z',
    updatedBy: 'wohlben',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ConfigurationApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists applications at a relative path and unwraps the envelope', async () => {
    const applications = api.applications();

    const request = http.expectOne('/configuration/api/applications');
    expect(request.request.method).toBe('GET');
    request.flush({ applications: [{ application: 'qits-docs', entries: 3, headRevision: 41 }] });

    expect(await applications).toEqual([
      { application: 'qits-docs', entries: 3, headRevision: 41 },
    ]);
  });

  it('reads an envelope with no list as empty rather than as undefined', async () => {
    const applications = api.applications();
    http.expectOne('/configuration/api/applications').flush({});
    expect(await applications).toEqual([]);
  });

  it('lists one application’s entries', async () => {
    const entries = api.entries('qits-docs');

    const request = http.expectOne('/configuration/api/applications/qits-docs/entries');
    expect(request.request.method).toBe('GET');
    request.flush({ entries: [entry] });

    expect(await entries).toEqual([entry]);
  });

  it('reads the history in the order the service sent it', async () => {
    const history = api.history('qits-docs');

    const request = http.expectOne('/configuration/api/applications/qits-docs/history');
    expect(request.request.method).toBe('GET');
    request.flush({
      revisions: [
        { seq: 41, key: 'env.A', value: null, deleted: true },
        { seq: 40, key: 'env.A', value: 'one', deleted: false },
      ],
    });

    expect((await history).map((revision) => revision.seq)).toEqual([41, 40]);
  });

  it('percent-encodes an application name rather than pasting it into the path', async () => {
    const entries = api.entries('qits docs');

    http.expectOne('/configuration/api/applications/qits%20docs/entries').flush({ entries: [] });

    expect(await entries).toEqual([]);
  });

  it('rejects with the service’s own message rather than swallowing it', async () => {
    const entries = api.entries('qits-docs');

    http
      .expectOne('/configuration/api/applications/qits-docs/entries')
      .flush(
        { message: 'An application name is required' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(entries).rejects.toMatchObject({
      status: 400,
      error: { message: 'An application name is required' },
    });
  });
});
