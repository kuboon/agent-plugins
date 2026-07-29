---
name: admin-view-toggle
description: >-
  When implementing any feature whose UI differs by privilege — an admin-only
  page, button, column, menu entry, badge, or an `isAdmin` / `role === "admin"`
  / RBAC / 管理者権限 branch in view code — also ship a frontend-only
  「一般 / admin」 view switch for admin users, so one admin account can eyeball
  both UIs without logging out. Use this skill whenever you add or review
  role-gated UI, an admin dashboard/panel, a permission check in a component or
  template, or the user mentions admin 権限, 管理画面, role switching,
  "view as user", or impersonation for testing. The switch changes rendering
  only: the backend keeps authorizing on the real role and must never read it.
---

# Admin ⇄ 一般 view toggle

## The rule

Any time you gate UI on "is this user an admin", you owe two things, not one:

1. the gated UI itself, and
2. a **view-as switch** in the chrome (header / user menu / dev bar) that lets a
   real admin flip the whole frontend between **admin** and **一般** (regular
   user) rendering.

The switch is **presentation only**. The session, the API calls, and every
server-side authorization check keep using the user's real role — which is
admin — the entire time. Nothing about the toggle reaches the backend as an
authorization signal.

Why this and not "log in as a test user": the point is *visual* self-testing.
You want to see what a regular user sees — one click, same tab, same data, same
scroll position — while you are building the admin feature. Maintaining a second
account, a second browser profile, or a real impersonation feature is a much
bigger and more dangerous machine than what this is for.

## The shape

One derived boolean, computed in exactly one place, used everywhere:

```ts
// auth/view-role.ts — the ONLY module that reads the raw admin flag for rendering
export type ViewRole = "admin" | "user";

/** What the session actually is. Authorization truth. */
const actualIsAdmin = session.user.role === "admin";

/** What the admin asked to *look at*. Cosmetic. Defaults to their real role. */
const viewRole: ViewRole = actualIsAdmin ? readViewRolePreference() : "user";

/** The AND is the whole security story: a non-admin can set the preference
 *  to "admin" all day and still get `false`. */
export const isAdminView = actualIsAdmin && viewRole === "admin";

/** Render the switch itself only for real admins. */
export const canSwitchView = actualIsAdmin;
```

Then in views:

```tsx
{isAdminView && <DeleteAllButton />}
```

### The trap this exists to prevent

```tsx
{user.isAdmin && <DeleteAllButton />}     // ❌ ignores the toggle — it leaks
{currentUser.role === "admin" && <AdminNav />}  // ❌ same
{isAdminView && <AdminNav />}             // ✅
```

The toggle is only as good as its coverage. One stray `user.isAdmin` in a
component and 一般 mode silently lies to you — which is worse than not having
the toggle at all, because you will trust it. When you add this skill's pattern
to an existing codebase, grep for every raw admin read in view code
(`isAdmin`, `role ===`, `hasRole(`, `admin?`) and route them all through
`isAdminView`. Leave the raw flag reachable only from the authorization layer.

## Persistence and the indicator

- **Persist the preference** so a full page reload, a route change, or a form
  POST doesn't snap you back to admin mid-test. A cookie is the right default
  for a server-rendered app (the server needs it at render time so the SSR
  markup matches the client); `localStorage` is fine for a pure SPA. A
  `?viewAs=user` query param alone is not enough — it dies on the first
  redirect.
- **Default to the real role** (admin). The app should behave normally until
  someone deliberately flips it.
- **Show a persistent indicator while masked** — a badge, a tinted top border,
  a small floating chip: `一般ユーザー表示中 [解除]`. Without it you will
  eventually file a bug against your own app because "the admin menu is gone".
  The indicator doubles as the way back.
- **Never show the switch to non-admins.** Not disabled, not greyed out —
  absent. It's a maintainer's tool, and its presence is a hint worth not giving.

If the app server-renders, the cookie read on the server is a *rendering* input,
sitting next to theme and locale. It must not travel anywhere near the
authorization path.

## The backend never reads it

This is the line that keeps the feature safe and cheap:

- Do **not** add `X-View-As` headers, `?viewAs=` params, or a `viewRole` field
  to API requests as anything the server branches authorization on.
- Do **not** teach middleware, guards, policies, or row-level filters about it.
- Do **not** narrow the API response by view role. The response is the admin
  response; the frontend just doesn't paint parts of it.

Consequences you should accept rather than engineer around:

- **Admin-only data is still on the wire** while in 一般 view. It's hidden in
  the DOM, not absent from the payload. That is fine — the person looking at
  devtools *is* the admin.
- **Admin actions still succeed** if one is triggered while in 一般 view (via a
  bookmarked URL, a keyboard shortcut, a stale tab). Don't add a client-side
  block for this; it isn't a privilege boundary, and pretending it is invites
  someone to rely on it later.

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

- [ ] `isAdminView` derived once as `actualIsAdmin && viewRole === "admin"`.
- [ ] Every role-gated render path reads `isAdminView`, not the raw flag.
- [ ] Switch rendered only when `actualIsAdmin`.
- [ ] Preference persisted (cookie for SSR, `localStorage` for SPA), defaulting
      to admin.
- [ ] Visible indicator + one-click exit while in 一般 view.
- [ ] No `viewAs` signal reaches any authorization check; backend stays admin.
- [ ] Real authorization still covered by tests with a real non-admin session.
