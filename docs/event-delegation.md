# Event delegation: the `data-*` action attribute API

`src/ui/event-delegation.js` is thatcher's client-side programming model. It is
one file with a single delegated `click` listener on `document` (plus a
`keydown` listener for Escape/Tab/Enter handling) -- there is no build step, no
per-page bundler, and no per-element `addEventListener` wiring. Instead, any
element (usually a `<button>`, but any clickable element works) declares its
behavior directly in HTML via `data-*` attributes, and the delegation listener
reads those attributes at click time and runs the matching behavior. This lets
server-rendered HTML (thatcher renders views server-side) stay fully
interactive with zero inline `<script>` handlers and zero client router.

Two pieces cooperate:

- `window.__events` -- a small registry (`register(name, fn)` /
  `dispatch(name, event, target, params)`). `eventDelegation`'s own methods
  (`openDialog`, `closeDialog`, `navigate`, `toggle`, `toggleDisplay`,
  `setValue`, `setDisplay`, `remove`, `focus`, `printPage`) are registered
  into it under their own names. `dispatch` looks a name up in the registry
  first; if nothing is registered under that name it falls back to calling a
  same-named function on `window` directly, so a page can define its own
  one-off `window.myHandler = function(...) {}` and wire it up with
  `data-action="myHandler"` with no registration step at all.
- The delegated `click` (and `keydown`) listener on `document`, which reads
  the `data-*` attributes below off `event.target.closest(...)` and decides
  what to do.

Because everything is read from the DOM at click time, this also composes
with dialogs opened by other means (e.g. a `window.show*Dialog` helper that
just flips `display`) via a `MutationObserver` that watches for dialog
visibility changes and applies the same focus-trap/restore behavior
regardless of how the dialog was opened.

## `data-action`

The core attribute. Its value is the action name: dispatched via
`window.__events.dispatch(name, event, target, params)`, which first checks
the internal registry (the built-in actions below, or anything a page
registered with `window.__events.register(...)`) and falls back to calling a
same-named global `window[name]` function if nothing is registered.

Built-in registered actions (each is a method on `eventDelegation`):

| Action | Signature | What it does |
|---|---|---|
| `openDialog` | `(e, target, params)` | Shows (`display:flex`) the dialog whose id is `params.dialogId`, or (if absent) the first entry of `data-args`. Runs `dialogFocus.onOpen`. |
| `closeDialog` | `(dialogId)` | Hides (`display:none`) the dialog with that id. Runs `dialogFocus.onClose`. |
| `printPage` | `()` | Calls `window.print()`. |
| `navigate` | `(path)` | Sets `window.location = path`. |
| `toggle` | `(elementId, attr = 'checked')` | If the element is a checkbox, flips `.checked`; otherwise toggles the `active` class. |
| `toggleDisplay` | `(elementId)` | Flips the element's inline `style.display` between `''` and `'none'`. |
| `setValue` | `(elementId, value)` | Sets `el.value`. |
| `setDisplay` | `(elementId, show)` | Sets `style.display` to `''` (truthy `show`) or `'none'`. |
| `remove` | `(elementId)` | Removes the element from the DOM. |
| `focus` | `(elementId)` | Calls `el.focus()`. |

For a registered action, `dispatch` calls it as `fn(event, target, params)`
(the built-ins above ignore whichever leading args they don't need). For a
*fallback* `window[name]` global, the positional args instead come from
`data-args`/`data-pass-event`/`data-self` (see below) -- registered actions
use `data-params`, unregistered global-function fallbacks use `data-args`.

```html
<button type="button" data-action="remove" data-args="[&quot;row-42&quot;]">
  Delete row
</button>
```

## `data-params`

A JSON **object** literal, parsed and passed as the third argument
(`params`) to a *registered* action's `dispatch` call. Only meaningful
alongside `data-action` for a name found in the `window.__events` registry
(e.g. `openDialog`, which reads `params.dialogId`).

```html
<button type="button" data-action="openDialog"
        data-params='{"dialogId":"edit-contact-dialog"}'>
  Edit contact
</button>
```

## `data-args`

A JSON **array**, parsed and spread as positional arguments when `dispatch`
falls back to calling a same-named `window[name]` global function (i.e. when
`data-action`'s value is *not* found in the `window.__events` registry). Also
read directly by `openDialog` as a fallback source for the dialog id when
`data-params.dialogId` is absent (`JSON.parse(target.dataset.args)[0]`).

```html
<!-- window.confirmDelete is a page-defined global, not a registered action -->
<button type="button" data-action="confirmDelete" data-args="[&quot;case-118&quot;]">
  Delete case
</button>
```

## `data-pass-event`

A boolean-style (presence-only) attribute. When present on the action
element, `dispatch`'s `window[name]` fallback path unshifts the raw DOM
`click` event onto the front of the `data-args` array before calling the
global function -- i.e. the handler receives `(event, ...args)` instead of
just `(...args)`. Only applies to the unregistered-global fallback path, and
only in combination with `data-action`.

```html
<a href="#" data-action="onRowActivate" data-pass-event data-args="[&quot;row-7&quot;]">
  Open
</a>
```

## `data-self`

Also a boolean-style (presence-only) attribute, and also only meaningful on
the `window[name]` fallback path. When present, the clicked element itself is
pushed onto the *end* of the argument list passed to the global function --
i.e. `(...args, target)` (or `(event, ...args, target)` if `data-pass-event`
is also set).

```html
<button type="button" data-action="onQuickEdit" data-self
        data-args="[&quot;species&quot;]">
  Edit species
</button>
```

## `data-dialog-close`

Value is the id of a dialog element to close. Two behaviors depending on
where it sits:

- On an explicit close control (a button/link, e.g. the `&times;` close
  icon) it closes the named dialog unconditionally on click, and if the same
  element *also* carries `data-action`/`data-params`, that action is
  dispatched immediately afterward (close-then-act).
- On a backdrop/container element itself (one that carries the
  `dialog-backdrop`, `dialog-overlay`, `modal`, or `modal-overlay` class),
  the close only fires when the click landed directly on that container (a
  true backdrop click) -- a click that bubbled up from something inside the
  dialog panel is ignored, so interacting with the dialog's own contents
  never accidentally closes it.

```html
<div id="edit-contact-dialog" class="dialog-overlay" data-dialog-close="edit-contact-dialog">
  <div class="dialog-panel">
    <button type="button" class="dialog-close" data-dialog-close="edit-contact-dialog">&times;</button>
    ...
  </div>
</div>
```

## `data-navigate`

Value is a path/URL. On click, dispatches `eventDelegation.navigate(path)`
(`window.location = path`). Also functionally special outside of clicks: any
element carrying `data-navigate` that is not natively focusable (not an `A`,
`BUTTON`, `INPUT`, `SELECT`, or `TEXTAREA`) is automatically upgraded on page
load with `tabindex="0"` and `role="link"` (`upgradeNavigableRows`), and the
`keydown` listener activates it on `Enter`/`Space` -- so a whole `<tr>` can be
a keyboard-operable "navigate to this row's detail page" control without any
extra markup beyond the one attribute.

```html
<tr data-navigate="/cases/CASE-118">
  <td>CASE-118</td>
  <td>Open</td>
</tr>
```

## `data-toggle`

Value is an element id. On click, dispatches `eventDelegation.toggle(elementId)`:
if that element is a checkbox, flips `.checked`; otherwise toggles its
`active` CSS class.

```html
<button type="button" data-toggle="advanced-filters-panel">
  Show advanced filters
</button>
```

## `data-stop-propagation`

Boolean-style (presence-only) attribute. When the click target is inside an
element carrying this attribute, `e.stopPropagation()` is called
immediately. If that same element has no `data-action` of its own, handling
stops there entirely (the click is fully absorbed) -- otherwise it falls
through to the normal `data-action` dispatch. Useful for a control nested
inside a larger clickable/navigable row that must not also trigger the row's
own action.

```html
<tr data-navigate="/cases/CASE-118">
  <td>CASE-118</td>
  <td>
    <button type="button" data-stop-propagation data-action="openDialog"
            data-params='{"dialogId":"quick-note-dialog"}'>
      Add note
    </button>
  </td>
</tr>
```

## `data-overlay-close`

Marks an overlay container that should close itself (`style.display='none'`)
when the click lands directly on the overlay element (not on something
inside it). Checked before the general `data-action`/`data-dialog-close`
resolution, and independently of `dialogFocus` (no focus-restore side
effect) -- a lighter-weight backdrop-dismiss than `data-dialog-close`'s
tracked-focus dialog close.

```html
<div class="overlay" data-overlay-close>
  <div class="overlay-content">...</div>
</div>
```

---

## Related, non-`data-*` conventions worth knowing

These aren't `data-*` attributes but are part of the same declarative model
and are driven by the same file:

- **`role="dialog"` / `.dialog-overlay` / `.dialog-backdrop` / `.modal` /
  `.modal-overlay`** -- any element matching one of these is treated as a
  dialog by `dialogFocus`: opening traps `Tab` inside it and moves focus to
  its first focusable element (or `[autofocus]` if present); closing
  restores focus to whatever had focus before it opened. This applies
  whether the dialog was opened via `data-action="openDialog"` or by a page
  directly flipping `style.display` on it (caught by a `MutationObserver`).
- **`<button>` with no `type`** is automatically upgraded to
  `type="button"` on load if it carries any action attribute
  (`data-action`, `data-dialog-close`, `data-navigate`, `data-toggle`, or
  class `dialog-close`) or is not inside a `<form>` at all -- so an action
  button placed inside a `<form>` never accidentally submits it. A genuine
  submit button is left alone as long as it carries none of those attributes.
