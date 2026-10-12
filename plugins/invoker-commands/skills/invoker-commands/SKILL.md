---
name: invoker-commands
description: >-
  When a button opens, closes or toggles a `<dialog>` or a `popover`, or makes
  another element do something, use the declarative Invoker Commands API —
  `<button commandfor="id" command="show-modal">` — instead of a click listener
  that calls `showModal()` / `close()` / `togglePopover()`. Use this skill
  whenever you write or review a modal, confirm dialog, drawer, menu, tooltip
  toggle, popover, or any `button.addEventListener("click", () =>
  target.something())` pattern in HTML, JSX, or a template — and whenever you
  reach for `popovertarget`, `onclick="dialog.showModal()"`, or
  `useState`-driven open flags for a native dialog/popover. Covers the built-in
  commands, `--custom` commands with the `command` event, the `type="button"`
  trap inside forms, and the non-bubbling event.
---
# Invoker Commands API (`commandfor` / `command`)

A button that controls another element is declared in HTML, not wired in
JavaScript:

```html
<button commandfor="confirm" command="show-modal">Delete…</button>
<dialog id="confirm">
  <p>Delete this record?</p>
  <button commandfor="confirm" command="close" value="cancel">Cancel</button>
  <button commandfor="confirm" command="close" value="delete">Delete</button>
</dialog>
```

It works before any script loads, keyboard activation comes for free, and there
is no listener to leak or forget. Model habit writes a `click` listener calling
`showModal()`; **reach for `commandfor` first** and only add JavaScript for what
the built-in commands cannot do.

Baseline: Chrome/Edge 135, Firefox 144, Safari 26.2 (Baseline since late 2025).

## Built-in commands

| `command` | Target | Equivalent |
| --- | --- | --- |
| `show-modal` | `<dialog>` | `dialog.showModal()` |
| `close` | `<dialog>` | `dialog.close(button.value)` |
| `request-close` | `<dialog>` | `dialog.requestClose(button.value)` — fires a cancelable `cancel` first |
| `show-popover` | `[popover]` | `el.showPopover()` |
| `hide-popover` | `[popover]` | `el.hidePopover()` |
| `toggle-popover` | `[popover]` | `el.togglePopover()` |

- `close` / `request-close` copy the button's `value` into `dialog.returnValue`,
  so a confirm dialog needs no JavaScript to know which button was pressed —
  read `returnValue` in the dialog's `close` event.
- Prefer `request-close` when the dialog should be able to veto closing (unsaved
  changes): `preventDefault()` on its `cancel` event keeps it open.
- `commandfor` is the general form of `popovertarget`; use `commandfor` +
  `command` for popovers in new code too.
- A non-modal `dialog.show()` has no command; use a popover instead, or a
  custom command.

## Custom commands (`--name`)

Anything else is a custom command: a value starting with `--`. The browser
dispatches a `command` event (`CommandEvent`) on the target; `event.command` is
the value and `event.source` is the button.

```html
<button commandfor="photo" command="--rotate-left">⟲</button>
<button commandfor="photo" command="--rotate-right">⟳</button>
<img id="photo" src="photo.jpg" alt="Photo" />
```

```js
const photo = document.getElementById("photo");
photo.addEventListener("command", (event) => {
  if (event.command === "--rotate-left") photo.style.rotate = "-90deg";
  if (event.command === "--rotate-right") photo.style.rotate = "90deg";
});
```

This keeps the *which button controls what* wiring in markup and leaves one
listener on the target, instead of one listener per button. A custom element
can handle its own commands the same way (`this.addEventListener("command", …)`).

A value that is neither built-in nor `--`-prefixed does nothing and fires no
event — don't invent bare names like `command="rotate"`.

## Traps (verified on Chromium 141)

**Inside a `<form>`, write `type="button"`.** A `commandfor` button in a form
with no `type` did nothing at all — no command, no submit. With
`type="button"` the command runs.

```html
<form>
  <button type="button" commandfor="help" command="toggle-popover">?</button>
</form>
```

**The `command` event does not bubble.** Listen on the target element itself.
A listener on `document.body` saw nothing; only a capturing listener on
`document` did. Don't build event delegation on `command`.

**It is cancelable.** `preventDefault()` in a `command` listener on the target
stops a built-in command — e.g. keep a popover closed. Use it to guard an action,
not as a substitute for the right command.

**`commandfor` takes an ID in the same tree.** A button inside a shadow root
with `commandfor` naming an element outside it did nothing. Setting the element
reference in JavaScript worked:
`button.commandForElement = target; button.command = "show-popover";`

## In frameworks

The attributes are plain HTML, so they work in JSX and templates as written
(`commandfor`, `command`; some typings lag, so a cast or a module augmentation
may be needed). A native dialog or popover opened this way does not need an
`isOpen` state flag — the element owns its open state; listen for its `close` /
`toggle` events if the app has to react.

## When not to use it

- The trigger is not a `<button>` (a link, a row, a keyboard shortcut) — call
  the method from your handler.
- The action needs data the button can't express in `value`/`command` — use a
  custom command and read `event.source.dataset` in the listener, or a normal
  handler if that gets awkward.
