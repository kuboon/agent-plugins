---
name: cloudflare-cf-cli
description: >-
  Cloudflare Workers projects use the new `cf` CLI and a typed
  `cloudflare.config.ts`, not wrangler. Do not add `wrangler.jsonc` /
  `wrangler.toml`, `wrangler dev` / `wrangler deploy` / `wrangler types`, or
  `worker-configuration.d.ts` to new work; when you find them in a project,
  migrate it with `cf migrate`. Use this skill whenever you create, configure,
  deploy or type a Cloudflare Worker, edit a wrangler config or a
  `@cloudflare/vite-plugin` setup, write a deploy script or CI step for
  Workers, or hit `required secrets have not been set`, a 404 from the Vite dev
  server after deleting wrangler.jsonc, an `ENOENT …/build/client/.vite/manifest.json`
  on `cf deploy`, or `spawn EFTYPE` on Windows.
---
# Cloudflare: `cf` CLI + `cloudflare.config.ts` (not wrangler)

**Rule:** new Cloudflare Workers work uses `cf` and `cloudflare.config.ts`.
Don't write `wrangler.jsonc`, `wrangler.toml`, `wrangler *` scripts or
`worker-configuration.d.ts`. When you find a project still on wrangler,
migrate it (below) — unless one of the cases under **Keep wrangler** applies;
then say so instead of forcing it.

`cf` is in beta (`1.0.0-beta.x` on npm as `cf`); the traps below were found on
`1.0.0-beta.2`. Re-check `cf <command> --help` before relying on a missing
flag still being missing.

## Migrate

```sh
pnpm dlx cf migrate
```

It adds `cf` to devDependencies, generates `cloudflare.config.ts`, and adds
`.cloudflare` to `.gitignore`. Then:

1. **Delete the generated `throw new Error(...)` / TODO for `assets.directory`.**
   Assets are found through the build (Vite); keeping
   `ASSETS: bindings.assets()` in `env` is enough.
2. **Previews**: a `previews` block becomes `defineConfig((ctx) => …)` with
   `if (ctx.isPreview)`. Use that branch to drop what previews can't have (e.g.
   queue consumers) and to point at preview buckets / rate-limit namespaces.
3. **Secrets → `bindings.secret()`** in `env` (this is also what types them —
   see below).
4. **Types**: `cf workers types` writes `.cloudflare/types/index.d.ts` from the
   config. Put `.cloudflare/types/**/*` in `tsconfig` `include` and
   `git rm worker-configuration.d.ts`.
5. **Vite** (`@cloudflare/vite-plugin`): add `experimental: { newConfig: true }`
   (see traps).
6. **Scripts**: swap commands per the table.
7. Delete `wrangler.jsonc` only after checking **Keep wrangler** below.

```ts
import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig((ctx) => ({
  worker: {
    name: "my-app",
    compatibilityDate: "2026-09-04",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "src/server.ts",
    triggers: ctx.isPreview ? [] : [triggers.queue({ name: "my-app-jobs" })],
    env: {
      ENVIRONMENT: bindings.text(ctx.isPreview ? "preview" : "production"),
      COVERS: bindings.r2({ name: ctx.isPreview ? "my-app-covers-preview" : "my-app-covers" }),
      HYPERDRIVE: bindings.hyperdrive({ id: "…", dev: { connectionString: "postgresql://…" } }),
      ASSETS: bindings.assets(),
      DATABASE_URL: bindings.secret(),
    },
  },
}));
```

## Commands

| Purpose | wrangler | cf |
| --- | --- | --- |
| Local dev | `wrangler dev` | `cf dev` — no prebuild; delegates to the Vite / framework dev server (HMR) |
| Types | `wrangler types` | `cf workers types` → `.cloudflare/types/index.d.ts` |
| Deploy | `wrangler deploy` | `cf deploy` (builds automatically) |
| Dry run | `wrangler deploy --dry-run` | `cf deploy --dry-run` (checks bindings and BOS assets) |
| Secrets | `wrangler secret bulk .env.production` | `cf deploy --secrets-file .env.production` (JSON or .env) |
| Logs | `wrangler tail` | keep `wrangler tail` — `cf` has no tail yet |

## Traps

**`bindings.secret()` is a required secret.** Deploy fails with
`The following required secrets have not been set: X` if it isn't set in
production. Declare only secrets production really has — not local-only keys
like `ENV=local`. Supply them with `cf deploy --secrets-file <file>`.

**Dev server 404 after removing wrangler.jsonc.** `@cloudflare/vite-plugin`
looks for `wrangler.json(c)` by default; without it only Vite's static server
runs. Fix:

```ts
cloudflare({ experimental: { newConfig: true }, viteEnvironment: { name: "ssr" } })
```

**`cf deploy` → ENOENT on `build/client/.vite/manifest.json` (React Router and
other Vite SSR frameworks).** `cf deploy` builds with
`CLOUDFLARE_VITE_FORCE_BUILD_OUTPUT=true`, which moves the client `outDir` to the
Build Output Specification path `.cloudflare/output/v0/workers/default/assets`,
while the framework's SSR build still reads `build/client`. Copy it back after
the client build:

```ts
{
  name: "sync-client-manifest",
  writeBundle() {
    if (this.environment?.name !== "client") return;
    const src = path.resolve(".cloudflare/output/v0/workers/default/assets");
    if (fs.existsSync(src)) fs.cpSync(src, path.resolve("build/client"), { recursive: true });
  },
},
```

**No `--var` on `cf deploy`.** Put the value in the `--secrets-file`, or read
`process.env.X` in `cloudflare.config.ts` and pass it to `bindings.text()`.

**Windows + a Worker without Vite → `spawn EFTYPE`.** Without
`@cloudflare/vite-plugin`, `cf` delegates to wrangler by spawning
`node_modules/wrangler/bin/*.js` directly, which Windows can't execute. Linux /
macOS / CI are fine. On Windows either add Vite + `@cloudflare/vite-plugin` to
that Worker, or keep wrangler for it for now.

## Keep wrangler (for now) when

- Before deleting `wrangler.jsonc`, grep CI, E2E and scripts for it:
  `test -f …/wrangler.jsonc`, `grep … wrangler.jsonc`, `wrangler dev -c
  wrangler.e2e.jsonc`, preflight scripts that parse it, CI checks on script
  names like `wrangler preview`. If any exist, keep `wrangler.jsonc` beside
  `cloudflare.config.ts` and port those consumers first, then delete it.
- `wrangler tail` for logs.
- The Windows no-Vite case above.

## Done when

- `tsc --noEmit` clean; `cf workers types` writes `.cloudflare/types/index.d.ts`
- `cf dev` (or the framework dev script) serves pages, not 404
- `cf deploy --dry-run` succeeds with all bindings and assets recognized
- CI / E2E still green; then `cf deploy`
