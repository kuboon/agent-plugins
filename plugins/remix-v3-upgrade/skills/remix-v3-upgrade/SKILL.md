---
name: remix-v3-upgrade
description: >-
  Upgrade a Remix v3 project across beta boundaries — currently up to
  `remix@3.0.0-beta.10`. Use this skill whenever bumping any `@remix-run/*`
  dependency, or when code that worked on an earlier beta now fails:
  `No matching version found for @remix-run/static-files-middleware@^0.1.0`
  (that is beta.9, which cannot install), `Type 'Middleware' is not assignable
  to type 'AnyMiddleware'` from `staticFiles()`, links or forms suddenly
  navigating through frames instead of the document, `createDatabase` /
  `DatabaseAdapter` / `createSqliteDatabaseAdapter` no longer exported from
  `@remix-run/data-table`, `resolveFrame` receiving `undefined` for its signal
  or target, `Route.href(params, searchParams)` / `createHref(pattern, params,
  searchParams)` losing its query string, a `ParseError` on a route pattern like
  `/:year-:month`, session cookies unreadable from client JavaScript,
  `createAssetServer({ allow, deny })` being ignored, or `remix-test` not found.
  Covers the package version table for each boundary and every breaking change
  with before/after diffs.
---

# Remix v3 upgrades

Remix v3 ships as ~45 independently versioned `@remix-run/*` packages; the
`remix` meta-package pins a compatible set. Bump the whole set together — the
packages are cross-pinned, and a half-upgraded lockfile produces type errors
that look like your bug rather than a version skew.

## Which release to target

**`remix@3.0.0-beta.10`** is the current `next` tag and the release to land on.

The ladder has holes, so do not walk it one number at a time:

| Release | Status |
| --- | --- |
| `3.0.0-beta.6` | published |
| `3.0.0-beta.7` | **never published** — `npm view` 404s |
| `3.0.0-beta.8` | **never published** — `npm view` 404s |
| `3.0.0-beta.9` | published but **uninstallable** (see below) |
| `3.0.0-beta.10` | published, installs clean |

beta.9 pins `@remix-run/static-files-middleware@^0.1.0`, a renamed package that
was never released — npm has only a `0.0.0` placeholder and the repo has no such
directory. Any install of beta.9 dies at resolution:

```
npm error code ETARGET
npm error notarget No matching version found for @remix-run/static-files-middleware@^0.1.0.
```

beta.10 reverts that rename and stays on the established
`@remix-run/static-middleware`. **Skip beta.9 entirely**; go beta.6 → beta.10.

Two sections follow: [beta.6 → beta.10](#beta6--beta10) is a small, mostly
additive hop. [beta.5 → beta.6](#beta5--beta6) is the large one — do it first if
the project is still on beta.5.

## beta.6 → beta.10

Only **three** packages move. Everything else the meta-package pins is
byte-identical to beta.6, so this is a small diff.

| Package | beta.6 | beta.10 | |
| --- | --- | --- | --- |
| `@remix-run/static-middleware` | 0.4.13 | **0.4.14** | fixes the type trap below |
| `@remix-run/ui` | 0.5.0 | **0.7.0** | behavior change, no API break |
| `@remix-run/cli` | 0.4.0 | 0.5.0 | template only — nothing to do |

### The `staticFiles()` cast is no longer needed

`static-middleware@0.4.14` widens its `@remix-run/fetch-router` dependency to
`^0.21.0`, which is exactly the fix for the duplicate-copy type error the
beta.6 section documents below. Its changelog says so outright: "Fixed
`staticFiles()` middleware types being incompatible with other router middleware
… without package-manager overrides."

Verified both directions with `deno check` on the same source: `0.4.13` still
raises `TS2322: Type 'Middleware' is not assignable to type 'AnyMiddleware'`,
`0.4.14` compiles clean. So delete the workaround:

```diff
- // static-middleware@0.4.13 pins fetch-router ^0.20.1, so Deno/npm resolve a
- // second copy and the Middleware types no longer overlap. Its fetch-router
- // import is type-only, so this is sound. Drop once upstream widens the range.
- const serveStatic = staticFiles(dir) as unknown as Middleware
-
- const router = createRouter({ middleware: [serveStatic] })
+ const router = createRouter({ middleware: [staticFiles(dir)] })
```

Grep for `as unknown as Middleware` and for any npm `overrides` / pnpm
`resolutions` entry pinning `@remix-run/fetch-router` — both exist only to work
around this and should go with it.

### `ui@0.7.0`: `run()` has a default frame resolver

**This is the one behavioral change to think about.** `resolveFrame` is now
optional, and *every* `run()` call — including ones that never passed a resolver
— enables frame reloads and same-origin link and form navigation through the
Navigation API.

If the app supplied a resolver only to fetch frame HTML, delete it:

```diff
  let app = run({
    loadModule,
-   resolveFrame(src, options) {
-     return fetch(src, {
-       headers: { Accept: 'text/html' },
-       signal: options?.signal,
-     })
-   },
  })
```

The default resolver submits the requested method, encoding, and form data, and
rejects non-OK responses. **Keep** a custom `resolveFrame` when the app needs
custom request headers (e.g. an `rmx-frame` marker the server keys on), custom
body encoding, response handling, or error UI — the default has none of that.

The trap is the opposite direction: an app that deliberately had **no** resolver
was getting plain document navigation, and now gets intercepted navigation it
never asked for. If a link or form must stay a document navigation, mark it:

```html
<a href="/download" rmx-document>…</a>
```

Nothing here fails to compile, so exercise link and form navigation in a real
browser after the bump.

### The rest

- `ui@0.6.0` — `resolveClientEntry()` may return module preload hrefs so client
  entries can preload their browser module graphs. Purely additive.
- `cli@0.5.0` — the `remix new` template now emits client-entry preloads. It
  changes scaffolding for *new* projects only; there is nothing to migrate in an
  existing one.

Everything in the beta.6 section below still applies as written — no API
introduced there was changed again by beta.10.

## beta.5 → beta.6

Skip this section if the project is already on beta.6.

### Version table

Bump these; the ones in **bold** carry breaking changes documented below.

| Package | beta.5 | beta.6 |
| --- | --- | --- |
| **`@remix-run/ui`** | 0.4.0 | **0.5.0** |
| **`@remix-run/fetch-router`** | 0.20.1 | **0.21.0** |
| **`@remix-run/route-pattern`** | 0.23.0 | **0.24.0** |
| **`@remix-run/data-table`** | 0.3.0 | **0.4.0** |
| **`@remix-run/data-table-sqlite`** | 0.5.1 | **0.6.0** |
| **`@remix-run/data-table-mysql`** | 0.4.0 | **0.5.0** |
| **`@remix-run/data-table-postgres`** | 0.4.0 | **0.5.0** |
| **`@remix-run/session-middleware`** | 0.3.4 | **0.4.0** |
| **`@remix-run/cookie`** | 0.5.4 | **0.6.0** |
| **`@remix-run/assets`** | 0.4.4 | **0.5.0** |
| **`@remix-run/cli`** | 0.3.4 | **0.4.0** |
| **`@remix-run/test`** | 0.5.0 | **0.6.0** |
| `@remix-run/node-fetch-server` | 0.14.0 | 0.14.1 |
| `@remix-run/fetch-proxy` | 0.8.4 | 0.8.5 |
| `@remix-run/multipart-parser` | 0.16.3 | 0.16.4 |
| `@remix-run/form-data-parser` | 0.17.4 | 0.17.5 |
| `@remix-run/response` | 0.3.7 | 0.3.8 |
| `@remix-run/auth` | 0.2.6 | 0.2.7 |
| `@remix-run/auth-middleware` | 0.2.4 | 0.2.5 |
| `@remix-run/cors-middleware` | 0.1.7 | 0.1.8 |
| `@remix-run/cop-middleware` | 0.1.7 | 0.1.8 |
| `@remix-run/csrf-middleware` | 0.1.7 | 0.1.8 |
| `@remix-run/logger-middleware` | 0.3.4 | 0.3.5 |
| `@remix-run/render-middleware` | 0.1.4 | 0.1.5 |
| `@remix-run/form-data-middleware` | 0.3.4 | 0.3.5 |
| `@remix-run/async-context-middleware` | 0.3.4 | 0.3.5 |
| `@remix-run/compression-middleware` | 0.1.12 | 0.1.13 |
| `@remix-run/method-override-middleware` | 0.1.12 | 0.1.13 |
| `@remix-run/ui-hmr` | — | 0.1.0 (new) |
| `@remix-run/node-hmr` | — | 0.1.0 (new) |

Unchanged across the boundary — leave them alone: `assert` 0.3.0, `session`
0.4.2, `static-middleware` 0.4.13, `html-template` 0.3.1, `headers` 0.21.1,
`fs` 0.4.6, `mime` 0.4.2, `lazy-file` 5.0.6, `data-schema` 0.3.0,
`file-storage` 0.13.7, `file-storage-s3` 0.1.4, `session-storage-redis` 0.1.1,
`session-storage-memcache` 0.1.2, `tar-parser` 0.7.1, `terminal` 0.1.1,
`node-tsx` 0.1.1.

Most of the patch bumps are pure "bumped `@remix-run/*` dependencies" churn
tracking `fetch-router@0.21.0`. Three carry real fixes:
`node-fetch-server@0.14.1` now hands request handlers **native `Request`
instances** instead of lazy look-alikes (so `new Request(request, init)` works);
`fetch-proxy@0.8.5` stops forwarding `Accept-Encoding` to targets and strips
`Content-Encoding`/`Transfer-Encoding` from proxied responses;
`response@0.3.8` adds `Vary: Accept-Encoding` to identity responses from
`compressResponse()`.

### Breaking change 1 — `Route.href()` and `createHref()` take an options object

`fetch-router@0.21.0` and `route-pattern@0.24.0`. The trailing positional
`searchParams` argument became an options object. A call left in the old shape
still type-checks in loose spots and silently drops the query string.

```diff
- route.href({ id }, { page: '2' })
+ route.href({ id }, { searchParams: { page: '2' } })

- createHref('/posts/:id', { id }, new URLSearchParams({ page: '2' }))
+ createHref('/posts/:id', { id }, { searchParams: new URLSearchParams({ page: '2' }) })
```

`searchParams` accepts both a typed plain object and a `URLSearchParams`
(repeated entries keep their order). Both functions also gained a `baseURL`
option: with it, same-origin targets come back as path-relative references while
cross-origin targets stay absolute. Matchers accept relative URL strings when
`match()`/`matchAll()` are given an absolute `baseURL`.

Zero-argument `route.href()` and param-only `route.href({ id })` are unaffected —
if that is all the project uses, there is nothing to change here.

### Breaking change 2 — route params are delimiter-bounded

`route-pattern@0.24.0` replaced the backtracking matcher with a bounded state
compiler. Pathname params possessively capture through hyphens but stop at a raw
`/` or `.`, which keeps UUIDs intact, and `createHref()` percent-encodes dots in
param values so they round-trip.

The cost is that **two params in one segment no longer split**:

```diff
- route('/reports/:year-:month')   // ParseError on beta.6
+ route('/reports/:date')          // one inseparable param, split it yourself
+ route('/reports/:year/:month')   // or give each capture its own segment
```

Also now a `ParseError` rather than a silent match: adjacent wildcards, empty
optional groups, a param followed by non-delimiter text, and ambiguous adjacent
optional capture schemas. Repeated capture names stay legal — the last
participating capture wins in `params`, and `paramsMeta` keeps every capture in
source order.

Matchers take `MatcherOptions.limits` for pattern size, matcher size, and match
work; exceeding one throws `MatcherResourceError` with structured details.
Static pattern text is decoded during matching, while raw and percent-encoded
`/` and `.` keep distinct structural meaning.

Audit every route pattern in the project for a hyphen or dot between two params.
Plain static dots (`/.well-known/jwks.json`) are fine.

### Breaking change 3 — browser `resolveFrame(src, options)`

`ui@0.5.0`. The browser frame resolver passed to `run()` took positional
`signal` and `target`; it now takes a single options object. **This one fails
silently**: the old signature keeps compiling, `signal` receives an object
instead of an `AbortSignal`, and `target` is always `undefined`, so named-frame
routing and abort-on-navigate quietly stop working.

```diff
  const app = run({
    loadModule,
-   async resolveFrame(src: string, signal?: AbortSignal, target?: string) {
+   async resolveFrame(src, options) {
+     const { signal, target } = options ?? {}
      const headers = new Headers({ accept: 'text/html', 'rmx-frame': '1' })
      if (target) headers.set('rmx-target', target)
      const response = await fetch(src, { headers, signal })
      return response.body ?? (await response.text())
    },
  })
```

`ResolveFrameOptions` carries `target`, `signal`, and — for the new form
enhancement below — `formData`, `method`, and `encType`.

The **server-side** `resolveFrame` passed to `renderToStream()` is a different
callback and did **not** change; it is still
`(src, target?, context?) => string | ReadableStream`. Do not "fix" it to match.

#### What else changed in `ui@0.5.0`

Additive, but worth knowing while you are in this code:

- Resolvers may now return a `Response`. Its body streams into the frame, and
  when a top-frame navigation follows a redirect the final response URL replaces
  the current navigation entry and becomes the frame's canonical `src` without a
  second load.
- Same-origin **forms progressively enhance into frame navigations** whenever
  `run({ resolveFrame })` is configured. Native constraint validation runs
  first; submissions target the top frame unless `rmx-target` names one;
  `rmx-document` opts back into a document navigation. For non-GET submissions
  the resolver receives the browser's native `FormData` plus `method` and
  `encType`, and stays responsible for encoding the request and any `_method`
  convention. If the app already hand-wires form submission, check for
  double-submits.
- `rmx-history="push|replace"` on anchors and forms overrides the history
  behavior of enhanced navigations; `link(href, { history })` emits it.
- `rmx-preserve-dom` tells the reconciler to keep a matching element's current
  attributes and children across reloads — the escape hatch for custom elements
  and other client-owned subtrees.
- `run()` returns `frames` on the app object, mirroring `handle.frames`.
- New `@remix-run/ui/dev/refresh` entry point for tooling that reconciles
  mounted roots after component modules change.
- Built-in styled components now use `light-dark(...)` for their internal
  surfaces, text, borders and focus rings, so they finally render correctly
  under a dark color scheme. Check custom overrides that assumed light values.
- A pile of frame/hydration reconciliation fixes: `css()` on subtype hosts like
  `<select>`, `<` escaping in server-rendered `css()` output, frames hanging
  when a nested `Frame` marker moves out of a region, stale frame bounds when
  navigating between differing `Frame` layouts, and top-frame reloads using the
  previous URL after a named-frame navigation.

### Breaking change 4 — data-table has no adapters any more

`data-table@0.4.0` plus the dialect packages. The adapter indirection is gone:
`Database` is now the canonical public class, dialect packages **extend** it and
hand a private `DatabaseDriver` to `super()`, and applications construct a
concrete database directly.

```diff
- import { createDatabase } from '@remix-run/data-table'
- import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'
- const db = createDatabase(createSqliteDatabaseAdapter({ filename: './app.db' }))
+ import { createSqliteDatabase } from '@remix-run/data-table-sqlite'
+ const db = createSqliteDatabase({ filename: './app.db' })
```

`createPostgresDatabase()` and `createMysqlDatabase()` replace their adapter
pairs the same way. Renames across the three dialect packages:
`SqliteDatabaseAdapterConfig` → `SqliteDatabaseConfig`, the old `SqliteDatabase`
*client interface* → `SqliteDatabaseClient`, `MysqlDatabaseAdapterOptions` →
`MysqlDatabaseOptions`, `PostgresDatabaseAdapterOptions` →
`PostgresDatabaseOptions`.

Removed from `@remix-run/data-table`: `createDatabase()`, the built-in adapter
exports, the `db.adapter` escape hatch, `DatabaseAdapter`,
`AdapterCapabilities`, `AdapterCapabilityOverrides`, `createMigrationRunner()`,
`MigrationRunner`, `MigrationRunnerOptions`, `GetMigrations`, and `MigrateOptions`.

Renames: `DatabaseAdapter` → `DatabaseDriver`, `AdapterCapabilities` →
`DatabaseCapabilities`, `DataTableAdapterError` → `DataTableDatabaseError`,
`MigrateOptions` → `DatabaseMigrateOptions` (with
`DatabaseMigrationStatusOptions` and `DatabaseResetOptions` for the sibling
methods).

Individual operation types are **no longer exported**. Derive them from the
union instead:

```diff
- import type { SelectOperation, InsertOperation } from '@remix-run/data-table'
+ import type { DataManipulationOperation } from '@remix-run/data-table'
+ type SelectOperation = Extract<DataManipulationOperation, { kind: 'select' }>
```

`Database` gained `wipe()`, `migrate()`, `migrationStatus()`, `reset()`, and
`close()`. `migrate()` supports both directions, mutually exclusive `to` and
`step` bounds, dry runs, and a custom journal table. `loadSeed()` from
`remix/data-table/migrations/node` turns a SQL file into a `Seed` function.
`runRemixDb()` from `remix/data-table/cli` now takes resolved `Database`,
`Migrations`, and `Seed` values in a command-discriminated options union.

#### Writing a third-party dialect package

If you maintain your own integration, the shape is now: implement
`DatabaseDriver`, then subclass `Database` and pass the driver to `super()`.
Export the subclass and a `createXDatabase()` factory — not the driver.

```ts
import { Database, type DatabaseOptions, type DatabaseDriver } from '@remix-run/data-table'

class MyDriver implements DatabaseDriver<'sqlite'> { /* ... */ }

export class MyDatabase extends Database<'sqlite'> {
  constructor(client: MyClient, options?: DatabaseOptions) {
    super(new MyDriver(client), options)
  }
}

export function createMyDatabase(client: MyClient, options?: DatabaseOptions): MyDatabase {
  return new MyDatabase(client, options)
}
```

`DatabaseDriver` requires two members the old `DatabaseAdapter` did not:

- `wipe(): Promise<void>` — destructively recreate the database. Throw a clear
  error when the driver was handed a caller-owned client and cannot do this,
  rather than guessing at a database name.
- `close(): void | Promise<void>` — release owned handles, **idempotent**. A
  supplied client stays caller-owned; only close what the driver opened.

`compileSql()` is not part of the driver contract — keep it as an internal
detail. `withMigrationLock?()` is optional and only worth implementing when the
engine has a real lock; leave `capabilities.migrationLock: false` otherwise.

### Breaking change 5 — session cookies default to `HttpOnly`

`session-middleware@0.4.0`. Omitting `httpOnly` used to mean "off"; it now means
**on**. Client-side JavaScript that reads the session cookie stops working after
the bump, and the failure shows up at runtime in the browser, not at build time.

```diff
  createSessionMiddleware({
    cookie: {
      name: 'session',
+     httpOnly: false, // only if client JS genuinely needs to read it
    },
  })
```

The middleware warns when the protection is explicitly disabled. Prefer leaving
the default on and moving whatever the client needed onto a separate,
non-sensitive cookie or a fetch endpoint.

`cookie@0.6.0` underneath: `Cookie.httpOnly` now returns `boolean | undefined`
instead of defaulting to `false`, which is what lets the middleware distinguish
"omitted" from "explicitly off". Code comparing `cookie.httpOnly === false`
needs to handle `undefined`.

### Breaking change 6 — custom cookie `encode`/`decode` own the value

`cookie@0.6.0`. Custom `encode` output used to be wrapped in Remix's default
base64 representation, and custom `decode` received the value after that wrapper
was stripped. Now custom `encode` output is signed and serialized **as-is**, and
custom `decode` receives the **unsigned raw** cookie value.

If you supplied both, they were symmetric and stay symmetric — but anything that
relied on the implicit base64 layer (a raw-JSON `encode`, say, or a value with
`;` or `,` in it) must now do its own encoding. The default encoder/decoder is
unchanged when no custom functions are given. Cookies written by beta.5 with
custom codecs will not decode on beta.6; plan a rotation or a dual-read.

### Breaking change 7 — `createAssetServer()` file rules renamed

`assets@0.5.0`. `allow`/`deny` became `allowFiles`/`denyFiles`. The old keys are
just ignored, so the server silently falls back to its defaults — this can
**expose files** the `deny` list was protecting. Grep for it explicitly.

```diff
  export const assetServer = createAssetServer({
-   allow: ['app/routes.ts', 'app/**/public/**'],
-   deny: ['app/**/*.test.*'],
+   allowFiles: ['app/routes.ts', 'app/**/public/**'],
+   denyFiles: ['app/**/*.test.*'],
  })
```

Additive in the same release: `allowPackages` for package-level access control
(`allowPackages: ['remix']` serves a package and its dependencies), `hmr`
support that provides an `import.meta.hot` API to JS assets, and
`scripts.loaders` for post-processing compiled JavaScript with Node-compatible
synchronous loaders.

### Breaking change 8 — the CLI and test runner

`cli@0.4.0` and `test@0.6.0`, only relevant if the project uses the Remix CLI.

- The standalone **`remix-test` executable is gone**. Use `remix test`.
  ```diff
  - remix-test --type server --concurrency 1
  + remix test --type server --concurrency 1
  ```
- `runRemixTest()` from `@remix-run/test/cli` takes **typed runner options**,
  not an `argv` array, and no longer reads `process.argv` or renders help:
  ```diff
    let exitCode = await runRemixTest({
  -   argv: ['--type', 'server', '--concurrency', '1'],
      cwd: process.cwd(),
  +   type: ['server'],
  +   concurrency: 1,
    })
  ```
  `getRemixTestHelpText()` was removed; `remix test -h` prints it.
  `remixTestPools` is now exported, and `coverage.enabled` accepts `'inherit'`.
- **`remix-test.config.ts` / `.js` discovery was removed**, along with the
  `config` path option. Static test settings move under `remix.json#test`.
- A new optional **`remix.json`** (parsed as JSONC) configures database
  adapters, migrations, seeds, every `remix test` setting, and `remix doctor`
  strict mode. Relative paths and globs resolve from the config file's
  directory; explicit flags and positional arguments win. `--config <path>` is
  now the global config selector — its old test-specific meaning is gone.
  Negative flags (`--no-strict`, `--no-watch`, `--no-coverage`, `--no-quiet`,
  `--no-browser.open`, `--no-browser.echo`) override configured `true` values.
- New `remix db` commands wipe, migrate, inspect, seed, and reset the app
  database, driven by `remix.json`. `remix db wipe` and `remix db reset` require
  `--force`.
- `remix test` now defaults `NODE_ENV` to `test` when unset, and `.only`
  filtering applies across the whole test module rather than the nearest
  `describe`. New `--only` and `--quiet`/`-q` flags.
- New projects scaffold an `npm run hmr` command and `hmr.ts` runner, with the
  browser runtime entry at `app/actions/public/entry.ts` and browser-reachable
  source in colocated `public/` directories.

### Trap — `static-middleware` still excludes `fetch-router@0.21.0`

> **Fixed in beta.10.** This whole section applies only while a project sits on
> beta.6. `static-middleware@0.4.14` widens the range, so the right move is to
> go to beta.10 and delete the cast — see
> [The `staticFiles()` cast is no longer needed](#the-staticfiles-cast-is-no-longer-needed).
> Read on only if you are staying on beta.6 for now.

`@remix-run/static-middleware@0.4.13` is the latest release at beta.6 and was
deliberately *not* bumped — but it still declares
`"@remix-run/fetch-router": "^0.20.1"`, and `^0.20.1` excludes `0.21.0`. The
`remix` meta-package pins both, so any project using `staticFiles()` alongside
`fetch-router@0.21.0` resolves **two copies** of fetch-router and gets:

```
TS2322: Type 'Middleware' is not assignable to type 'AnyMiddleware'.
  Property '#private' in type 'RequestContext' refers to a different member
  that cannot be accessed from within type 'RequestContext'.
```

`RequestContext` is branded with a private field, so the two `Middleware` types
are nominally distinct even though they are structurally identical.

**This is a type-level problem only.** static-middleware imports fetch-router
with `import type` and never calls into it at runtime, so the duplicate is
inert. Re-type the middleware at the one call site and leave a note to remove
it:

```ts
import { createRouter, type Middleware } from '@remix-run/fetch-router'
import { staticFiles } from '@remix-run/static-middleware'

// static-middleware@0.4.13 pins fetch-router ^0.20.1, so Deno/npm resolve a
// second copy and the Middleware types no longer overlap. Its fetch-router
// import is type-only, so this is sound. Drop once upstream widens the range.
const serveStatic = staticFiles(dir) as unknown as Middleware

const router = createRouter({ middleware: [serveStatic] })
```

`as Middleware` alone is rejected ("neither type sufficiently overlaps") — the
private-field brand forces the double cast.

Do not try to fix this with npm `overrides`: **Deno ignores `overrides` in
`package.json`**, even with `nodeModulesDir` enabled, so the duplicate survives.
Deno's `links` (formerly `patch`) only redirects to local source trees, not to a
different registry version.

The same shape will appear for any middleware package left at a beta.5 version
while its peers move — check the resolved tree, not just the manifest, when a
`Middleware` assignment suddenly stops type-checking.

### New: HMR packages

`@remix-run/ui-hmr@0.1.0` and `@remix-run/node-hmr@0.1.0` are new and purely
opt-in. Use `remix/ui-hmr/node` as a Node import hook for server modules and
`uiHmr()` from `remix/ui-hmr/assets` alongside `remix/assets` for browser
modules; `node-hmr` supervises a Node app in development with an
`import.meta.hot` API and optional parent-owned browser HMR coordination through
`browserHmrChannel`. Nothing to migrate — skip unless you want HMR.

## Doing the upgrade

In a Deno workspace the versions live in each member's `deno.json` `imports`,
not in one root manifest. Bump every member, then relock:

```bash
# after editing the version ranges in each packages/*/deno.json and app deno.json
deno install                    # relock
deno check && deno lint && deno fmt --check
deno test -P
```

`deno outdated --update --latest` across the workspace works too, but it will
also pull unrelated majors — read its plan before accepting. If Deno refuses a
version with "newer than the specified minimum dependency date", that is
`minimumDependencyAge`, not a bad range; see the `deno-min-dep-age` skill.

Pin the meta-package to an explicit release (`npm:remix@3.0.0-beta.10`). A bare
`npm:remix` resolves `latest`, which is **Remix v2** — v3 lives on the `next`
tag.

Order that avoids chasing type errors:

1. Bump every `@remix-run/*` range in one pass, lockfile included. Land on
   beta.10; never stop at beta.9, which cannot resolve.
2. Fix the data-table construction sites first — they are the loudest.
3. Then the browser `resolveFrame` signature, which the compiler will *not*
   flag.
4. Then grep for the silent ones: `.href(` with two arguments, `createHref(`
   with three, `allow:`/`deny:` in `createAssetServer`, `httpOnly`, custom
   cookie `encode`/`decode`, and route patterns with two params in a segment.
5. Delete the `staticFiles()` cast and any `fetch-router` override once on
   beta.10.
6. Type-check, lint, test, and exercise link, form, and frame navigation in a
   browser — the `resolveFrame` change, the form enhancement, and beta.10's
   default resolver do not show up in unit tests.

## Checklist

### Landing on beta.10

- [ ] `remix` pinned to `3.0.0-beta.10` explicitly — not bare `npm:remix`
      (that is v2), and not beta.9 (uninstallable).
- [ ] `static-middleware` at 0.4.14, the `as unknown as Middleware` cast
      deleted, and any `overrides`/`resolutions` pin on `fetch-router` removed.
- [ ] `resolveFrame` either deleted (if it only fetched HTML) or kept
      deliberately for custom headers/encoding/error UI.
- [ ] Links and forms that must stay document navigations marked `rmx-document`,
      and navigation exercised in a real browser.

### From beta.5

- [ ] Every `@remix-run/*` range bumped per the table; lockfile regenerated.
- [ ] `createDatabase`/`create*DatabaseAdapter` replaced with `create*Database()`.
- [ ] `DatabaseAdapter`/`AdapterCapabilities`/`DataTableAdapterError` renamed;
      operation types derived from `DataManipulationOperation`.
- [ ] Custom drivers implement `wipe()` and idempotent `close()`, and subclass
      `Database`.
- [ ] Browser `resolveFrame` reads `options.signal` / `options.target`; server
      `resolveFrame` left alone.
- [ ] No `.href(params, searchParams)` or `createHref(pattern, params, sp)`
      positional calls remain.
- [ ] No route pattern puts two params in one delimiter-bounded segment.
- [ ] `httpOnly` decided explicitly wherever client JS reads a session cookie.
- [ ] `createAssetServer` uses `allowFiles`/`denyFiles`.
- [ ] `remix-test` invocations and `remix-test.config.*` migrated to `remix test`
      and `remix.json#test`.
- [ ] No duplicate `fetch-router` in the resolved tree — or, if staying on
      beta.6, the `staticFiles()` call site re-typed with a note.
- [ ] `deno check` / `deno lint` / `deno fmt --check` / tests pass.
- [ ] Frame navigation and form submission exercised in a real browser.
