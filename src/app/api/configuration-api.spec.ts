import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigurationApi } from './configuration-api';

/**
 * The five calls, at the addresses qits-configuration serves them at.
 *
 * The assertions worth having here are the two that are invisible on screen when they are wrong:
 * **every path is relative**, because a configured origin would leave the edge's session cookie
 * behind and turn every read into a 401; and **a key is percent-encoded**, because `mounts[0]` is
 * the ordinary case rather than the exotic one.
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

  it('writes a value as {"value": …} and answers with the stored entry', async () => {
    const written = api.setEntry('qits-docs', 'env.QITS_REGISTRY', 'registry.dev.localhost:8080');

    const request = http.expectOne(
      '/configuration/api/applications/qits-docs/entries/env.QITS_REGISTRY',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ value: 'registry.dev.localhost:8080' });
    request.flush({ entry });

    expect(await written).toEqual(entry);
  });

  it('percent-encodes an indexed key, brackets and all', async () => {
    const written = api.setEntry('qits-docs', 'mounts[0]', '/srv/docs:/work/docs:ro');

    const request = http.expectOne(
      '/configuration/api/applications/qits-docs/entries/mounts%5B0%5D',
    );
    request.flush({ entry: { ...entry, key: 'mounts[0]' } });

    expect((await written).key).toBe('mounts[0]');
  });

  it('sends the empty string as a value rather than dropping the field', async () => {
    const written = api.setEntry('qits-docs', 'env.EMPTY', '');

    const request = http.expectOne('/configuration/api/applications/qits-docs/entries/env.EMPTY');
    expect(request.request.body).toEqual({ value: '' });
    request.flush({ entry: { ...entry, key: 'env.EMPTY', value: '' } });

    expect((await written).value).toBe('');
  });

  it('deletes one entry and expects no body back', async () => {
    const removed = api.deleteEntry('qits-docs', 'mounts[0]');

    const request = http.expectOne(
      '/configuration/api/applications/qits-docs/entries/mounts%5B0%5D',
    );
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(removed).resolves.toBeUndefined();
  });

  it('rejects with the service’s refusal rather than swallowing it', async () => {
    const written = api.setEntry('qits-docs', 'env.9LIVES', 'x');

    http
      .expectOne('/configuration/api/applications/qits-docs/entries/env.9LIVES')
      .flush(
        { message: 'Not a valid environment variable name in key env.9LIVES.' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(written).rejects.toMatchObject({
      status: 400,
      error: { message: 'Not a valid environment variable name in key env.9LIVES.' },
    });
  });
});
