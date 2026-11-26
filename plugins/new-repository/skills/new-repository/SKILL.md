---
name: new-repository
description: Create a new GitHub repository from the kuboon/deno-remix-tmpl template via kagi (the phone-approval-gated GitHub automation tool), and apply the standard repo settings (wiki/discussions/projects off, release immutability on, auto-merge on, delete-branch-on-merge on, GitHub Pages via Actions). Use this whenever the user asks to create a new repository, start a new project, scaffold a new deno-remix project, or set up a new repo under kuboon or kbn-one — even if they only say "make a new repo for X" or "start a new project" without mentioning kagi, deno-remix-tmpl, or any of the settings by name. Every step that touches GitHub goes through kagi and needs the user's phone approval — budget for that, and never try to work around it.
---

# new-repository

Sets up a new GitHub repository the way kuboon/kbn-one actually want new projects started: from the
`kuboon/deno-remix-tmpl` template, with a fixed set of repo settings applied, all done through kagi
(see `references/kagi-protocol.md` if you need the raw protocol) so nothing touches GitHub without a
human approving it on their phone first.

Every finding below (which settings work, which don't, and the exact gotchas) came from actually
running this against a real test repository — not from reading GitHub's docs alone. Follow the exact
shapes given; deviating "to simplify" tends to rediscover the gotchas the hard way.

## Step 0 — Ask before doing anything

Ask the user (don't guess):

1. **Owner**: `kuboon/` or `kbn-one/`? If the project will use Cloudflare Workers, it's `kbn-one/`;
   otherwise `kuboon/`. Ask directly — "will this use Cloudflare Workers?" — rather than inferring it
   from the project description.
2. **Repo name.**
3. **Visibility** (private or public). Default to private, but tell the user up front: if they want
   GitHub Pages on this repo and their plan doesn't include private Pages (GitHub Free does not),
   Pages setup will fail later unless the repo is public. Let them decide now rather than discovering
   it at the Pages step.
4. **`KAGI_ID`**: check `echo -n "${KAGI_ID:-}" | wc -c` in the shell. If unset, ask the user for it
   (their kagi subscription id) — never guess it or reuse one from an unrelated session/repo. Export
   it for the rest of the session: `export KAGI_ID=...`.

Everything from here on calls `scripts/kagi_req.sh`, which POSTs the request, polls for the phone's
answer, and prints the final result. Read that script once — it's short — so you know what a
rejection vs. a timeout vs. a successful-but-unexpected GitHub response looks like.

## Step 1 — Create the empty repository

GitHub's native "create a repository from a template" API (`POST /repos/{owner}/{repo}/generate`)
**does not work through kagi, at all, for any owner combination** — confirmed by testing both
same-owner and cross-owner generation. The failure is structural, not a permissions problem: that
endpoint needs a GitHub App *user* access token (one tied to a human's OAuth identity); kagi only
ever mints *installation* access tokens (server-to-server, no human identity attached), and GitHub
rejects the generate call outright with either `403 Resource not accessible by integration`
(cross-owner) or `422 Could not clone: Cloning user does not have permission to view the clone
repository` (same-owner — GitHub's "cloning user" check has no identity to satisfy). Don't re-try
generate with different permission names; this one is a dead end, not a tuning problem.

So: create a plain empty repository instead, then copy the template's content over in Step 2.

```bash
KAGI_URL="https://kagi.kbn.one/api/sub/${KAGI_ID}" \
  deno run --allow-net=kagi.kbn.one --allow-env=KAGI_URL,KAGI_APP,KAGI_PERMISSIONS \
  https://raw.githubusercontent.com/kbn-one/kagi/main/tools/git_credential_kagi.ts \
  create <owner>/<name> --private   # or --public, per Step 0
```

This asks the phone to approve "owner/name (private) creation" and prints the new repo's
`full_name`/`html_url`/`clone_url` as JSON once approved. If it times out waiting (the user missed
the notification), just re-run it — kagi transactions expire and a fresh one is cheap to issue.

## Step 2 — Copy the template's content in

Clone the template (it's public, no auth needed), strip its history, and push as a fresh initial
commit — this gets the same files without GitHub's "generated from a template" relationship badge
(which, per Step 1, isn't achievable through kagi).

```bash
tmpdir=$(mktemp -d)
git clone --depth 1 https://github.com/kuboon/deno-remix-tmpl "$tmpdir"
rm -rf "$tmpdir/.git"
git -C "$tmpdir" init -b main
git -C "$tmpdir" add -A
git -C "$tmpdir" commit -m "Initial commit from kuboon/deno-remix-tmpl"
git -C "$tmpdir" remote add origin "https://github.com/<owner>/<name>.git"

git -C "$tmpdir" config credential.https://github.com.useHttpPath true
git -C "$tmpdir" config credential.https://github.com.helper \
  "!KAGI_URL=https://kagi.kbn.one/api/sub/${KAGI_ID} deno run --allow-net=kagi.kbn.one --allow-env=KAGI_URL,KAGI_APP,KAGI_PERMISSIONS https://raw.githubusercontent.com/kbn-one/kagi/main/tools/git_credential_kagi.ts"

git -C "$tmpdir" push origin main
```

The push triggers its own phone approval (a `github-app-token` request scoped to exactly this one
repo, `contents:write`, one hour) — separate from the repo-creation approval in Step 1. That's by
design: creating a repo and writing to it are different capabilities, shown and approved separately.

## Step 3 — Repo settings (one batched call)

These four fields are all on `PATCH /repos/{owner}/{repo}`, so set them together — one phone
approval instead of four:

```bash
./scripts/kagi_req.sh '{
  "type":"github-api","app":"GH_APP",
  "owner":"<owner>","repositories":["<name>"],
  "permissions":{"administration":"write"},
  "method":"PATCH","path":"/repos/<owner>/<name>",
  "body":{"has_wiki":false,"has_projects":false,"allow_auto_merge":true,"delete_branch_on_merge":true}
}'
```

**Known gotcha — `allow_auto_merge` silently fails on a private repo.** Same shape as the Pages gotcha
in Step 5: the call comes back `200 OK` but the response body still shows `allow_auto_merge: false`
— no error, just silently ignored. Confirmed (by testing on both `kuboon/` and `kbn-one/`, so it's
not an org policy) to be a visibility gate: it only takes effect once the repo is public.
`administration:write` is clearly not the problem, since the other three fields in the same call land
correctly either way. If the repo is staying private, tell the user plainly that auto-merge won't
actually turn on — don't claim success just because the call returned `200`. If the repo will be
public anyway (e.g. because of Step 5's Pages requirement), set `allow_auto_merge` again *after* that
visibility change, or combine it into whichever call flips `private` to `false`.

**Discussions**: there's no REST field to toggle `has_discussions` on an *existing* repo — it's
create-time-only in REST (`POST /user/repos`), and changing it later needs a GraphQL
`updateRepository` mutation. Since new repos default to discussions disabled already, there's nothing
to do here unless the user explicitly asks for discussions to be *enabled* — if so, tell them it needs
a GraphQL call (not covered by this skill) rather than silently skipping it.

## Step 4 — Release immutability

```bash
./scripts/kagi_req.sh '{
  "type":"github-api","app":"GH_APP",
  "owner":"<owner>","repositories":["<name>"],
  "permissions":{"administration":"write"},
  "method":"PUT","path":"/repos/<owner>/<name>/immutable-releases"
}'
```

No request body. A `204` with an empty body means it's on. (`PUT` is idempotent — safe to re-run.)

## Step 5 — GitHub Pages via Actions

Two gotchas here, both confirmed by trial and error — don't skip either:

1. **You need `pages:write` *and* `administration:write` together, in the same permission request.**
   GitHub's general permissions table reads like either one alone should work ("administration or
   pages"); the endpoint-specific docs say otherwise — this specific call needs both simultaneously.
   Requesting only one gets a `403 Resource not accessible by integration` even when that one
   permission is genuinely granted and working for other calls.
2. **The repo must be public, unless the org/account is on a paid plan.** GitHub Pages on a private
   repo needs GitHub Pro (personal) or a paid org plan; on the Free plan this fails with `422 Your
   current plan does not support GitHub Pages for this repository` — regardless of permissions. If
   the repo was created private in Step 1 and the user wants Pages, confirm with them before flipping
   visibility (changing a repo to public is a real, visible change — don't do it silently).

```bash
./scripts/kagi_req.sh '{
  "type":"github-api","app":"GH_APP",
  "owner":"<owner>","repositories":["<name>"],
  "permissions":{"pages":"write","administration":"write"},
  "method":"POST","path":"/repos/<owner>/<name>/pages",
  "body":{"build_type":"workflow"}
}'
```

A `201` with `"build_type":"workflow"` in the response means it's live at
`https://<owner>.github.io/<name>/`.

**Deploying from branches other than `main`**: nothing further to do. `build_type: "workflow"` has no
branch restriction by default — any branch's workflow can deploy to the `github-pages` environment
unless someone has added a deployment-protection rule restricting it (GitHub's docs recommend adding
one restricting to the default branch, but doesn't do so automatically). If the user specifically
wants to *restrict* deploys to `main` instead, that's the opposite of what this skill sets up by
default — ask before adding that restriction rather than assuming either way.

## What this skill cannot do — tell the user, don't paper over it

- **"Limit how many branches and tags can be updated in a single push."** This setting
  (Settings → General → Pushes) has **no REST API at all** — not a kagi limitation, GitHub simply
  doesn't expose it over the API (confirmed by grepping GitHub's full OpenAPI spec). The user has to
  set this one by hand in the repo's Settings page.
- **GitHub-native template generation** (the "Generated from template" relationship). See Step 1 —
  structurally blocked by kagi's token model. The content ends up identical; only the GitHub metadata
  badge is missing.
- **Repo transfers between owners** (`POST /repos/{owner}/{repo}/transfer`) are in the same boat as
  template generation — GitHub documents this endpoint as supporting only GitHub App *user* access
  tokens, not installation tokens, so it cannot be done through kagi either. If the user ever asks to
  create-then-transfer as a template-generation workaround, it will fail at the transfer step for the
  same root cause as Step 1 — don't attempt it.

Report what you did and what's left as a short checklist at the end, in the same shape as the
settings above — don't just say "done."
