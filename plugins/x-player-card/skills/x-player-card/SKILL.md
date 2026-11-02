---
name: x-player-card
description: >-
  Make a link posted on X (Twitter) play inline — a game, audio/video player or
  small interactive widget in an iframe inside the post — with a Player Card
  (`twitter:card` = `player`). Use this skill whenever you add `twitter:*`
  meta tags, build a "share to X" page or an embeddable game/player page, set
  `frame-ancestors` / `X-Frame-Options` for X, or debug a card that shows only
  a thumbnail, a black box, or "refused to connect". Covers the share page vs.
  player page split, the meta tags, the headers the player page must send, what
  X's iframe sandbox breaks (`alert()`, form submit), and how to test without
  the retired Card Validator.
---
# X Player Card

A Player Card makes X render the page behind a posted link as an iframe inside
the post. X's own documentation is mostly gone; what follows is the setup that
community examples (playable games in posts) report working as of late 2026.
X can change or restrict it at any time, and its policy describes it as for
video/audio — treat interactive content as best-effort.

## Two URLs

- **Share page** — the URL you post. Carries the meta tags; X's crawler
  (`Twitterbot`) reads it.
- **Player page** — what X loads in the iframe. Only the game/player, nothing
  else.

One page can be both, but separate pages are easier to keep right.

## 1. Share page: meta tags in server-rendered HTML

The crawler does not run JavaScript, so the tags must be in the HTML the server
returns — not injected client-side. (In Next.js, the `metadata` API renders
them server-side.)

```html
<meta name="twitter:card" content="player">
<meta name="twitter:site" content="@yourhandle">
<meta name="twitter:title" content="Title (≈70 chars max)">
<meta name="twitter:description" content="Description (≈200 chars max)">
<meta name="twitter:image" content="https://example.com/poster.jpg">
<meta name="twitter:player" content="https://example.com/embed/game">
<meta name="twitter:player:width" content="480">
<meta name="twitter:player:height" content="480">
```

- Absolute **HTTPS** URLs only.
- **480×480** is what recent working examples use; larger sizes have been
  reported to fall back to a plain image card.
- `twitter:image` is effectively required: square (e.g. 675×675), at least
  ~68,600 px. It is also what mobile shows before the player opens.
- Add `og:title` / `og:description` / `og:image` too for other sites.

## 2. Player page: frameable, small, self-contained

X embeds it roughly as:

```html
<iframe src="…" sandbox="allow-popups allow-same-origin allow-scripts allow-presentation"></iframe>
```

(the exact attribute set can differ by client).

**Allow framing with an HTTP header, not a meta tag**:

```
Content-Security-Policy: frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com
```

and send **no** `X-Frame-Options` (`DENY` / `SAMEORIGIN` block it). Chromium
ignores `frame-ancestors` in a `<meta http-equiv>` ("ignored when delivered via
a `<meta>` element"), so a meta tag can't grant or deny it. Check that your
host/CDN/framework doesn't add `X-Frame-Options` by default.

**What that sandbox breaks** (verified on Chromium 141 with the attribute set
above):

| Works | Doesn't |
| --- | --- |
| scripts, `fetch()`, `localStorage` (same-origin is allowed) | `alert()` / `confirm()` / `prompt()` — ignored, no `allow-modals` |
| links opened in a new tab (`allow-popups`) | `<form>` submission — blocked, no `allow-forms`; send with `fetch()` |
| fullscreen video (`allow-presentation`) | pointer lock — no `allow-pointer-lock` |

So:

- Game/player only — no site header or footer; fill the frame.
- Responsive from about **245px to 500px** wide.
- Links: `target="_blank" rel="noopener noreferrer"`.
- Show a **loading screen immediately**; a slow start looks like a black box.
- Tolerate query parameters X may add (e.g. `?autoplay=1`).
- Keep the player out of search: `<meta name="robots" content="noindex">` and a
  `canonical` pointing at the share page.

## 3. Test (there is no validator any more)

```sh
# share page as the crawler sees it
curl -sA 'Twitterbot/1.0' https://example.com/share | grep -i 'twitter:'
# player page headers
curl -sI https://example.com/embed/game | grep -iE 'content-security-policy|x-frame-options'
```

1. Load the player in a local test page with the same `sandbox` attribute (as
   above) at 480×480 and play it through; watch the console for "sandboxed"
   warnings.
2. Post it. X caches cards hard: after any change, post the URL with a new
   query string (`?v=2`) so X fetches it as a new link.
3. Check x.com on desktop (usually plays inline) and the mobile apps (usually
   shows the image; tapping opens the player in a separate view or browser).

## Limits

- Doesn't render in X Articles.
- Some domains may be restricted by X (approval used to be required; recent
  reports say most domains work without it).
- Interactive use is outside the stated video/audio purpose and could be
  switched off without notice.
