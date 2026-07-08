---
name: browser-how-to
description: >-
  When integrating "Add to Home Screen" (a2hs / PWA install), passkeys (WebAuthn),
  or web push notifications into a web frontend, use the @kuboon/browser-how-to
  library. Use this skill whenever you add or review code that: prompts a PWA
  install / "add to home screen", detects passkey/WebAuthn capability, requests
  or explains notification permission / Web Push, or handles in-app browsers
  (Facebook/Messenger/Instagram/LINE/etc.) that block these features. The library
  handles the "can this device do it? → if not, send to a standard browser → if
  yes, show how" flow so you don't hand-roll device/UA detection. Framework-
  agnostic (Vanilla JS/TS). Full reference: https://kuboon.github.io/browser-how-to/llms.txt
---
# browser-how-to: a2hs / passkeys / web push integration

When you add **Add to Home Screen**, **passkeys**, or **web push** to a web
frontend, do **not** hand-roll UA sniffing, iOS-vs-Android install steps, or
in-app-browser detection. Use **`@kuboon/browser-how-to`**. It answers, per
feature: *is this environment capable → if not, guide the user to a standard
browser → if capable, show the how-to* (guidance in Japanese).

Scope boundary — the library **only detects and guides**. It does **not** perform
passkey registration/authentication or push subscription itself; your host app /
backend still implements `navigator.credentials`, the service worker, and the
push subscription. This library removes the "why doesn't it work on this device"
friction around those.

**Full, self-contained API reference (read this for exact signatures):**
<https://kuboon.github.io/browser-how-to/llms.txt> — demo:
<https://kuboon.github.io/browser-how-to/>

## Install

Not on npmjs.com. Publishes to **JSR** (recommended) and GitHub Packages.

```bash
npx jsr add @kuboon/browser-how-to        # npm/pnpm/yarn projects
deno add jsr:@kuboon/browser-how-to       # Deno
```

GitHub Packages alternative: put `@kuboon:registry=https://npm.pkg.github.com` in
`.npmrc`, then `npm i @kuboon/browser-how-to`.

## Subpath entries (tree-shakeable — import only what you use)

| import | role |
|---|---|
| `@kuboon/browser-how-to` | device / browser / in-app-browser detection + types |
| `@kuboon/browser-how-to/a2hs`, `/a2hs/ui` | add to home screen |
| `@kuboon/browser-how-to/passkeys`, `/passkeys/ui` | passkeys |
| `@kuboon/browser-how-to/push`, `/push/ui` | web push (pulls in a2hs internally) |

`push` includes `a2hs` (iOS needs install first). `passkeys` alone pulls in
neither.

## The two ways to use it

**1. Drop-in UI guide** — every `/ui` entry exports a `show*Guide(options?)` that
picks the right modal for the current device and returns `{ close() }`:

```ts
import { showPushGuide } from "@kuboon/browser-how-to/push/ui";
import { showPasskeyGuide } from "@kuboon/browser-how-to/passkeys/ui";
import { showA2hsGuide } from "@kuboon/browser-how-to/a2hs/ui";

document.querySelector("#enable-push")!
  .addEventListener("click", () => showPushGuide());
```

Common options: `{ userAgent?, zIndex?, onClose?, controller? }`. Style via CSS
classes prefixed `bht-`. Guidance copy is Japanese-only.

**2. Headless detection** — decide in your own UI. All root detectors take an
optional `userAgent` (for SSR/tests) and the core ones are synchronous:

```ts
import { detectDevice, isStandardBrowser } from "@kuboon/browser-how-to";

const device = detectDevice();               // DeviceInfo
if (device.inApp.isInApp) {
  // e.g. opened inside Messenger — send them to a standard browser.
  device.inApp.appLabel; // "Facebook Messenger"
}
```

Verified behavior (run against the library source on Deno):

| UA | `platform` | `inApp.isInApp` | `inApp.appLabel` | `isStandardBrowser` |
|---|---|---|---|---|
| iOS Safari | `ios` | `false` | — | `true` |
| iOS Messenger | `ios` | `true` | `Facebook Messenger` | `false` |

`escapeInAppBrowser(device, { url })` returns `{ method: "redirect", ok: true, … }`
on Android/iOS (deep-links out to the standard browser) or `{ method: "manual" }`
with steps on desktop.

## Per-feature: the one thing to get right

- **a2hs** — `createA2hs()` / `showA2hsGuide()`. `beforeinstallprompt` is
  auto-captured on import; `promptInstall()` fires the native OS dialog only on
  Android Chromium (`status.canPrompt`). iOS is always the manual
  "Share → Add to Home Screen" walkthrough (`support: "manual"`). PWA install
  still needs a real web app manifest — the library guides, it doesn't create it.
- **passkeys** — `detectPasskeyStatus()` (async) / `showPasskeyGuide()`.
  Detection uses `PublicKeyCredential.getClientCapabilities()` with fallback to
  `isUVPAA()` / `isConditionalMediationAvailable()`. `support` is
  `full | cross-device-only | in-app-blocked | unsupported`. Registration/login
  is still your backend's job.
- **push** — `detectPushStatus()` (sync) / `showPushGuide()`. `support` is
  `ready | needs-install | in-app-blocked | denied | unsupported`. On **iOS**,
  Web Push works **only inside a home-screen-installed PWA**, so `needs-install`
  means "run a2hs first" — `showPushGuide()` calls `showA2hsGuide()` for you.
  `denied` → use `getReenableSteps()` for per-device re-enable instructions. The
  library does **not** request permission or subscribe; call
  `Notification.requestPermission()` / `pushManager.subscribe()` yourself once
  `support === "ready"`.

## Gotchas

- **In-app browsers are the main failure mode.** Facebook, Messenger, Instagram,
  Threads, LINE, X, WeChat, TikTok, KakaoTalk, etc. all block a2hs/passkeys/push.
  Every feature exposes `escapeInAppBrowser()` — wire it up, don't just show a
  broken button.
- **iOS push depends on a2hs.** If you add push on iOS without the install step,
  it silently never works. Use the `push` entry (which bundles a2hs) rather than
  reimplementing the ordering.
- **Guidance text is Japanese only.** If you need other languages, use the
  headless detectors and render your own copy.
- **Detection is UA-overridable.** Pass `userAgent` (or the first arg of the
  core detectors) for SSR and tests instead of relying on `navigator`.
