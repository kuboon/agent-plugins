---
name: ios-standalone-status-bar
description: >-
  When a web app installed to the iPhone Home Screen (Add to Home Screen / PWA
  standalone) renders a translucent blur band across the top on iOS 26+ —
  the header washed out or smeared, content smudged a row or two below the
  status bar, or a stray white strip along the bottom — the cause is
  `apple-mobile-web-app-status-bar-style: black-translucent`. Use this skill
  whenever writing or reviewing the `<head>` of an installable web app, setting
  `apple-mobile-web-app-*` or `theme-color` meta tags, choosing
  `viewport-fit=cover`, handling `env(safe-area-inset-top)` in a standalone
  layout, or debugging a report that the installed app looks blurry, frosted or
  faded at the top on iPhone while the same page is fine in Safari. Also covers
  why the fix appears not to work until the Home Screen icon is deleted and
  re-added.
---

# iOS standalone: the Liquid Glass band at the top

## The symptom

Installed to the Home Screen and launched standalone, the top of the app is
covered by a frosted band: the header's title and buttons come up smeared and
low-contrast, and the blur bleeds a row or two *below* the status bar. In Safari
the same page is fine. Only the installed launch is affected.

## The cause

Two things combine.

1. **`apple-mobile-web-app-status-bar-style: black-translucent`** puts your page's
   own pixels underneath the status bar. This is Apple's documented behavior:
   with `default` or `black`, "the web content is displayed below the status
   bar"; with `black-translucent`, "the web content is displayed on the entire
   screen, partially obscured by the status bar."
2. **iOS 26 fills that inset with the Liquid Glass "scroll edge effect"** — the
   system's own blur, applied where it cannot sample a flat colour at the page's
   top edge. A gradient, image, texture or any non-uniform content at the top of
   the page therefore gets a blur band laid over it.

Before iOS 26 the same markup merely let your content show through the status
bar, which is what people wanted when they wrote it. The tag did not change; the
system's treatment of that inset did.

## The fix: stop putting content up there

There is **no way to turn the effect off** — no CSS property, no meta switch —
and `env(safe-area-inset-*)` does **not** grow to account for it. The only lever
is not drawing under the status bar at all.

```diff
- <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
+ <meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

Omitting the tag entirely is equivalent — `default` is the documented default
value — and both spellings have shipped as this fix. Prefer writing `default`
explicitly with a comment, so the next person does not "helpfully" restore
`black-translucent`.

`default` insets the web view below an opaque status bar, so the page never
supplies the pixels the blur would be applied to.

**Keep `viewport-fit=cover`.** It is not the culprit, and you still need it: the
notch cuts into a landscape launch and the home indicator into every one. Keep
clearing both with `env(safe-area-inset-*)`.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

## Then the status bar is yours to colour

With an opaque bar, iOS tints it from **`theme-color`**. That has two
consequences:

- **`theme-color` must match the page background** at the top edge, or you get a
  visible seam instead of a blur band.
- **It must follow your theme at runtime.** If the app has its own light/dark
  switch, a `prefers-color-scheme` media query on the meta tag is not enough —
  the user can override the OS preference. Rewrite the tag whenever the theme
  changes:

```ts
const THEME_COLORS = { light: "#f5f5f5", dark: "#121212" } as const

export function applyTheme(resolved: "light" | "dark"): void {
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolved])
}
```

Keep the web app manifest's `theme_color` in sync with the same value.

## The gotcha that makes the fix look broken

**iOS reads these tags once — when the icon is added to the Home Screen — and
caches them with the icon.** An install made before the change keeps drawing
under the status bar no matter how many times you deploy.

So after shipping: **delete the Home Screen icon and add it again.** Say this in
your release notes too, or users will report the bug as unfixed. It is also why
you cannot conclude anything from testing on a pre-existing install.

## While old installs are still out there

`black-translucent` has a second, unrelated bug worth knowing if you are removing
it: WebKit draws the page from the very top of the screen but sizes the viewport
*as if it started below* the status bar. The document ends one status bar short
of the bottom, and WebKit fills the leftover strip with the web view's own white.

The usual workaround grows the root by that inset:

```css
@media (display-mode: standalone) {
  html { min-height: calc(100% + env(safe-area-inset-top)); }
}
```

Leave it in place when you switch to `default`, and leave a comment saying which
installs it is for: a fresh install reports a 0 top inset, so the rule no-ops.
Remove it only once you no longer care about icons added before the fix.

## Required companions

The status-bar tag "has no effect unless you first specify full-screen mode".
Ship both capability tags — the `apple-` one is what iOS reads, the unprefixed
one is the standard:

```html
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
```

## Checklist

- [ ] No `black-translucent` anywhere in the `<head>`; `default` written
      explicitly, with a comment saying why.
- [ ] `viewport-fit=cover` kept, safe-area insets still honoured in the layout.
- [ ] `theme-color` matches the page background at the top edge, and is rewritten
      on every theme change; manifest `theme_color` matches.
- [ ] Release notes tell existing users to delete and re-add the icon.
- [ ] Verified on a **freshly added** Home Screen icon, not an old one.
- [ ] Any `display-mode: standalone` height workaround kept and commented as
      legacy-install-only.

## Provenance

The mechanism is Apple's documented layout behavior for the tag ([Supported Meta
Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html),
[Configuring Web
Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html));
those pages are archived and predate iOS 26, so they describe the inset but not
the Liquid Glass treatment of it. The iOS 26 behavior and this remedy come from
two independent fixes that landed it in real apps:
[`tmshv/vcsudoku#38`](https://github.com/tmshv/vcsudoku/pull/38) (dropped the tag,
tinted `theme-color` per theme) and
[`sirk0/hypersweeper#145`](https://github.com/sirk0/hypersweeper/pull/145) (set it
to `default`; documents that no switch disables the effect and that
`env(safe-area-inset-*)` does not account for it). Not re-tested on hardware here.
