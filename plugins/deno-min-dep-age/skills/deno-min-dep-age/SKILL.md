---
name: deno-min-dep-age
description: >-
  When updating jsr:/npm: dependency versions in a Deno project and a version is
  refused with "A newer matching version was found, but it was not used because
  it was newer than the specified minimum dependency date" — or `deno add` /
  `deno install` / `deno outdated --update` resolves an older version than
  expected — the block is Deno 2.9's `minimumDependencyAge` (24h by default even
  when unset). For `@kuboon`-scope packages, which are self-published and need no
  supply-chain delay, add them to `minimumDependencyAge.exclude` in deno.json
  rather than lowering the age, passing `--min-dep-age 0`, or waiting. Use this
  skill whenever bumping Deno dependencies, editing `minimumDependencyAge`, or
  debugging a jsr/npm version that Deno refuses to install.
---

# Deno `minimumDependencyAge`: exclude, don't disable

## The situation

Since **Deno 2.9**, a **24-hour** minimum dependency age applies **even when
`minimumDependencyAge` is unset**. Deno refuses to install a jsr/npm version
published more recently than the window, which stops freshly-published
compromised versions from landing. The refusal looks like this:

```
error: Could not find version of '@kuboon/foobar' that matches specified version constraint '^0.1.0'

A newer matching version was found, but it was not used because it was newer
than the specified minimum dependency date of 2026-07-28 14:31:18 UTC
```

with a hint pointing at `--minimum-dependency-age` (alias `--min-dep-age`) and
<https://docs.deno.com/go/minimum-dependency-age>.

You will hit this constantly on **`@kuboon`-scope packages**: you publish them,
then immediately want to consume them. The delay buys nothing there — there is
no third party to be compromised.

## The rule

Exempt the scope you publish; keep the delay for everyone else.

```jsonc
// deno.json
{
  "minimumDependencyAge": {
    "age": "P3D",
    "exclude": ["jsr:@kuboon/*"]
  }
}
```

**Do not** instead:

- set `"minimumDependencyAge": 0` or pass `--min-dep-age 0` — that removes the
  supply-chain delay from *every* npm/jsr dependency to unblock one of yours;
- shorten `age` globally for the same reason;
- wait out the window, or hand-pin an older version, when an exclude entry is
  the actual fix.

Excluding a scope you control is scoped trust. Disabling the field is not.

## Writing `exclude` entries

Verified against Deno 2.9.4:

- **The `jsr:` / `npm:` prefix is required.** `"@kuboon/foobar"` emits
  `Warning "minimumDependencyAge.exclude" entry "@kuboon/foobar" missing jsr: or
  npm: prefix.` and does nothing.
- **`jsr:@kuboon/*` works** and covers the whole scope — one entry, no
  maintenance as you publish new packages. The docs only show exact specifiers
  (`["npm:@mycompany/cli", "jsr:@mycompany/lib"]`), but the wildcard matches
  correctly and, equally important, `jsr:@other/*` does **not** match
  `@kuboon/...`. Prefer the scope wildcard over enumerating packages.
- **Never append a version.** `"jsr:@kuboon/foobar@0.1.0"` is silently ignored —
  no warning, no exemption. Entries are package specifiers only.
- **It is not transitive.** Excluding `jsr:@std/assert` does not exempt the
  `@std/internal` it depends on; that resolves under the age limit and fails on
  its own. Exempt whatever actually gets resolved — another reason the scope
  wildcard is the right shape.

## The `age` value

Accepts an ISO-8601 duration (`P3D`, `PT72H`), a number of minutes (`120`), an
absolute cutoff date (`2026-07-16`) or RFC3339 timestamp, or `0` to disable.
`P3D` is a reasonable default: most malicious releases are caught and yanked
within days.

The string form (`"minimumDependencyAge": "P3D"`) has no `exclude`; switching to
the object form with `age` + `exclude` is exactly the edit to make when the first
exemption is needed.

The same control exists as the `--minimum-dependency-age` / `--min-dep-age` CLI
flag and as `min-release-age` in `.npmrc`. Neither takes an exclude list — the
per-package exemption only exists in deno.json, which is another reason to fix
this in config rather than at the command line.

## Checklist

- [ ] Blocked update diagnosed as `minimumDependencyAge`, not a bad version range.
- [ ] `deno.json` uses the object form with `age` + `exclude`.
- [ ] `exclude` has `jsr:@kuboon/*` (prefixed, wildcard, no version suffix).
- [ ] Global `age` left intact for third-party dependencies — not `0`, not shortened.
- [ ] Re-ran `deno install` / `deno outdated --update --latest` to confirm the
      version resolves.
