# kagi protocol reference

kagi is a phone-approval-gated proxy for making HTTP calls (including minting GitHub App tokens)
without the calling agent ever seeing the underlying secrets. Every request is shown to a human on
their phone and only executes if they approve it. Source: https://github.com/kbn-one/kagi

Endpoint: `https://kagi.kbn.one/api/sub/<KAGI_ID>` — `KAGI_ID` is per-subscription; ask the user,
never guess or reuse one from another repo/session.

## Making a request

```
POST <endpoint>/req   — body is the request JSON (see shapes below) → 202 {"transaction_id":"…"}
GET  <endpoint>/res?transaction_id=…&wait=55   — repeat while it answers 202 (still pending)
```

`GET /res` eventually returns:
- `200 {"response":{"status","headers","body"}}` — delivered exactly once; this is the final
  GitHub/HTTP response, whatever it was (success or error). A `200` from kagi does **not** mean the
  underlying call succeeded — check `response.status` and `response.body`.
- `403` — the human rejected it.
- `502` — the call itself failed.
- `410` — expired (the human didn't respond in time), or already delivered once before.

Errors come as `application/problem+json` with a `detail` field. Don't resend a rejected request
without asking the human why.

## Request shapes

**Raw HTTP call** (goes through kagi's generic relay, not just GitHub):
```json
{"secrets":["NAME"],"url":"https://…","method":"GET","headers":{"authorization":"Bearer [NAME]"},"body":…}
```
`[NAME]` placeholders in `url`/`headers`/`body` are substituted on the phone. List every secret name
used in `secrets`. The target API must allow CORS unless the secret is configured to route through
the kagi server itself.

**Mint a GitHub App installation token** (the token itself is handed back to the requester — use only
when you genuinely need the raw token, e.g. for something kagi has no first-class action for):
```json
{"type":"github-app-token","app":"GH_APP","owner":"OWNER","repositories":["REPO"],"permissions":{"issues":"write"}}
```

**Call the GitHub API as the App** (the token stays on the phone; you get the API's response, with
the token scrubbed out as `[app]`):
```json
{"type":"github-api","app":"GH_APP","owner":"OWNER","repositories":["REPO"],"permissions":{"issues":"write"},"method":"POST","path":"/repos/OWNER/REPO/issues","body":{"title":"…"}}
```
**Hard rule, enforced both client- and server-side**: `path`'s owner/repo must exactly match `owner`/
one of `repositories`. This is deliberate — it's what guarantees the phone's approval screen shows
exactly what will happen. There is no way to request permissions scoped to one repo and have `path`
act on a different one, even within the same owner, and definitely not across owners. Don't try to
route around this; if a GitHub endpoint genuinely needs cross-owner access in one call (template
generation, repo transfer), it is not reachable through this request type — see
`SKILL.md`'s "what this skill cannot do" section.

**Create a repository** (first-class action — mints an *unscoped* token for the destination owner's
installation, so the phone only needs to show name + visibility, not a permissions list):
```json
{"type":"github-create-repo","app":"GH_APP","owner":"OWNER","name":"REPO","visibility":"private"}
```

## Permission names kagi accepts

From `web/client/lib/kagi/protocol.ts`'s `REPOSITORY_PERMISSIONS` set (as of the version this skill
was written against — re-check the source if a permission you need isn't here):

```
actions, administration, artifact_metadata, attestations, checks, code_quality, codespaces,
contents, dependabot_secrets, deployments, discussions, environments, interaction_limits, issues,
merge_queues, metadata, packages, pages, pull_requests, repository_custom_properties,
repository_hooks, repository_projects, secret_scanning_alerts, secrets, security_events,
single_file, statuses, vulnerability_alerts, workflows
```

These are all *repository*-scoped permissions. Organization/account-level permissions (e.g. member
management) aren't in this set and aren't narrowable to specific repositories at all — kagi's `owner`
+ `repositories` scoping model doesn't apply to them, so `github-api` can't be used for those at all.

## Confirmed-working permission combinations (don't re-derive these from GitHub's general docs table —
## several endpoints need more than the table implies; these were verified against real responses)

| Call | Permissions that actually work |
|---|---|
| `PATCH /repos/{o}/{r}` (wiki/projects/delete-branch) | `administration:write` alone |
| `PATCH /repos/{o}/{r}` (`allow_auto_merge`) | `administration:write` alone, **but only takes effect on a public repo** — `200 OK` with the field silently staying `false` on a private repo (confirmed on both `kuboon/` and `kbn-one/`, so it's a visibility gate, not an org policy or a permissions problem) |
| `PUT /repos/{o}/{r}/immutable-releases` | `administration:write` alone |
| `POST /repos/{o}/{r}/pages` (`build_type:"workflow"`) | `pages:write` **and** `administration:write` together — neither alone is enough, despite the general permissions table implying "either" |
| `POST /repos/{o}/{r}/generate` (template generation) | **nothing works** — installation tokens aren't a supported auth method for this endpoint at all (confirmed same-owner and cross-owner); needs a GitHub App *user* access token, which kagi doesn't mint |
| `POST /repos/{o}/{r}/transfer` | **nothing works**, same reason — GitHub's own docs list only "GitHub App user access tokens" as supported for this endpoint, explicitly excluding installation access tokens |

## git push / git credential helper

`tools/git_credential_kagi.ts` doubles as a git credential helper and a `create` subcommand:

```
# one-time per local clone:
git config credential.https://github.com.useHttpPath true
git config credential.https://github.com.helper \
  '!KAGI_URL=https://kagi.kbn.one/api/sub/<id> deno run --allow-net=kagi.kbn.one --allow-env=KAGI_URL,KAGI_APP,KAGI_PERMISSIONS \
    https://raw.githubusercontent.com/kbn-one/kagi/main/tools/git_credential_kagi.ts'

# create a repo:
KAGI_URL=... deno run --allow-net=kagi.kbn.one --allow-env=KAGI_URL,KAGI_APP,KAGI_PERMISSIONS \
  .../git_credential_kagi.ts create OWNER/NAME --public|--private [--description "…"] [--init]
```

Env vars the helper reads: `KAGI_URL` (required), `KAGI_APP` (default `GH_APP`), `KAGI_PERMISSIONS`
(default `contents:write`, comma-separated `name:read|write` — used only by the credential-helper
`get` mode, not by `create`). Each `git push` triggers its own phone approval, scoped to exactly the
one repository being pushed to, valid one hour, single transaction.
