# Tabler JavaScript & Bootstrap deltas

Tabler is Bootstrap 5 recompiled with the `tblr-` prefix plus a vanilla-JS enhancement layer. This file documents exactly where Tabler **differs from stock Bootstrap** — verified against the `@tabler/core@1.4.0` source. Get these wrong and you either double-initialize components or ship dead attributes.

## Contents
- [Dist inventory](#dist-inventory)
- [Script loading order (the canon)](#script-loading-order)
- [Auto-initialization — what tabler.js does for you](#auto-initialization)
- [Tabler-only data attributes](#tabler-only-data-attributes)
- [The `tabler` JS namespace](#the-tabler-js-namespace)
- [Bootstrap deltas cheat-sheet](#bootstrap-deltas-cheat-sheet)

## Dist inventory

`@tabler/core` ships more than one stylesheet — load only what the page uses:

| File | Purpose |
|---|---|
| `dist/css/tabler.min.css` | Core (Bootstrap recompiled + all Tabler components) |
| `dist/css/tabler-themes.min.css` | Attribute-driven theme system (`data-bs-theme-base/primary/font/radius`) — see theming.md |
| `dist/css/tabler-vendors.min.css` | Tabler-styled skins for vendor libs (Tom Select, Litepicker, Dropzone…) — load whenever you use those libs |
| `dist/css/tabler-flags.min.css` | `flag flag-country-tr` country flags |
| `dist/css/tabler-payments.min.css` | `payment payment-provider-visa` payment logos |
| `dist/css/tabler-socials.min.css` | Social brand icons/colors |
| `dist/css/tabler-marketing.min.css` | Marketing-page extras (heroes, pricing) — the one exception to "Tabler isn't for marketing" |
| `dist/css/tabler-props.min.css` | Design tokens ONLY (no components) — inject Tabler's `--tblr-*` variables into a non-Tabler context |
| `dist/js/tabler.min.js` | Bootstrap 5 JS bundle + Tabler auto-init layer (below) |
| `dist/js/tabler-theme.min.js` | Theme persistence script (URL params + localStorage) |
| `dist/libs/tom-select/…`, `dist/libs/litepicker/…` | Tom Select and Litepicker are BUNDLED in the package — no separate install needed |

Every stylesheet also has an `.rtl.css` variant.

**Never load `bootstrap.bundle.js` alongside `tabler.min.js`** — Tabler's bundle already contains and re-exports all of Bootstrap (`window.bootstrap.Modal`, `Toast`, `Offcanvas`, …). Loading both double-binds every data-API listener.

## Script loading order

The canonical order (as used by preview.tabler.io):

```html
<head>
  <link rel="stylesheet" href=".../dist/css/tabler.min.css"/>
  <link rel="stylesheet" href=".../dist/css/tabler-themes.min.css"/> <!-- if using theme attrs -->
  <!-- plugin CSS as needed: vendors / flags / payments / socials -->
</head>
<body>
  <script src=".../dist/js/tabler-theme.min.js"></script> <!-- FIRST in body, NOT deferred: kills theme flash -->
  <div class="page">…</div>

  <!-- vendor libs BEFORE tabler.js (its auto-init probes window.* at execution time) -->
  <script src=".../apexcharts.min.js" defer></script>
  <script src=".../autosize.min.js" defer></script>       <!-- only if using data-bs-toggle="autosize" -->
  <script src=".../dist/js/tabler.min.js" defer></script>
  <script src="/js/page-init.js" defer></script>           <!-- your chart/select inits -->
</body>
```

Two rules that actually bite:
1. `tabler-theme.js` is intentionally **render-blocking at the top of `<body>`** — deferring it reintroduces the light-theme flash it exists to prevent. (If you don't use the theme system, use the hand-rolled 3-line `<head>` snippet from SKILL.md instead.)
2. Deferred scripts execute in document order, so vendor libs (autosize, countUp, IMask) must appear **before** `tabler.min.js` — its init code checks `window.autosize && …` once at load and silently no-ops if the lib isn't there yet.

## Auto-initialization

On load, `tabler.min.js` scans the DOM and initializes — **do not initialize these again manually**:

| Selector | What happens | Stock Bootstrap behavior |
|---|---|---|
| `[data-bs-toggle="tooltip"]` | `new Tooltip` with 50ms show/hide delay; reads `data-bs-html`, `data-bs-placement` | **Manual init required** — this is the biggest delta |
| `[data-bs-toggle="popover"]` | `new Popover`, same options handling | **Manual init required** |
| `[data-bs-toggle="dropdown"]` | Pre-instantiated; supports `data-bs-boundary="viewport"` | Lazy data-API (works, but no boundary attr) |
| `[data-bs-toggle="toast"]` + `data-bs-target="#id"` | Click on trigger shows the target toast | **Doesn't exist** in Bootstrap (toasts are JS-only there) |
| `[data-bs-toggle="tab"]` matching `location.hash` | Tab auto-activated from URL hash → deep-linkable tabs for free | Doesn't exist |

Consequences:
- Tooltips/popovers on **dynamically inserted content** (HTMX swaps, React renders, fetch-injected rows) are NOT auto-initialized — the scan runs once. Re-init just the new subtree: `el.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(t => new bootstrap.Tooltip(t))`. With HTMX, hook `htmx:afterSwap`.
- Tabs need only the per-link `data-bs-toggle="tab"`. (You may see `data-bs-toggle="tabs"` on a `<ul>` in older demos — it is inert; don't cargo-cult it.)
- Give data-view tabs `href="#tab-id"` anchors so the hash deep-linking works — it's free UX.

## Tabler-only data attributes

These are Tabler inventions with **no Bootstrap equivalent**:

**`data-bs-toggle="switch-icon"`** — favorite/star toggles. Click toggles `.active`, which cross-fades icon A→B. Pure CSS+3 lines of JS, no dependency:

```html
<button type="button" class="switch-icon" data-bs-toggle="switch-icon"
        aria-pressed="false" aria-label="Favorite">
  <span class="switch-icon-a text-muted"><i class="ti ti-star"></i></span>
  <span class="switch-icon-b text-yellow"><i class="ti ti-star-filled"></i></span>
</button>
```
Note: it only toggles the class — persisting the state (fetch/form) is your job. Update `aria-pressed` in your handler.

**`data-countup`** — animated number counters (requires countUp.js on `window.countUp`):
```html
<span data-countup='{"duration": 2}'>1284</span>
```
Value is read from the element's text; options are JSON in the attribute; `enableScrollSpy: true` is Tabler's default (counts up when scrolled into view).

**`data-mask`** — input masks (requires IMask on `window.IMask`):
```html
<input type="text" class="form-control" data-mask="00/00/0000" data-mask-visible="true"
       placeholder="DD/MM/YYYY" autocomplete="off">
```

**`data-bs-toggle="autosize"`** — auto-growing textareas (requires autosize lib):
```html
<textarea class="form-control" data-bs-toggle="autosize" placeholder="Type a comment…"></textarea>
```

All four degrade silently when their vendor lib is absent — a page won't crash, the enhancement just won't run. Verify the lib is actually loaded when the behavior "mysteriously" doesn't work.

## The `tabler` JS namespace

`tabler.min.js` exposes a small `tabler` global alongside `bootstrap`:

```js
tabler.getColor("primary")        // → resolved value of --tblr-primary
tabler.getColor("green", 0.2)     // → rgba(…, 0.2) — reads the CSS var, converts hex→rgba
tabler.hexToRgba("#0054a6", 0.5)
tabler.prefix                     // "tblr-"
```

`tabler.getColor` is the **sanctioned way to feed chart libraries** — it keeps charts on-token and theme-aware:

```js
new ApexCharts(el, {
  colors: [tabler.getColor("primary"), tabler.getColor("green"), tabler.getColor("gray-300")],
  // …
}).render();
```

On theme toggle, charts don't repaint automatically — re-read colors and `chart.updateOptions({ colors: […] })`.

## Bootstrap deltas cheat-sheet

| Topic | Stock Bootstrap | Tabler |
|---|---|---|
| CSS variable prefix | `--bs-*` | `--tblr-*` (whole framework recompiled; Bootstrap docs snippets referencing `--bs-*` need translation) |
| Tooltips/popovers | manual JS init | auto-init on load |
| Toast trigger | JS only | `data-bs-toggle="toast"` + target |
| Tab deep-linking | none | automatic from URL hash |
| Theme switching | `data-bs-theme` (light/dark only) | + `data-bs-theme-base/primary/font/radius` via tabler-themes.css |
| Icons | none bundled | Tabler Icons (separate package, same design language) |
| Vendor skins | none | tabler-vendors.css styles Tom Select, Litepicker, Dropzone… to match |
| Components | BS set | + avatars, statuses, steps, timeline, datagrid, empty, ribbon, segmented control, switch-icon, tracking, page-layout system |
| JS bundle | bootstrap.bundle.js | tabler.js *contains* Bootstrap — never load both |
