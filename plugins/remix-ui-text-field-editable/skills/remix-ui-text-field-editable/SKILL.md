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
  edited", "resets while typing", or "only accepts one character".
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

## The fix: make it uncontrolled

`deno-remix-reference`'s `reference/client/push_card.tsx` shows the correct,
working pattern for a text-like input the user actually types into — the
"バッジ数" number input. It has **no `value` prop at all**:

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

// read it on demand, not on every keystroke:
const readBadgeCount = (): number | undefined => {
  const el = document.getElementById(BADGE_INPUT_ID) as HTMLInputElement | null;
  const raw = el?.value.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};
```

Apply the same shape to a text field:

```tsx
const NAME_INPUT_ID = "rmx-name-input";

<input
  id={NAME_INPUT_ID}
  type="text"
  class="grow"
  placeholder="あなたの名前"
  maxlength={40}
  mix={[on("input", (e) => {
    onNameInput((e.currentTarget as HTMLInputElement).value);
  })]}
/>;
```

Rules of thumb:

1. **No `value=` prop on a text input the user types into**, unless you also
   set it up as fully controlled and can guarantee the state write +
   `handle.update()` happen synchronously inside that same `input` handler
   (rare, and not worth it for plain text fields — prefer rule 2).
2. Give it an `id` (or a `mix`-based ref) and read `.value` from the live DOM
   node — either inside the `input`/`change` handler itself
   (`e.currentTarget.value`, which is always correct and current) or later on
   demand (submit, blur) via `document.getElementById(...)`.
3. If you need to *programmatically* set the field's contents (e.g. reset,
   prefill from a loaded value), set `element.value` directly through the DOM
   (or via a mix lifecycle hook) rather than by re-rendering with a `value`
   prop — that avoids ever registering it as a controlled input.
4. Checkboxes/radios with `checked=` hit the same mechanism
   (`hasControlledCheckedProp`) but are lower-risk in practice because
   `change`-driven state updates are already synchronous with the click;
   still prefer reading `e.currentTarget.checked` in the handler over trusting
   a bound `checked` prop if you see similar flakiness.
