# QitsSpaConfiguration

The deployment configuration's frontend: what each application on this platform will be deployed
with, and the screen an operator changes it on. Served by qits-configuration itself at
`/configuration/` through Quinoa. Three routes, all of them inside the platform chrome.

- **`/configuration/`** — every application this service holds entries for, with its entry count and
  head revision.
- **`/configuration/applications/<app>`** — one application's entries: read them, edit one, delete
  one, add one.
- **`/configuration/applications/<app>/history`** — every write to that application, newest first,
  deletions included.

**What this replaces is a file nobody could see.** Deployment environment used to be a hand-edited
properties file on the deployer's config volume, snapshotted at boot: an edit was inert until the
deployer was forced to reload, and a live `service update --env-add` fix was reverted by the next
deploy. qits-configuration owns those entries now, versions every write, and serves them at the
spelling the deployer already reads. These three pages are the first time that state has had a face.

**Every value is drawn whole.** A cell here holds a mount specification, an alias list, a URL with a
query string — occasionally something very long — and an operator reads it to answer "what will this
deployment run with". So nothing truncates: the value column wraps, and the editor is a textarea.
A screen that clipped at some width would say something false about a deployment while looking
entirely normal.

**A write reaches a container on its next deployment, and the pages say so.** The deployer pulls an
application's entries once per deployment and records the revision it deployed with; nothing here
pushes. Someone who assumed otherwise would go looking for a bug in the deployer.

**Deleting asks first, in the row.** `window.confirm` renders outside the page and jsdom implements
none of it, so a confirmation written that way could never be proven by a test. The two-press form
is a state on the row, and the suite presses both.

**A refused key shows the service's own sentence, verbatim.** qits-configuration names which part of
the grammar a key missed — "After `env.` it must start with a letter or an underscore…" — and that
sentence is the only thing on screen that says what to type instead. The client-side grammar check
in `src/app/api/key-grammar.ts` exists to save the round trip, never to replace the answer: it may
refuse too little, and it must never refuse what the service would take.

**This application handles no token.** Every call is a same-origin path under `/configuration/api`,
and the edge's session is what authenticates it — the SPA neither holds a credential nor knows one
exists. That is also why no request here sets a `credentials` option: same-origin sends the cookie
by default, and the only value worth setting would be the default.

**The deployer's own two routes are deliberately not screens.** `…/resolved` is the flat, fully
prefixed property map the deployer layers verbatim, and `POST …/import` is the bootstrap's bulk
seeding. Neither belongs in a browser, so neither is in this app's API class to be reached for.

## How it is served

qits-configuration carries this repository as a git submodule at `service/src/main/webui` — Quinoa's
ui-dir — and builds it during `mvn package`, serving the bundle at `/configuration/`. The segment is
spelled here as `baseHref` in `angular.json` and there as `quarkus.quinoa.ui-root-path`; the two move
together, and a disagreement serves a page whose every asset 404s. This repository ships no
container image of its own.

Note the known wart, which is every client's alike: bare `/configuration` (no trailing slash) is a
404. `/configuration/` works.

## Development server

```bash
ng serve
```

Then open `http://localhost:4200/`. `proxy.conf.json` forwards `/configuration/api` and
`/configuration/q` to a gateway on `localhost:8080`, because `ng serve` puts no gateway in front. In
a deployment every call is a same-origin path behind the real one.

The platform chrome asks the gateway for `/main-navigation`, which `ng serve` does not proxy — so
the sidebar renders "Navigation unavailable". That is the intended degraded state, not a fault.

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
