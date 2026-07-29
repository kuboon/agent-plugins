---
name: admin-view-toggle
description: >-
  When implementing any feature whose UI differs by privilege — an admin-only
  page, button, column, menu entry, badge, or an `isAdmin` / `role === "admin"`
  / RBAC / 管理者権限 branch in view code — also ship a frontend-only
  「一般 / admin」 view switch for admin users, defaulting to 一般 so admins see
  the regular UI until they deliberately switch to admin to use a privileged
  feature. Use this skill whenever you add or review role-gated UI, an admin
  dashboard/panel, a permission check in a component or template, or the user
  mentions admin 権限, 管理画面, role switching, "view as user", or
  impersonation for testing. The switch changes rendering only: the backend
  keeps authorizing on the real role and must never read it.
---

# Admin ⇄ 一般 view toggle

## The rule

Any time you gate UI on "is this user an admin", you owe two things, not one:

1. the gated UI itself, and
2. a **view switch** in the chrome (header / user menu) that lets a real admin
   flip the whole frontend between **一般** (regular user) and **admin**
   rendering.

**一般 is the default.** An admin lands in the regular UI and switches to admin
only when they actually want to use a privileged feature — then switches back.
Two reasons: what a regular user sees is the view that matters and the one you
should be looking at most of the time, and admin-only destructive affordances
stay out of reach until asked for.

The switch is **presentation only**. The session and every server-side
authorization check keep using the real role — which is admin — the entire time,
including while the frontend renders 一般. Nothing about the toggle reaches the
backend as an authorization signal.

Why this and not "log in as a test user": the point is *visual* self-testing.
You want to see what a regular user sees — one click, same tab, same data, same
scroll position — while building the admin feature. A second account, a second
browser profile, or a real impersonation feature is a much bigger and more
dangerous machine than what this is for.

## The shape

One derived boolean, computed in exactly one place, used by every gated view:
**`isAdminView` = "the session's real role is admin" AND "the view preference is
admin"**. The AND is the whole security story — a non-admin can set the
preference and still get `false`, so the preference needs no protection of its
own. The raw admin flag stays reachable only from the authorization layer; view
code never reads it.

The preference defaults to `一般`, so `isAdminView` is false until an admin
opts in. Render the switch itself only when the real role is admin.

### The trap this exists to prevent

A stray `user.isAdmin` (or `role === "admin"`, `hasRole("admin")`, `admin?`) left
in a component ignores the toggle. The toggle is only as good as its coverage:
one leak and 一般 mode silently lies to you — worse than not having the toggle
at all, because you will trust it. When adding this pattern to an existing
codebase, grep out every raw admin read in view code and route them all through
the single derived flag.

## Persistence and the indicator

- **Persist the preference** so a reload, a route change, or a form POST doesn't
  drop you out of admin mode mid-task. A cookie is the right default for a
  server-rendered app — the server needs it at render time so the SSR markup
  matches the client. `localStorage` is fine for a pure SPA. A `?viewAs=` query
  param alone is not enough; it dies on the first redirect.
- **Make the current mode visible while in admin** — a badge, a tinted top
  border, a persistent chip: `admin 表示中 [一般に戻す]`. It doubles as the way
  back, and it stops the "why is this destructive button here" moment.
- **Never show the switch to non-admins.** Not disabled, not greyed out —
  absent.

On a server-rendered app the cookie read is a *rendering* input, sitting next to
theme and locale. It must not travel anywhere near the authorization path.

## The backend never reads it

This is the line that keeps the feature safe and cheap:

- Do **not** add `X-View-As` headers, `?viewAs=` params, or a `viewRole` field
  to requests as anything the server branches authorization on.
- Do **not** teach middleware, guards, policies, or row-level filters about it.
- Do **not** narrow the API response by view mode. The response is the admin
  response; the frontend just doesn't paint parts of it.

Consequences to accept rather than engineer around:

- **Admin-only data is still on the wire** while in 一般 view — hidden in the
  DOM, not absent from the payload. Fine: the person looking at devtools *is*
  the admin.
- **Admin actions still succeed** if one is triggered while in 一般 view (a
  bookmarked URL, a keyboard shortcut, a stale tab). Don't add a client-side
  block; it isn't a privilege boundary, and pretending it is invites someone to
  rely on it later.

## What this does and does not test

| Question | This toggle |
| --- | --- |
| Does the 一般 layout look right without the admin column? | ✅ answers it |
| Is the empty state / CTA sane for a regular user? | ✅ answers it |
| Does the nav still balance with the admin entries gone? | ✅ answers it |
| Does the API refuse this request for a non-admin? | ❌ cannot answer it |
| Does the loader hide admin fields from a non-admin? | ❌ cannot answer it |

Authorization is verified with a genuinely non-admin session: an integration
test hitting the endpoint with a regular user's token, or a real second account.
Say so plainly if someone proposes using the toggle for that — it renders, it
does not enforce.

## Checklist

- [ ] One derived `isAdminView` = real-role-is-admin AND view-preference-is-admin.
- [ ] Every role-gated render path reads it; no raw admin flag left in view code.
- [ ] Switch rendered only for real admins.
- [ ] Preference persisted (cookie for SSR, `localStorage` for SPA),
      **defaulting to 一般**.
- [ ] Visible admin-mode indicator with a one-click way back to 一般.
- [ ] No view-mode signal reaches any authorization check; backend stays admin.
- [ ] Real authorization still covered by tests with a real non-admin session.
