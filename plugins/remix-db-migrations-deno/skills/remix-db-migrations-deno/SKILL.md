---
name: remix-db-migrations-deno
description: >-
  Database migrations for a Deno + Remix v3 (`@remix-run/data-table`) project
  are run by the Remix CLI's `remix db` commands (migrate / status / seed /
  reset / wipe), configured through a `remix.json` `db` section, with migrations
  as `YYYYMMDDHHmmss_name/up.sql` + `down.sql` directories. Use this skill
  whenever adding or changing a data-table table or column, creating a
  migration, seeding or resetting a dev database, wiring a `deno task` for
  migrations, or debugging `remix db` under Deno — including "Failed resolving
  binary export … did not have a bin property", `Could not find package 'pg'`,
  `Invalid migration directory name`, `Database configuration is missing from
  remix.json`, or `remix db` refusing to roll back. Also covers Turso / libSQL
  via `@kuboon/remix-data-table-sqlite-turso`, which `remix.json` cannot
  describe (`Expected one of: sqlite, postgres, mysql at db.adapter.type`) and
  which therefore needs a hand-written `runRemixDb()` entry point. Covers the
  Deno-specific setup that the Node-oriented docs do not.
---

# `remix db` migrations from Deno

Verified against `remix@3.0.0-beta.6` (`@remix-run/cli@0.4.0`,
`@remix-run/data-table@0.4.0`, `@remix-run/data-table-sqlite@0.6.0`) on
**Deno 2.9.4**. The whole `remix db` command set runs under Deno unmodified —
the friction is entirely in how you invoke it and which packages Deno resolves.

## Setup

Three files. `deno.json` pins the CLI and exposes it as a task:

```jsonc
{
  "nodeModulesDir": "auto",
  "imports": {
    "remix": "npm:remix@3.0.0-beta.6",
    "@remix-run/data-table": "npm:@remix-run/data-table@^0.4.0",
    "@remix-run/data-table-sqlite": "npm:@remix-run/data-table-sqlite@^0.6.0"
  },
  "tasks": { "db": "remix db" }
}
```

`nodeModulesDir: "auto"` + `deno install` puts the `remix` executable in
`node_modules/.bin`, which `deno task` has on its PATH — so the version is
pinned **once**, in `imports`. Without a node_modules directory the task must
spell it out: `"db": "deno run -A npm:remix@3.0.0-beta.6 db"` (that works too,
straight from the global cache).

`remix.json` at the project root configures the database (JSONC — comments are
fine):

```jsonc
{
  "db": {
    // sqlite for local dev; APP_DB wins when set
    "adapter": { "type": "sqlite", "filename": { "env": "APP_DB", "default": "./data/app.db" } },
    "migrations": { "directory": "./db/migrations" },
    "seed": "./db/seed.sql"
  }
}
```

And the migrations themselves are **directories of plain SQL**:

```
db/migrations/
  20260101000000_create_users/
    up.sql          # required
    down.sql        # optional — omit for an irreversible migration
  20260102000000_add_email/
    up.sql
```

`YYYYMMDDHHmmss_name` — exactly 14 digits, an underscore, then the name. Any
other basename is a hard error (`Invalid migration directory name "oops_bad".
Expected format YYYYMMDDHHmmss_name`), and it fails the whole command, not just
that entry. **There is no generator**: no `remix db new`, no schema diffing
against your `table()` definitions. Create the directory and write the SQL by
hand, keeping it in step with the data-table schema in code.

## The commands

```bash
deno task db migrate                       # apply pending migrations
deno task db migrate --to 20260101000000   # stop after this one
deno task db status                        # id, name, applied|pending
deno task db seed                          # run the SQL seed file
deno task db reset --force                 # wipe + migrate + seed
deno task db wipe --force                  # destroy the database
```

`wipe` and `reset` refuse to run without `--force` and print the help text
instead. Flags: `--migrations <path>`, `--seed <path>`, `--journal-table <name>`,
`--connection-env <name>`, `--to <migration>` (migrate only).

`migrate` prints `applied <id>_<name>` per migration, or `no pending
migrations`. Applied migrations are journaled in a table named
`data_table_migrations` unless `journalTable` says otherwise.

### `remix db` cannot roll back

`--to` only **bounds forward progress**. Pointing it at an already-applied
migration prints `no pending migrations` and changes nothing — it does not
revert. The CLI never passes a direction, and there is no `--down` / `--step`
flag; `down.sql` is reachable only from code or from `reset`.

So when you need a rollback in a Deno project, write it yourself — this is
verified working:

```ts
// db/rollback.ts — deno run -A db/rollback.ts
import { createSqliteDatabase } from "@remix-run/data-table-sqlite";
import { loadMigrations } from "remix/data-table/migrations/node";

const db = createSqliteDatabase({ filename: "./data/app.db" });
const migrations = await loadMigrations("./db/migrations");
const result = await db.migrate(migrations, { direction: "down", step: 1 });
console.log("reverted:", result.reverted.map((m) => `${m.id}_${m.name}`));
await db.close();
```

`db.migrate()` takes `direction: "up" | "down"` (default `up`), mutually
exclusive `to` / `step` bounds, and `dryRun` — all of which the CLI leaves on
the table. `loadMigrations()` / `loadSeed()` are named `…/migrations/node` but
use only `node:fs` and `node:path`, so they run in Deno as-is.

## Turso / libSQL: the CLI cannot drive it

`@kuboon/remix-data-table-sqlite-turso` backs data-table with an **async**
libSQL client (`@libsql/client`) — remote Turso, embedded replicas, or a local
`file:` database. The stock `data-table-sqlite` database is synchronous and
cannot drive that client, so this package is the Turso path.

`remix db` is not. The CLI builds its database from a fixed `remix.json`
adapter list, and a fourth type is simply rejected:

```
Error [RMX_INVALID_CONFIG] Invalid Remix configuration
remix.json:1:32: Expected one of: sqlite, postgres, mysql at db.adapter.type
```

There is no plugin hook. So on Turso you **own the entry point** — which is
fine, because `runRemixDb()` is the same function the CLI calls, exported for
exactly this. Verified working end to end (`status`, `migrate`, `seed`,
`reset`, `wipe`, and a `direction: "down"` rollback) on Deno 2.9.4:

```jsonc
// deno.json
{
  "nodeModulesDir": "auto",
  "imports": {
    "remix": "npm:remix@3.0.0-beta.6",
    "@remix-run/data-table": "npm:@remix-run/data-table@^0.4.0",
    "@kuboon/remix-data-table-sqlite-turso": "jsr:@kuboon/remix-data-table-sqlite-turso@^0.2.0",
    "@libsql/client": "npm:@libsql/client@^0.17.4",
    "@std/path": "jsr:@std/path@^1"
  },
  "tasks": { "db": "deno run -A db/cli.ts" }
}
```

```ts
// db/cli.ts — deno task db migrate | status | seed | reset --force | wipe --force
import { createClient } from "@libsql/client";
import { createTursoDatabase } from "@kuboon/remix-data-table-sqlite-turso";
import { runRemixDb } from "remix/data-table/cli";
import { loadMigrations, loadSeed } from "remix/data-table/migrations/node";
import { dirname } from "@std/path";

const [command, ...flags] = Deno.args;

// The CLI's --force guard does not exist here. Re-add it, or you will wipe a
// database by pressing Up in your shell.
if ((command === "wipe" || command === "reset") && !flags.includes("--force")) {
  console.error(`remix db ${command} requires --force`);
  Deno.exit(1);
}

const url = Deno.env.get("TURSO_DATABASE_URL") ?? "file:data/app.db";
// libSQL will not create the parent directory; the remix CLI did that for you.
if (url.startsWith("file:")) await Deno.mkdir(dirname(url.slice(5)), { recursive: true });

const client = createClient({ url, authToken: Deno.env.get("TURSO_AUTH_TOKEN") });
const db = createTursoDatabase(client);

try {
  const migrations = await loadMigrations("./db/migrations");
  const to = flags.includes("--to") ? flags[flags.indexOf("--to") + 1] : undefined;

  if (command === "wipe") await runRemixDb({ command, db });
  else if (command === "seed") {
    await runRemixDb({ command, db, seed: await loadSeed("./db/seed.sql") });
  } else if (command === "migrate") await runRemixDb({ command, db, migrations, to });
  else if (command === "status") await runRemixDb({ command, db, migrations });
  else if (command === "reset") {
    await runRemixDb({ command, db, migrations, seed: await loadSeed("./db/seed.sql") });
  } else {
    console.error(`unknown command: ${command}`);
    Deno.exit(1);
  }
} finally {
  // db.close() is a documented no-op — the libSQL client is caller-owned.
  client.close();
}
```

Migration directories, `up.sql`/`down.sql`, the `data_table_migrations` journal,
and the printed output are all identical to the CLI's — only the wiring differs.
Rollback is the same `db.migrate(migrations, { direction: "down", step: 1 })`
recipe as above, with `createTursoDatabase(client)` in place of
`createSqliteDatabase(...)`.

What you take on by owning the entry point:

- **`remix.json` is not read at all.** Connection, migrations directory, and
  seed path live in the script (read them from env, as above). Keep a `db`
  section only if some other tool wants it — nothing here consults it.
- **No flag parsing.** `--force`, `--to`, `--migrations`, `--seed`,
  `--journal-table`, `--connection-env` exist only if you write them. Start with
  `--force`; it is the one whose absence is destructive.
- **No parent-directory creation.** The CLI `mkdir`s a sqlite file's directory;
  libSQL does not, and fails with
  `ConnectionFailed("Unable to open connection to local database data/app.db: 14")`.
- **`db.close()` is a no-op**, by design — the client is caller-owned, and
  `@libsql/client` has several entry points only your app can choose between.
  Close the client yourself.
- **`db.wipe()` drops every user table, view, index, and trigger** rather than
  unlinking a file, since the target may be remote. `reset()` therefore behaves
  normally.

Do **not** work around the config limitation by pointing `remix db`'s `sqlite`
adapter at the same local `file:` database. It appears to work — same dialect,
same journal table — but it only ever works for the local file, so staging and
production still need the script, and you end up with two migration paths that
can disagree. Write the entry point once and use it everywhere.

## Deno traps

**`npm:remix` without a version is Remix v2.** On npm, `remix@latest` is
`2.17.5`; v3 sits behind the `next` tag. An unversioned invocation resolves the
v2 package, which has no `bin`, and dies with a message that looks like a Deno
bug:

```
error: Failed resolving binary export. '…/node_modules/.deno/remix@2.17.5/node_modules/remix/package.json'
did not have a bin property with a string or non-empty object value
```

Always write `npm:remix@3.0.0-beta.6`, or go through the `imports` entry.

**SQLite needs nothing; Postgres and MySQL need a driver.** The sqlite database
is built on `process.getBuiltinModule('node:sqlite')`, which Deno provides — no
extra dependency, no `--allow-ffi`. The other two dialects load `pg` / `mysql2`
as *optional* peer dependencies, which Deno does not pull in for you:

```
Could not find package 'pg' from referrer
file:///…/@remix-run/data-table-postgres/dist/lib/driver.js
```

Add the driver to `imports` explicitly (`"pg": "npm:pg@^8.16.3"` or
`"mysql2": "npm:mysql2@^3.15.3"`).

**Permissions.** `-A` is the pragmatic choice for a local task. The minimum for
sqlite is `--allow-read --allow-write --allow-env --allow-sys`; leaving out
`--allow-sys` fails deep inside Node fs compat with `Requires sys access to
"uid"`. Network-backed dialects add `--allow-net`.

**Two path bases.** Paths inside `remix.json` resolve against the **config
file's** directory; `--migrations`, `--seed`, and a sqlite `--connection-env`
value resolve against the **current working directory**. So `deno task db
status` gives the same answer from a subdirectory (the CLI walks up to find
`remix.json`), but a relative `--migrations` does not.

**Renaming `journalTable` orphans the history.** The journal is where "applied"
lives; point the CLI at a different table and every migration reads as `pending`
again. The next `migrate` then replays them into a database that already has the
objects:

```
Error [RMX_INTERNAL_ERROR] Unexpected Remix CLI error
table users already exists in create table users (…)
```

Choose the journal table before the first migration, or migrate the journal
rows yourself.

**A missing `db` section is a clear error**, not a silent default:
`Database configuration is missing from …/remix.json.` Add it rather than
passing every path as a flag.

## Adapter configuration

Any string value below may instead be `{ "env": "VAR", "default": "…" }` — an
env var that is set but empty falls back to `default`.

```jsonc
{ "type": "sqlite",   "filename": "./data/app.db", "foreignKeys": true, "busyTimeout": 5000 }
{ "type": "postgres", "connectionString": { "env": "DATABASE_URL" }, "maintenanceDatabase": "postgres", "template": "template0" }
{ "type": "mysql",    "uri": { "env": "MYSQL_URL" }, "characterSet": "utf8mb4", "collation": "utf8mb4_unicode_ci" }
```

The parent directory of a sqlite `filename` is created automatically, so
`./data/app.db` works on a fresh checkout with no `data/` directory.

`--connection-env <name>` overrides the connection for a single invocation
without touching `remix.json` — handy for pointing a migration at a staging
database from CI.

## Checklist

- [ ] `remix` pinned to an explicit `3.0.0-beta.x` version (never bare `npm:remix`).
- [ ] `remix.json` has a `db.adapter`, and `db.migrations.directory` for
      migrate/status/reset.
- [ ] Migration directories named `YYYYMMDDHHmmss_name` with an `up.sql`.
- [ ] `down.sql` written whenever the change is reversible — the CLI won't use
      it, but `reset` and a rollback script will.
- [ ] Non-sqlite dialects have `pg` / `mysql2` in `deno.json` imports.
- [ ] On Turso/libSQL: a `db/cli.ts` calling `runRemixDb()` is the single
      migration entry point, with its own `--force` guard, its own parent-dir
      creation for `file:` URLs, and `client.close()` in a `finally`.
- [ ] `deno task db migrate` and `deno task db status` both run clean from a
      fresh checkout.
