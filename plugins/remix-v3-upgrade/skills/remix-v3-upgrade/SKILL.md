---
name: remix-v3-upgrade
description: >-
  Upgrade a Remix 3.x project (3.0.0 stable and later) to a newer 3.x release —
  written for apps derived from kuboon/deno-remix-tmpl and the @remix-kbn/*
  packages they consume. Use this skill whenever bumping any `@remix-run/*` or
  `@remix-kbn/*` dependency, or when something that worked before a bump now
  misbehaves: `@remix-run/ui` refusing to move past its 0.x minor because the
  `remix` meta-package does not pin it, two copies of `@remix-run/component` in
  a lockfile pulled in by a JSR package's stale range, `json()` columns read
  back as strings or written twice-encoded, `timestamp()` filters that stop
  matching on Turso, an upsert writing values into the wrong columns in a
  hand-copied SQL compiler, `Expected 2 arguments, but got 3` from
  `createScheduler()`, form handlers firing at hydration with
  `isTrusted === false`, or a render error that used to answer 200 now
  answering 500. Covers where to read the real changelogs (npm tarballs ship
  none), the lockfile duplicate check, and the per-release notes from 3.3.0 on.
---

# Remix 3.x upgrades

Remix 3 is stable and follows semver. The `remix` meta-package pins a set of
~50 `@remix-run/*` packages, each versioned on its own (`component` 1.x,
`data-table` 1.x, `fetch-router` 1.x, …). A 3.x minor is additive at the API
level; what breaks is **behaviour** and **custom code that re-implements a
contract** (a data-table adapter, a vendored compiler). The compiler and the
test suite usually stay green through both.

Nothing before 3.0.0 is covered here. Every project this skill is for is
already on 3.x.

## 1. Find the target set

```bash
npm view remix dist-tags --json          # use `latest`
npm view remix@<version> dependencies --json
```

- **Use `latest`.** The `next` dist-tag was left behind on `3.0.0-rc.5` and
  points at an old release candidate. A bare `npm:remix` resolves 3.x now.
- The `dependencies` of the meta-package are the floors to land on, e.g. for
  3.3.0: `component ^1.3.0`, `data-table ^1.1.0`, `fetch-router ^1.0.1`,
  `render-middleware ^1.1.1`, `spa ^1.0.3`, `cop-middleware ^1.0.1`,
  `csp-middleware ^1.0.1`.
- **`@remix-run/ui` is not in that set.** It is a separate 0.x package of
  styled components and mixins (`animateLayout()`, `animateExit()`, `toast`,
  `form`) that depends on `component`. Because it is 0.x, `^0.13.1` does not
  admit 0.14.0, so `deno outdated --compatible` never moves it, and a stale
  `ui` can hold a second, older `component` in the graph. Check it by hand:

  ```bash
  npm view @remix-run/ui version
  npm view @remix-run/ui@latest dependencies --json   # which component it wants
  ```

## 2. Read the changelogs — they are not in the tarball

npm tarballs of `@remix-run/*` ship no `CHANGELOG.md`. Read them from the repo:

```bash
for p in remix component data-table fetch-router ui render-middleware; do
  curl -fsSL -o CHANGELOG-$p.md \
    https://raw.githubusercontent.com/remix-run/remix/main/packages/$p/CHANGELOG.md
done
```

Start with `remix`'s own changelog: it rolls every package's change up into one
release entry. Then open the package changelog for anything the project
touches. Read the **patch** entries too — in 3.x that is where the behaviour
changes live.

If the project carries code copied from an upstream package (a SQL compiler, a
driver), also fetch upstream's **source** at the old and the new version and
diff them: `npm pack @remix-run/<pkg>@<version>` and unpack each into its own
directory.

## 3. Bump and relock

In a Deno workspace the ranges live in each member's `deno.json`. Edit the
floors to the target set, then:

```bash
deno install
deno task check && deno task test && deno task build
```

If Deno refuses a fresh release with "newer than the specified minimum
dependency date", that is `minimumDependencyAge` (24 h by default). Projects
from deno-remix-tmpl already exclude `npm:@remix-run/*`, `jsr:@remix-kbn/*`
and `jsr:@kuboon/*`; anywhere else follow the `deno-min-dep-age` skill. Never
lower the global age or pass `--min-dep-age 0`.

### Check the lockfile for a second copy

A duplicate of a package with module-level state (`component` above all, also
`fetch-router` — its `RequestContext` is nominally typed) splits the runtime
with no error. `deno outdated` cannot see it when the stale range sits inside a
JSR dependency's manifest. Read the lock:

```bash
python3 - <<'PY'
import json
from collections import Counter
lock = json.load(open("deno.lock"))
names = [k.split("_")[0] for k in lock.get("npm", {}) if k.startswith("@remix-run/")]
dups = {n: c for n, c in Counter(k.rsplit("@", 1)[0] for k in names).items() if c > 1}
print("duplicates:", dups or "none")
for name, entry in sorted(lock.get("jsr", {}).items()):
    for dep in entry.get("dependencies", []):
        if "@remix-run/" in dep:
            print(f"{name} -> {dep}")
PY
```

The `jsr` lines say which of your own packages asks for which range. 1.x
ranges (`^1.0.0`) admit every later 1.x, so a JSR package normally needs no
release for a Remix minor; `@remix-run/ui@^0.x` ranges are the exception.

## 4. If you publish packages (@remix-kbn/*)

- **Raise a floor only when the code needs the newer version**, and release
  only the packages whose code or floor moved. A `^1.x` range that already
  admits the new set needs nothing; bumping it just to match forces consumers
  through a release with no change.
- A package whose range excludes the new set (any `@remix-run/ui@^0.x`) must
  move and publish **before** the apps that consume it are bumped.
- In kuboon/remix-kbn a merge to `main` publishes to JSR by itself
  (`release-jsr.yaml`): stop at the PR.

## 5. Custom data-table adapters

A driver for `@remix-run/data-table` (Turso, D1, anything not first-party)
implements a contract that minors extend. Missing a new optional hook still
compiles and passes the adapter's own tests, and the rows simply come back in a
different shape than on the first-party adapters.

When `data-table` moves:

1. Read `DatabaseDriver` in the new `src/lib/driver.ts` for new members.
2. Diff the first-party driver that speaks your dialect
   (`data-table-sqlite` for any SQLite-family driver) between the old and new
   version, and port what changed — value binding, `decodeValue`, helpers.
3. If you vendored its SQL compiler, replace it with the new upstream one
   rather than patching your copy. Copies drift: the copy in remix-kbn still
   interpolated `order by` directions and carried an upsert binding bug that
   upstream had fixed, and its own tests had the buggy output as the expected
   value.
4. Add a round-trip test against a real client (in-memory libSQL, a local D1)
   for every column type the hook touches. Compiler snapshot tests cannot catch
   a missing `decodeValue`.

## Release notes

### 3.2 → 3.3.0

Pinned set: `component@1.3.0`, `data-table@1.1.0` (+ `-sqlite` / `-mysql`
1.1.0), `fetch-router@1.0.1`, `render-middleware@1.1.1`, `spa@1.0.3`,
`test@1.2.0`, `headers@1.1.1`, `node-fetch-server@1.0.1`, the middleware set at
1.0.x patches. Outside the set: **`ui@0.14.0`**, which requires
`component ^1.3.0`.

For a deno-remix-tmpl app the dependency change is
([deno-remix-tmpl#36](https://github.com/kuboon/deno-remix-tmpl/pull/36)):

```diff
-"@remix-kbn/data-table-sqlite-turso": "jsr:@remix-kbn/data-table-sqlite-turso@^0.6.0",
-"@remix-run/component": "npm:@remix-run/component@^1.2.0",
-"@remix-run/cop-middleware": "npm:@remix-run/cop-middleware@^1.0.0",
-"@remix-run/csp-middleware": "npm:@remix-run/csp-middleware@^1.0.0",
-"@remix-run/data-table": "npm:@remix-run/data-table@^1.0.0",
-"@remix-run/fetch-router": "npm:@remix-run/fetch-router@^1.0.0",
-"@remix-run/render-middleware": "npm:@remix-run/render-middleware@^1.1.0",
-"@remix-run/spa": "npm:@remix-run/spa@^1.0.2",
-"@remix-run/ui": "npm:@remix-run/ui@^0.13.1",
+"@remix-kbn/data-table-sqlite-turso": "jsr:@remix-kbn/data-table-sqlite-turso@^0.7.0",
+"@remix-run/component": "npm:@remix-run/component@^1.3.0",
+"@remix-run/cop-middleware": "npm:@remix-run/cop-middleware@^1.0.1",
+"@remix-run/csp-middleware": "npm:@remix-run/csp-middleware@^1.0.1",
+"@remix-run/data-table": "npm:@remix-run/data-table@^1.1.0",
+"@remix-run/fetch-router": "npm:@remix-run/fetch-router@^1.0.1",
+"@remix-run/render-middleware": "npm:@remix-run/render-middleware@^1.1.1",
+"@remix-run/spa": "npm:@remix-run/spa@^1.0.3",
+"@remix-run/ui": "npm:@remix-run/ui@^0.14.0",
```

plus `fetch-router ^1.0.1` in `packages/remix-dpop-session-middleware`. The
template itself needed no code change.

#### `data-table@1.1.0` — values change shape (silent)

- **The query builder converts values by column type.** `json()` values are
  written with `JSON.stringify()` by `data-table` itself — strings included —
  and the driver's new optional `decodeValue(value, column)` hook turns stored
  values back into `json` objects, `boolean`s and `Date`s for table queries and
  `returning` rows. `db.exec()` results are not decoded.
- Code that stored **pre-serialized JSON** through the query builder now
  double-encodes it. Pass the value:

  ```diff
  -await db.create(settings, { id: 1, data: JSON.stringify({ theme: 'dark' }) })
  +await db.create(settings, { id: 1, data: { theme: 'dark' } })
  ```

- **Arrays interpolated into `sql` expand** into `(?, ?, …)`, one parameter per
  item; an empty array throws. To bind an array as one value (a Postgres
  array), wrap it: `rawSql('?', [ids])`.
- Nested `sql` composition only accepts fragments made by `sql` / `rawSql`
  from the **same loaded copy** of the package. A hand-built
  `{ text, values }` object is now bound as a parameter value instead of being
  spliced in — another reason to keep one copy in the lock.
- Every adapter binds each parameter as exactly one value. The first-party
  SQLite driver binds `Date` as UTC text in `current_timestamp` format
  (`2026-11-20 01:02:03.456`, whole seconds without `.000`) and rejects other
  non-byte objects.
- `sql-helpers` gained shared clause compilers (`compileWhereClause()`,
  `compileLimitOffsetClause()`, `compileReturningClause()`, …) driven by a
  `SqlCompileContext` with `quoteIdentifier` and `bindValue`. `limit` /
  `offset` are bound as parameters (`limit ? offset ?`).

#### `@remix-kbn/data-table-sqlite-turso@0.7.0` / `data-table-d1@0.2.0`

The remix-kbn adapters for `data-table@1.1.0`. They implement `decodeValue`,
bind `Date` the way `data-table-sqlite` does, and use upstream's 1.1.0
compiler, which also fixes **an upsert with a separate `update` object binding
its values one column off**. An app upgrading from turso 0.6.x:

- `json()` / `boolean()` / `timestamp()` columns now read back as objects /
  booleans / `Date`s. Look for code that `JSON.parse`d them, compared to `1`,
  or wrapped them in `new Date()`.
- **Existing `timestamp()` rows need converting** if you filter or sort on
  them. libSQL used to bind a `Date` as epoch milliseconds (stored as `real`);
  0.7.0 writes text. Old rows still read back as numbers, but a `Date` filter
  no longer matches them. Convert once:

  ```sql
  update my_table set seen_at = case when seen_at % 1000 = 0
      then strftime('%Y-%m-%d %H:%M:%S', seen_at / 1000.0, 'unixepoch')
      else strftime('%Y-%m-%d %H:%M:%f', seen_at / 1000.0, 'unixepoch') end
    where typeof(seen_at) in ('integer', 'real');
  ```

  `typeof()` reports `real`, not `integer`, for what libSQL wrote: a filter on
  `'integer'` alone converts nothing.

- The template's `/api/turso` sample uses only `text` / `integer` columns and
  is unaffected.

#### `component@1.3.0`

- `createScheduler()` lost its unused third argument: a three-argument call is
  now `Expected 2 arguments, but got 3`. Drop the argument.
- **Form controls keep pre-hydration edits** and replay them as `input` /
  `change` events once the handlers attach, with `event.isTrusted === false`,
  at hydration time. A handler that submits, saves or fetches on `input` now
  runs as soon as the control hydrates if the visitor (or the browser's form
  restoration) touched it first. `autocomplete="off"` opts a control out of
  restoration.
- `<select>` initialises as `value`, then the initial `defaultValue`, then
  option `selected`, on server, mount and hydration alike. Multiple selects
  take arrays.
- Additive: `defaultResolveFrame` with `{ fetch, commit }` overrides, the
  `rmx:navigation` event, `<Frame loading="lazy">`, `updateUrl()`,
  `defaultPrefetch`, `prefetch(anchor)`. A custom `resolveFrame` that only
  re-implemented the default to change headers or caching can shrink to
  `defaultResolveFrame({ fetch })`.

#### `ui@0.14.0`

- `animateExit()` starts its animation synchronously in `beforeRemove` instead
  of in a microtask. Only a custom mixin that reads computed styles or
  `getAnimations()` in `beforeRemove` and expects the exit not to have started
  is affected.
- Additive: per-property `transition` timing for `animateEntrance()` /
  `animateExit()`, `@remix-run/ui/toast`, experimental `@remix-run/ui/form`.

#### Server-side behaviour

- `render-middleware@1.1.1`: an error thrown while rendering the **shell** now
  rejects `router.fetch()` so the server answers `500`. It used to answer `200`
  with a broken page. A test that asserted a 200 for a throwing page will fail.
- `fetch-router@1.0.1`: for a `HEAD` served by a `GET` route, middleware sees
  the full `GET` response and the body is stripped afterwards. Late responses
  to aborted requests have their bodies cancelled.
- `node-fetch-server@1.0.1`: an invalid host (path, userinfo, whitespace in
  `Host` / `:authority` / a trusted `X-Forwarded-Host`) makes
  `createRequest()` throw and the listener answer `400`.
- `headers@1.1.1`: `Vary` keeps names as first given (`Cookie`, not `cookie`;
  Safari only varies on the capitalised spelling) and `Accept-*` weights pick
  the most specific match per RFC 9110.

## Verifying

- `deno task check && deno task test && deno task build`, and `build:cf` for a
  Cloudflare app.
- Exercise hydration, a frame navigation and a form in a real browser. The
  template's `deno task test:browser` downloads lightpanda from
  `get.lightpanda.io`; where that host is unreachable, drive the pre-installed
  Chromium with Playwright against `deno serve` instead.
- **Compare against `main` before blaming the upgrade.** The template logs
  `Hydration mismatch: text mismatch 0 N` on `/hydration` on `main` too. Run
  the same script against a `git worktree` of `main` on a second port and diff
  the results.
- After a dependency bump in the template, check that `/blog` still renders
  its article bodies (`CLAUDE.md` asks for it).

## Checklist

- [ ] Target taken from `npm view remix dist-tags` → `latest`, not `next`.
- [ ] Every `@remix-run/*` floor moved to the meta-package's set, and
      `@remix-run/ui` checked separately (`npm view @remix-run/ui version`).
- [ ] `remix` changelog read, plus the package changelogs for what the project
      imports, patch entries included.
- [ ] `deno install`, then **no duplicate `@remix-run/*` in `deno.lock`**, with
      the `jsr` section read for your own packages' ranges.
- [ ] Your own packages: floors raised only where the code needs them;
      only those released; merge waits for the human (it publishes).
- [ ] Custom data-table drivers diffed against the first-party driver and
      compiler of the new version; round-trip tests per column type.
- [ ] Turso apps on `timestamp()` columns: old rows converted.
- [ ] No pre-serialized JSON written to `json()` columns; no empty array
      interpolated into `sql`.
- [ ] `check` / `test` / `build` (and `build:cf`) green; hydration, a frame
      navigation and a form exercised in a browser, compared with `main`.
