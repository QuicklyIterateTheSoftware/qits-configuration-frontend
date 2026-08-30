# qits-configuration-frontend

The deployment configuration's frontend: what each application on this platform will be deployed
with, and the screen an operator reads it on. Served by qits-configuration itself at the **root of
its own host** (`configuration.<env>.<domain>`) through Quinoa. Three routes, all of them inside the
platform chrome.

- **`/`** — every application this service holds entries for, with its entry count and head
  revision.
- **`/applications/<app>`** — one application's entries, as they are stored now.
- **`/applications/<app>/history`** — every write to that application, newest first, deletions
  included.

**Each is addressable twice.** The platform's URL grammar puts the same page under
`/<projectSlug>/<category>/<repoName>/…`, and the scoped form resolves to the same component:
`app.routes.ts` mounts one list of children under both, guarded on the category. With a repository
in scope the listing is a doorway rather than a destination — it replaces the address with
`applications/<repoName>` once the listing proves that application exists, and says plainly that the
repository has none when it does not.

**THIS APPLICATION READS AND NEVER WRITES.** The entries are system state: the platform's own
processes set them through the API — a deployment, a bootstrap import, a service that learns its own
address — and each of those writes is part of a larger operation with more to do afterwards. A hand
edit in a browser lands in the middle of that with none of the rest of it, so no screen here offers
one, and the API class holds no PUT and no DELETE to reach for. The entries page says so in a
sentence, because a table with no buttons otherwise reads as a table whose buttons failed to load.

**What this replaces is a file nobody could see.** Deployment environment used to be a hand-edited
properties file on the deployer's config volume, snapshotted at boot: an edit was inert until the
deployer was forced to reload, and a live `service update --env-add` fix was reverted by the next
deploy. qits-configuration owns those entries now, versions every write, and serves them at the
spelling the deployer already reads. These three pages are the first time that state has had a face.

**Every value is drawn whole.** A cell here holds a mount specification, an alias list, a URL with a
query string — occasionally something very long — and an operator reads it to answer "what will this
deployment run with". So nothing truncates: the value column wraps. A screen that clipped at some
width would say something false about a deployment while looking entirely normal.

**A write reaches a container on its next deployment, and the pages say so.** The deployer pulls an
application's entries once per deployment and records the revision it deployed with; nothing here
pushes. Someone who assumed otherwise would go looking for a bug in the deployer.

**A failed read is drawn where the table would be.** The heading, the breadcrumb and the note stay,
and the error carries the service's own message with its status in front of it, plus a retry.

**This application handles no token.** Every call is a same-origin path under `/configuration/api`,
and the edge's session is what authenticates it — the SPA neither holds a credential nor knows one
exists. That is also why no request here sets a `credentials` option: same-origin sends the cookie
by default, and the only value worth setting would be the default.

**The deployer's own two routes are deliberately not screens.** `…/resolved` is the flat, fully
prefixed property map the deployer layers verbatim, and `POST …/import` is the bootstrap's bulk
seeding. Neither belongs in a browser, so neither is in this app's API class to be reached for.

## How it is served

qits-configuration-service carries this repository as a git submodule at `service/src/main/webui` —
Quinoa's
ui-dir — and builds it during `mvn package`, serving the bundle at the root of its host. The root is
spelled here as `baseHref` in `angular.json` and there as `quarkus.quinoa.ui-root-path`, both `/`;
the two move together, and a disagreement serves a page whose every asset 404s. This repository
ships no container image of its own.

`/configuration` is the MACHINE segment now — the API and the framework root — and both spellings of
it answer 404 rather than this page. That is what `quarkus.quinoa.ignored-path-prefixes` is for, and
it retires the old trailing-slash wart along with it.

## Development server

```bash
ng serve
```

Then open `http://localhost:4200/`. `proxy.conf.json` forwards `/configuration/api`,
`/configuration/q`, `/projects/api` and `/main-navigation` to the edge on `localhost:8080`, because
`ng serve` puts nothing in front. In a deployment every call is a same-origin path on this service's
own host, which the edge path-routes to whichever service owns the prefix.

## Running the checks

```bash
npm run lint && npm test && npm run build
```

The same three, in the same order, are what `.config/qits/ci-post-receive.yml` runs on every push.
Note what that pipeline installs from: the npm proxy behind it is qits-platform-mirror, and the
`@qits` scope comes from qits-artifacts — so a run here cannot be green while either service is
down. Their deploys are taken alone, with the CI queue empty.

Installing on a developer machine needs a credential, and it is not in this repository. Every read
through the edge authenticates, so both registries answer 401 without one; `.npmrc` here carries the
routing only, and the `_auth` line comes from your own `~/.npmrc`, minted for your commissioned
workstation client. CI takes both the addresses and the credential from the step environment.

## Building

```bash
ng build
```

The bundle lands in `dist/qits-spa-configuration/browser`, which is the path
`quarkus.quinoa.build-dir` names on the service side. Three lazy chunks come out beside the initial
one, one per page — that is the routing, visible in the output.

## Running unit tests

```bash
ng test
```

Vitest on jsdom — no browser, which is what lets CI run them.
