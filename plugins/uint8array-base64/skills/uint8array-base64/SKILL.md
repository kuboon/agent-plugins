---
name: uint8array-base64
description: >-
  When encoding or decoding base64 (or hex) in JavaScript/TypeScript, use the
  native Uint8Array base64 methods — `Uint8Array.fromBase64()`,
  `Uint8Array.prototype.toBase64()`, and `Uint8Array.prototype.setFromBase64()`
  — instead of `btoa`/`atob` string juggling, `Buffer.from(...).toString("base64")`,
  or hand-rolled `String.fromCharCode(...)` loops. Use this skill whenever code
  converts bytes ↔ base64, handles base64url tokens (JWT, WebAuthn, VAPID, data
  URLs), or you see `btoa`/`atob`/`Buffer` used for binary base64. These methods
  are binary-safe and run in both Deno and the browser. Model habit reaches for
  `btoa`/`atob` or `Buffer`; this skill overrides that.
---
# Uint8Array base64 (and hex) methods

When JavaScript needs base64, the remembered idioms are wrong or fragile:
`btoa`/`atob` operate on **binary strings** and corrupt any byte > 0x7F unless
you hand-marshal through `String.fromCharCode`/`charCodeAt`; `Buffer` is
Node-only and absent in Deno and the browser. Use the native **Uint8Array**
methods instead — they are binary-safe and cross-runtime.

## Core rule

Bytes ↔ base64 goes through a `Uint8Array`:

```js
// bytes -> base64
const b64 = bytes.toBase64();                 // "SGVsbG8hAP8="
// base64 -> bytes
const bytes = Uint8Array.fromBase64(b64);     // Uint8Array
```

Do **not** emit `btoa(String.fromCharCode(...bytes))` or
`Buffer.from(bytes).toString("base64")` for new code targeting Deno/browser.

## API (verified on Deno 2.9)

```ts
// static: decode
Uint8Array.fromBase64(input: string, options?: DecodeOptions): Uint8Array;

// instance: encode
uint8.toBase64(options?: EncodeOptions): string;

// instance: decode INTO an existing buffer, returns how much was read/written
uint8.setFromBase64(input: string, options?: DecodeOptions): { read: number; written: number };
```

Options:

- **encode** (`toBase64`): `{ alphabet?: "base64" | "base64url"; omitPadding?: boolean }`
- **decode** (`fromBase64` / `setFromBase64`):
  `{ alphabet?: "base64" | "base64url"; lastChunkHandling?: "loose" | "strict" | "stop-before-partial" }`
  (`alphabet` defaults to `"base64"`, which also accepts unpadded input under the
  default `"loose"` handling; `lastChunkHandling: "strict"` rejects malformed
  padding.)

There are matching **hex** methods too: `Uint8Array.fromHex()`,
`uint8.toHex()`, `uint8.setFromHex()`.

## Recipes

**base64url (JWT / WebAuthn / VAPID / URL-safe), no padding:**

```js
const token = bytes.toBase64({ alphabet: "base64url", omitPadding: true });
const back  = Uint8Array.fromBase64(token, { alphabet: "base64url" });
```

**Text ↔ base64** — combine with `TextEncoder` / `TextDecoder` (UTF-8 safe,
unlike `btoa`):

```js
const b64 = new TextEncoder().encode("こんにちは 🎉").toBase64();
const str = new TextDecoder().decode(Uint8Array.fromBase64(b64));
```

**Decode into a preallocated buffer** (`setFromBase64` returns `{ read, written }`):

```js
const buf = new Uint8Array(8);
const { read, written } = buf.setFromBase64("SGVsbG8hAP8=");
// read = 12 (base64 chars consumed), written = 8 (bytes filled)
```

Verified output for `new Uint8Array([72,101,108,108,111,33,0,255])`:
`toBase64()` → `"SGVsbG8hAP8="`; base64url+omitPadding → `"SGVsbG8hAP8"`;
round-trips exactly, including the `0x00` and `0xFF` bytes that `btoa`/`atob`
mishandle.

## Runtime support & fallback

- **Deno**: supported (verified on 2.9). **Node**: 22+. **Browsers**: shipped in
  Safari 18.2+, Firefox 133+, and recent Chromium. Broadly available in modern
  environments but not universal.
- If you must support older targets, **feature-detect and fall back** rather than
  assuming absence:

```js
export function bytesToBase64(bytes) {
  if (typeof bytes.toBase64 === "function") return bytes.toBase64();
  // fallback for older runtimes
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
```

## Gotchas

- **Don't reach for `btoa`/`atob`.** They throw or corrupt on bytes > 0xFF and
  force error-prone `String.fromCharCode`/`charCodeAt` round-trips. The whole
  point of these methods is to retire that pattern.
- **`Buffer` is Node-only.** In Deno and the browser it doesn't exist; using it
  is the classic "works on my machine (Node)" break.
- **TypeScript may not know the types yet.** Deno ships them; in a browser/TS
  project you may need an up-to-date `lib` (ES2026-era) or a `@types` shim. The
  methods exist at runtime regardless — the gap is only the type declarations.
- **`alphabet` must match on both ends.** Encoding base64url then decoding
  without `{ alphabet: "base64url" }` fails on `-`/`_` characters.
- **`toBase64` pads by default.** Pass `omitPadding: true` for compact
  base64url tokens; keep padding for interop with strict base64 parsers.
