---
name: remix-ui-text-field-editable
description: >-
  When writing or reviewing a `<input type="text">` / `<textarea>` in
  `@remix-run/ui` (Remix v3 client components / clientEntry) whose value needs
  to reflect app state, use this skill. Trained habit writes
  `<input value={state} mix={[on("input", e => setState(e.currentTarget.value))]} />`
  — in `@remix-run/ui` this is a trap: the runtime's controlled-value
  reflection races the keystroke and reverts it, so the field looks frozen /
  uneditable after the first character. Use this skill whenever you add a
  text input, textarea, or any bound-value form control in `@remix-run/ui`
  code, or when debugging a report that a remix/ui text field "can't be
  edited", "resets while typing", or "only accepts one character". The fix is
  to use `defaultValue`/`defaultChecked` (the framework's uncontrolled-input
  API) instead of `value`/`checked`.
---

# @remix-run/ui text fields: don't bind `value=` to state

## The trap

This is the failure pattern (real example, does not work):

```tsx
<input
  type="text"
  value={myName}
  mix={[on("input", (e) => {
    onNameInput((e.currentTarget as HTMLInputElement).value);
  })]}
/>
```

Typing into this field is broken: it accepts at most one character before
reverting, or appears completely frozen.

## Why

`@remix-run/ui`'s reconciler (`reconcile.ts`) treats any host element with a
`value` (or `checked`) prop as a **controlled** input. It attaches its own
`input`/`change` listeners and, in a **queued microtask**, forces the DOM
`.value` back to whatever `value` prop was last rendered
(`ensureControlledReflection` / `scheduleControlledRestore` /
`restoreControlledReflections` in `reconcile.ts`).

This only stays invisible if your own handler updates the bound state **and**
triggers a re-render (`handle.update()`) synchronously, in the same tick as
the `input` event — so that by the time the framework's microtask runs, the
prop it would restore *is already* the character the user just typed. If the
state update goes through a callback prop, a store owned by another
component, a debounce, or anything else that doesn't land before that
microtask, the framework wins the race and snaps the DOM value back to the
stale one — every keystroke gets undone.

This is not a bug you work around by tweaking the handler; it's a structural
mismatch between "freely typed text field" and "value prop driven by a render
that may lag behind". The write-up above traces the exact code path if you
need to verify it (`node_modules/@remix-run/ui/src/runtime/reconcile.ts`,
search `ControlledReflectionState`).

## The fix: use `defaultValue`, not `value`

`@remix-run/ui` has a first-class uncontrolled-input API, mirroring React's:
`defaultValue` / `defaultChecked`. This is the officially documented pattern —
see [`select/README.md`](https://github.com/remix-run/remix/blob/2c0ef67220714e1005162be4acdb91fbf355c664/packages/ui/src/select/README.md?plain=1#L15)
(`<Select defaultLabel="…" defaultValue="remix" ...>`) and the same prop on
plain `<input>`/`<textarea>`.

The key difference from `value`, straight from the `@remix-run/ui` source
(`runtime/reconcile.ts`, `runtime/core/props.ts`):

- The controlled-value-reflection machinery (`ensureControlledReflection`,
  `hasControlledValueProp`) keys **only** on the `value` prop —
  `defaultValue` never registers the element as controlled, so the
  input/change-triggered restore-to-prop microtask never runs.
- Prop patching (`patchHostProp`) only touches a prop when it actually
  *changes* between renders (`prevValue === nextValue → skip`). A
  `defaultValue` you pass once and never change (e.g. `defaultValue={initialName}`
  from a loader) is applied at mount and then left alone — later re-renders
  for unrelated reasons can't stomp on what the user typed, unlike `value`.

```tsx
<input
  type="text"
  class="grow"
  placeholder="あなたの名前"
  maxlength={40}
  defaultValue={initialName}
  mix={[on("input", (e) => {
    onNameInput((e.currentTarget as HTMLInputElement).value);
  })]}
/>
```

Read the live value from the event itself (`e.currentTarget.value`) — that's
always correct and current, since the DOM owns the value once mounted.

If you need to read the value somewhere other than an event handler (e.g. on
form submit), give the input an `id` and read `document.getElementById(id).value`
— this is the pattern `deno-remix-reference`'s `reference/client/push_card.tsx`
uses for its "バッジ数" number input, which also has no `value` prop:

```tsx
const BADGE_INPUT_ID = "rmx-push-badge-input";

<input
  id={BADGE_INPUT_ID}
  type="number"
  min="0"
  step="1"
  inputmode="numeric"
  placeholder="バッジ数"
  aria-label="バッジ数"
  class="input input-bordered input-sm w-24"
/>;

const readBadgeCount = (): number | undefined => {
  const el = document.getElementById(BADGE_INPUT_ID) as HTMLInputElement | null;
  const raw = el?.value.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};
```

Rules of thumb:

1. **Never bind `value=` to state on a text input the user types into.** Use
   `defaultValue=` for the initial/prefilled contents instead — it's a
   one-time seed, not a per-render binding, and it never triggers the
   controlled-reflection race.
2. Read what the user typed from the event (`e.currentTarget.value` inside the
   `input`/`change` handler) or, if you need it elsewhere, via `id` +
   `document.getElementById(...).value`.
3. If you need to *programmatically* replace the field's contents later (not
   just seed it once), set `element.value` directly through the DOM (or via a
   mix lifecycle hook) rather than by re-rendering with a `value` prop — that
   avoids ever registering it as a controlled input.
4. Checkboxes/radios have the same pair: use `defaultChecked=`, not
   `checked=`, unless you truly need a fully controlled checkbox and can
   guarantee the state write + `handle.update()` land synchronously inside
   the same `input`/`change` handler.
5. Composite `@remix-run/ui` widgets (`Select`, `Accordion`, …) follow the
   same convention: `defaultValue`/`defaultLabel` for uncontrolled, `value` +
   `onValueChange` for controlled. Prefer the uncontrolled form unless another
   part of the UI must react live to the value changing.
